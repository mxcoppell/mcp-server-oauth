import express from 'express';
import cors from 'cors';
import { Server } from 'http';
import { OAuthMcpServer } from '../server.js';
import { ServerConfig } from '../types/index.js';
import { TokenValidator } from '../auth/validator.js';
import { WellKnownHandler } from '../auth/well-known.js';
import {
    StreamableHTTPServerTransport
} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

export class HttpTransport {
    private app: express.Application;
    private httpServer: Server | null = null;
    private config: ServerConfig;
    private tokenValidator: TokenValidator;
    private wellKnownHandler: WellKnownHandler;
    private sessions = new Map<string, StreamableHTTPServerTransport>();

    constructor(config: ServerConfig) {
        this.config = config;
        this.app = express();
        this.tokenValidator = new TokenValidator(config);
        this.wellKnownHandler = new WellKnownHandler(config);
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
        this.app.all('/mcp', this.createAuthMiddleware(), async (req, res) => {
            try {
                if (req.method === 'GET') {
                    // Handle SSE connection - only for existing sessions
                    const sessionId = req.headers['mcp-session-id'] as string;

                    if (!sessionId) {
                        res.status(400).json({
                            jsonrpc: '2.0',
                            error: { code: -32000, message: 'Bad Request: Mcp-Session-Id header is required for GET requests' },
                            id: null
                        });
                        return;
                    }

                    const transport = this.sessions.get(sessionId);
                    if (!transport) {
                        res.status(404).json({
                            jsonrpc: '2.0',
                            error: { code: -32001, message: 'Session not found' },
                            id: null
                        });
                        return;
                    }

                    console.log(`Received GET message for sessionId ${sessionId}`);
                    await transport.handleRequest(req, res);

                } else if (req.method === 'POST') {
                    // Handle JSON-RPC requests
                    const sessionId = req.headers['mcp-session-id'] as string;
                    console.log(`Received POST message for sessionId ${sessionId || 'none'}`);

                    // Check if this is an initialization request
                    const isInitRequest = isInitializeRequest(req.body);

                    if (sessionId && this.sessions.has(sessionId)) {
                        // Use existing session
                        const transport = this.sessions.get(sessionId)!;
                        await transport.handleRequest(req, res);
                    } else if (!sessionId && isInitRequest) {
                        // New initialization request - create new session
                        const transport = new StreamableHTTPServerTransport({
                            sessionIdGenerator: () => randomUUID(),
                            onsessioninitialized: (newSessionId) => {
                                console.log(`Session initialized with ID: ${newSessionId}`);
                                this.sessions.set(newSessionId, transport);
                            }
                        });

                        // Set up cleanup handler
                        transport.onclose = () => {
                            const sid = transport.sessionId;
                            if (sid && this.sessions.has(sid)) {
                                console.log(`Transport closed for session ${sid}, removing from sessions map`);
                                this.sessions.delete(sid);
                            }
                        };

                        // Create a new server instance for this session
                        const sessionServer = new OAuthMcpServer(this.config);
                        await sessionServer.getServer().connect(transport);

                        await transport.handleRequest(req, res);
                    } else {
                        // Invalid request - no session ID and not initialization, or invalid session ID
                        res.status(400).json({
                            jsonrpc: '2.0',
                            error: {
                                code: -32000,
                                message: sessionId ? 'Session not found' : 'Bad Request: No valid session ID provided'
                            },
                            id: null
                        });
                        return;
                    }
                } else {
                    res.status(405).json({ error: 'Method not allowed' });
                }
            } catch (error) {
                console.error('Error handling MCP request:', error);
                res.status(500).json({
                    jsonrpc: '2.0',
                    error: { code: -32603, message: 'Internal error' },
                    id: null
                });
            }
        });
        console.log(`[Transport] Streamable HTTP transport registered at /mcp`);

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
        const port = this.config.httpPort || 6060;

        return new Promise((resolve, reject) => {
            try {
                this.httpServer = this.app.listen(port, () => {
                    console.log(`🚀 MCP OAuth Server running on http://localhost:${port}`);
                    console.log(`📋 Available endpoints:`);
                    console.log(`   • GET  /mcp - MCP streamable HTTP endpoint`);
                    console.log(`   • POST /mcp - MCP JSON-RPC endpoint`);
                    console.log(`   • GET  /.well-known/oauth-authorization-server - OAuth metadata`);
                    console.log(`   • POST /oauth/register - Dynamic client registration`);
                    console.log(`   • GET  /oauth/authorize - OAuth authorization`);
                    console.log(`   • POST /oauth/token - OAuth token exchange`);
                    console.log(`   • POST /oauth/revoke - OAuth token revocation`);
                    resolve();
                });

                this.httpServer.on('error', (error) => {
                    console.error('HTTP server error:', error);
                    reject(error);
                });
            } catch (error) {
                console.error('Failed to start HTTP server:', error);
                reject(error);
            }
        });
    }

    async stop(): Promise<void> {
        console.log('[HTTP Transport] Stopping MCP server...');

        // Clean up all transport sessions
        for (const [sessionId, transport] of this.sessions) {
            try {
                await transport.close();
            } catch (error) {
                console.error(`[HTTP Transport] Error closing session ${sessionId}:`, error);
            }
        }
        this.sessions.clear();

        // Close the HTTP server
        if (this.httpServer) {
            return new Promise<void>((resolve, reject) => {
                this.httpServer!.close((error) => {
                    if (error) {
                        console.error('[HTTP Transport] Error closing HTTP server:', error);
                        reject(error);
                    } else {
                        console.log('[HTTP Transport] HTTP server closed successfully');
                        resolve();
                    }
                });

                // Force close after 5 seconds if graceful close doesn't work
                setTimeout(() => {
                    console.log('[HTTP Transport] Force closing HTTP server...');
                    this.httpServer!.closeAllConnections?.();
                    resolve();
                }, 5000);
            });
        }
    }
} 