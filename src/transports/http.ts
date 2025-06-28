import express from 'express';
import cors from 'cors';
import { Server } from 'http';
import { OAuthMcpServer } from '../server.js';
import { ServerConfig } from '../types/index.js';
import { TokenValidator } from '../auth/validator.js';
import { WellKnownHandler } from '../auth/well-known.js';
import {
    StreamableHTTPServerTransport,
    type StreamableHTTPServerTransportOptions
} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';

export class HttpTransport {
    private server: OAuthMcpServer;
    private app: express.Application;
    private httpServer: Server | null = null;
    private config: ServerConfig;
    private tokenValidator: TokenValidator;
    private wellKnownHandler: WellKnownHandler;
    private transport: StreamableHTTPServerTransport;

    constructor(config: ServerConfig) {
        this.config = config;
        this.server = new OAuthMcpServer(config);
        this.app = express();
        this.tokenValidator = new TokenValidator(config);
        this.wellKnownHandler = new WellKnownHandler(config);

        const transportOptions: StreamableHTTPServerTransportOptions = {
            sessionIdGenerator: () => randomUUID(),
        };
        this.transport = new StreamableHTTPServerTransport(transportOptions);

        this.server.getServer().connect(this.transport);

        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware(): void {
        this.app.use(cors({
            origin: this.config.corsOrigin,
            credentials: true,
            methods: ['GET', 'POST', 'OPTIONS'],
            allowedHeaders: [
                'Content-Type',
                'Authorization',
                'mcp-protocol-version',
                'x-requested-with',
                'x-mcp-session-id'
            ],
            exposedHeaders: ['x-mcp-session-id']
        }));

        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        this.app.use((req, _res, next) => {
            if (req.path !== '/health' && !req.path.startsWith('/.well-known')) {
                console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
            }
            next();
        });
    }

    private createAuthMiddleware(): express.RequestHandler {
        return (req, res, next) => {
            if (this.config.enableAuth) {
                const authContext = this.tokenValidator.createAuthContext(req.headers.authorization);

                if (!authContext.isAuthorized) {
                    const isInitialConnection = req.method === 'GET';
                    if (isInitialConnection) {
                        const wwwAuthenticate = this.tokenValidator.generateWWWAuthenticateHeader();
                        res.status(401)
                            .set('WWW-Authenticate', wwwAuthenticate)
                            .json({ error: 'Unauthorized', message: 'Valid Bearer token required' });
                    } else {
                        res.status(401).json({
                            jsonrpc: '2.0',
                            id: (req.body as any)?.id || null,
                            error: { code: -32001, message: 'Unauthorized' }
                        });
                    }
                    return;
                }
                // Attach auth context for the transport and capability handlers
                (req as any).auth = authContext;
            }
            next();
        };
    }

    private setupRoutes(): void {
        // --- MCP endpoint ---
        const mcpPath = '/mcp';
        this.app.use(mcpPath, this.createAuthMiddleware(), (req, res) => {
            this.transport.handleRequest(req, res, req.body);
        });
        console.log(`[Transport] Streamable HTTP transport registered at ${mcpPath}`);

        // --- Existing non-MCP routes ---
        this.app.get('/.well-known/oauth-protected-resource', (_req, res) => {
            const response = this.wellKnownHandler.handleWellKnownRequest();
            res.status(response.status).set(response.headers).send(response.body);
        });

        this.app.get('/.well-known/oauth-authorization-server', (_req, res) => {
            const response = this.wellKnownHandler.handleAuthorizationServerMetadataRequest();
            res.status(response.status).set(response.headers).send(response.body);
        });

        this.app.post('/register', (req, res) => {
            const response = this.wellKnownHandler.handleRegistrationRequest(req.body);
            res.status(response.status).set(response.headers).send(response.body);
        });

        this.app.get('/authorize', (req, res) => {
            const params = new URLSearchParams();
            for (const [key, value] of Object.entries(req.query)) {
                if (typeof value === 'string') {
                    params.append(key, value);
                }
            }
            params.append('audience', this.config.oauthAudience);
            const originalScope = params.get('scope') || '';
            const apiScopes = ['marketdata', 'realtime', 'brokerage', 'orderexecution'];
            const existingScopes = originalScope ? originalScope.split(' ') : [];
            const oidcScopes = ['openid', 'profile'];
            const allScopes = [...new Set([...oidcScopes, ...existingScopes, ...apiScopes])];
            params.set('scope', allScopes.join(' '));
            const authorizeUrl = `${this.config.oauthIssuer}/authorize?${params.toString()}`;
            res.redirect(302, authorizeUrl);
        });

        this.app.post('/token', async (req, res) => {
            try {
                const tokenBody = { ...req.body, audience: this.config.oauthAudience };
                const requestBodyString = new URLSearchParams(tokenBody).toString();
                const tokenEndpoint = `${this.config.oauthIssuer}/oauth/token`;
                const response = await fetch(tokenEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: requestBodyString
                });
                const tokenData = await response.json();
                res.status(response.status).json(tokenData);
            } catch (error) {
                console.error('[OAuth] Token proxy error:', error);
                res.status(500).json({
                    error: 'token_request_failed',
                    error_description: 'Failed to proxy token request to OAuth provider'
                });
            }
        });

        this.app.get('/health', (_req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        });

        this.app.use('*', (_req, res) => {
            res.status(404).json({
                error: 'Not Found',
                message: 'Endpoint not found'
            });
        });

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
                console.log(`[HTTP Transport] MCP endpoint: http://localhost:${this.config.httpPort}/mcp`);
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