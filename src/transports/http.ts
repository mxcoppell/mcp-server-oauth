import express from 'express';
import cors from 'cors';
import { Server } from 'http';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { OAuthMcpServer } from '../server.js';
import { ServerConfig } from '../types/index.js';
import { TokenValidator } from '../auth/validator.js';
import { WellKnownHandler } from '../auth/well-known.js';

export class HttpTransport {
    private server: OAuthMcpServer;
    private app: express.Application;
    private httpServer: Server | null = null;
    private config: ServerConfig;
    private tokenValidator: TokenValidator;
    private wellKnownHandler: WellKnownHandler;

    constructor(config: ServerConfig) {
        this.config = config;
        this.server = new OAuthMcpServer(config);
        this.tokenValidator = new TokenValidator(config);
        this.wellKnownHandler = new WellKnownHandler(config);
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware(): void {
        // CORS configuration
        this.app.use(cors({
            origin: this.config.corsOrigin,
            credentials: true,
            methods: ['GET', 'POST', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization']
        }));

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Request logging
        this.app.use((req, _res, next) => {
            console.log(`[HTTP] ${req.method} ${req.path} - ${req.ip}`);
            next();
        });
    }

    private setupRoutes(): void {
        // Well-known OAuth resource endpoint
        this.app.get('/.well-known/oauth-protected-resource', (_req, res) => {
            const response = this.wellKnownHandler.handleWellKnownRequest();
            res.status(response.status).set(response.headers).send(response.body);
        });

        // Health check endpoint
        this.app.get('/health', (_req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        });

        // MCP SSE endpoint with OAuth
        this.app.get('/sse', (req, res) => {
            if (this.config.enableAuth) {
                const authContext = this.tokenValidator.createAuthContext(req.headers.authorization);

                if (!authContext.isAuthorized) {
                    const wwwAuthenticate = this.tokenValidator.generateWWWAuthenticateHeader();
                    res.status(401)
                        .set('WWW-Authenticate', wwwAuthenticate)
                        .json({
                            error: 'Unauthorized',
                            message: 'Valid Bearer token required'
                        });
                    return;
                }

                // Attach auth context to request for MCP handlers
                (req as any).authContext = authContext;
            }

            // Setup SSE
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': this.config.corsOrigin,
                'Access-Control-Allow-Credentials': 'true'
            });

            const transport = new SSEServerTransport('/mcp', res);
            // Connect the transport to the server
            this.server.getServer().connect(transport).catch(error => {
                console.error('[HTTP] Failed to connect SSE transport:', error);
                res.writeHead(500);
                res.end('Internal server error');
            });

            req.on('close', () => {
                transport.close();
            });
        });

        // MCP POST endpoint for traditional request-response
        this.app.post('/mcp', async (req, res) => {
            if (this.config.enableAuth) {
                const authContext = this.tokenValidator.createAuthContext(req.headers.authorization);

                if (!authContext.isAuthorized) {
                    const wwwAuthenticate = this.tokenValidator.generateWWWAuthenticateHeader();
                    res.status(401)
                        .set('WWW-Authenticate', wwwAuthenticate)
                        .json({
                            error: 'Unauthorized',
                            message: 'Valid Bearer token required'
                        });
                    return;
                }

                // Attach auth context to request for MCP handlers
                (req as any).authContext = authContext;
            }

            try {
                // Handle MCP JSON-RPC request
                // This would be implemented based on the specific MCP SDK HTTP transport
                res.json({ message: 'MCP HTTP endpoint - implementation pending' });
            } catch (error) {
                console.error('[HTTP] MCP request error:', error);
                res.status(500).json({
                    error: 'Internal Server Error',
                    message: 'MCP request failed'
                });
            }
        });

        // Catch-all for unknown endpoints
        this.app.use('*', (_req, res) => {
            res.status(404).json({
                error: 'Not Found',
                message: 'Endpoint not found'
            });
        });

        // Global error handler
        this.app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            console.error('[HTTP] Unhandled error:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'An unexpected error occurred'
            });
        });
    }

    async start(): Promise<void> {
        await this.server.initialize();

        return new Promise((resolve, reject) => {
            this.httpServer = this.app.listen(this.config.httpPort, () => {
                console.log(`[HTTP Transport] MCP server started on port ${this.config.httpPort}`);
                console.log(`[HTTP Transport] OAuth well-known endpoint: http://localhost:${this.config.httpPort}/.well-known/oauth-protected-resource`);
                console.log(`[HTTP Transport] SSE endpoint: http://localhost:${this.config.httpPort}/sse`);
                console.log(`[HTTP Transport] Health check: http://localhost:${this.config.httpPort}/health`);
                resolve();
            });

            this.httpServer.on('error', (error) => {
                console.error('[HTTP Transport] Server error:', error);
                reject(error);
            });
        });
    }

    async stop(): Promise<void> {
        console.log('[HTTP Transport] Stopping MCP server...');

        if (this.httpServer) {
            return new Promise((resolve) => {
                this.httpServer!.close(() => {
                    console.log('[HTTP Transport] HTTP server stopped');
                    resolve();
                });
            });
        }

        await this.server.shutdown();
    }
} 