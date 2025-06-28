import express from 'express';
import cors from 'cors';
import { Server } from 'http';
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
    private sseConnections: Map<string, express.Response> = new Map(); // Track SSE connections

    constructor(config: ServerConfig) {
        this.config = config;
        this.server = new OAuthMcpServer(config);
        this.app = express();
        this.tokenValidator = new TokenValidator(config);
        this.wellKnownHandler = new WellKnownHandler(config);

        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware(): void {
        // CORS configuration
        this.app.use(cors({
            origin: this.config.corsOrigin,
            credentials: true,
            methods: ['GET', 'POST', 'OPTIONS'],
            allowedHeaders: [
                'Content-Type',
                'Authorization',
                'mcp-protocol-version',
                'x-requested-with'
            ]
        }));

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Simple request logging (only for errors and debugging)
        this.app.use((req, _res, next) => {
            // Only log non-health check requests
            if (req.path !== '/health') {
                console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
            }
            next();
        });
    }

    private setupRoutes(): void {
        // Well-known OAuth resource endpoint
        this.app.get('/.well-known/oauth-protected-resource', (_req, res) => {
            const response = this.wellKnownHandler.handleWellKnownRequest();
            res.status(response.status).set(response.headers).send(response.body);
        });

        // OAuth authorization server metadata endpoint
        this.app.get('/.well-known/oauth-authorization-server', (_req, res) => {
            const response = this.wellKnownHandler.handleAuthorizationServerMetadataRequest();
            res.status(response.status).set(response.headers).send(response.body);
        });

        // Dynamic Client Registration endpoint (mock)
        this.app.post('/register', (req, res) => {
            console.log('[DCR] Client registration request received');
            const response = this.wellKnownHandler.handleRegistrationRequest(req.body);
            res.status(response.status).set(response.headers).send(response.body);
        });

        // Authorization proxy endpoint - adds audience parameter and API scopes for Auth0
        this.app.get('/authorize', (req, res) => {
            const params = new URLSearchParams();

            // Copy all original parameters
            for (const [key, value] of Object.entries(req.query)) {
                if (typeof value === 'string') {
                    params.append(key, value);
                }
            }

            // Add the required audience parameter using config
            params.append('audience', this.config.oauthAudience);

            // Extend the scope to include both OIDC scopes and API scopes
            const originalScope = params.get('scope') || '';
            const apiScopes = ['marketdata', 'realtime', 'brokerage', 'orderexecution'];

            // Parse existing scopes and add missing API scopes
            const existingScopes = originalScope ? originalScope.split(' ') : [];
            const oidcScopes = ['openid', 'profile'];

            // Combine all scopes, removing duplicates
            const allScopes = [...new Set([...oidcScopes, ...existingScopes, ...apiScopes])];
            const combinedScopes = allScopes.join(' ');

            params.set('scope', combinedScopes);

            // Redirect to OAuth issuer's authorize endpoint using config
            const authorizeUrl = `${this.config.oauthIssuer}/authorize?${params.toString()}`;
            console.log('[OAuth] Authorization redirect to:', this.config.oauthIssuer);
            res.redirect(302, authorizeUrl);
        });

        // Token proxy endpoint - adds audience parameter for OAuth provider
        this.app.post('/token', async (req, res) => {
            try {
                console.log('[OAuth] Token request received');

                // Add the audience parameter to the token request using config
                const tokenBody = {
                    ...req.body,
                    audience: this.config.oauthAudience
                };

                const requestBodyString = new URLSearchParams(tokenBody).toString();

                // Forward the request to OAuth provider's token endpoint using config
                const tokenEndpoint = `${this.config.oauthIssuer}/oauth/token`;
                const response = await fetch(tokenEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: requestBodyString
                });

                const tokenData = await response.json();

                if (response.ok) {
                    console.log('[OAuth] Token request successful');
                } else {
                    console.error('[OAuth] Token request failed:', response.status, tokenData);
                }

                // Forward the response back to the client
                res.status(response.status).json(tokenData);

            } catch (error) {
                console.error('[OAuth] Token proxy error:', error);
                res.status(500).json({
                    error: 'token_request_failed',
                    error_description: 'Failed to proxy token request to OAuth provider'
                });
            }
        });

        // Server-Sent Events endpoint for notifications
        this.app.get('/notifications', (req, res) => {
            if (this.config.enableAuth) {
                const authContext = this.tokenValidator.createAuthContext(req.headers.authorization);
                if (!authContext.isAuthorized) {
                    res.status(401).json({ error: 'Unauthorized' });
                    return;
                }
            }

            // Set SSE headers
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': this.config.corsOrigin || '*',
                'Access-Control-Allow-Credentials': 'true'
            });

            // Generate connection ID
            const connectionId = `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.sseConnections.set(connectionId, res);

            console.log(`[SSE] Client connected: ${connectionId}`);

            // Send initial connection message
            res.write(`data: ${JSON.stringify({
                type: 'connection',
                connectionId,
                timestamp: Date.now()
            })}\n\n`);

            // Handle client disconnect
            req.on('close', () => {
                console.log(`[SSE] Client disconnected: ${connectionId}`);
                this.sseConnections.delete(connectionId);
            });

            req.on('error', (error) => {
                console.error(`[SSE] Connection error for ${connectionId}:`, error);
                this.sseConnections.delete(connectionId);
            });
        });

        // Health check endpoint
        this.app.get('/health', (_req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        });

        // MCP POST endpoint for streamable HTTP transport
        this.app.post('/mcp', async (req, res) => {
            if (this.config.enableAuth) {
                console.log('[MCP Auth] Checking authorization header:', req.headers.authorization ? 'present' : 'missing');
                const authContext = this.tokenValidator.createAuthContext(req.headers.authorization);

                if (!authContext.isAuthorized) {
                    console.log('[MCP Auth] Authentication failed');

                    // Distinguish between initial connection vs capability requests
                    const method = req.body?.method;
                    const isInitialConnection = method === 'initialize';

                    if (isInitialConnection) {
                        // For initial connection: trigger OAuth flow with WWW-Authenticate header
                        console.log('[MCP Auth] Initial connection - triggering OAuth flow');
                        const wwwAuthenticate = this.tokenValidator.generateWWWAuthenticateHeader();
                        res.status(401)
                            .set('WWW-Authenticate', wwwAuthenticate)
                            .json({
                                error: 'Unauthorized',
                                message: 'Valid Bearer token required for initial connection'
                            });
                    } else {
                        // For capability requests: reject immediately without OAuth flow
                        console.log('[MCP Auth] Capability request - rejecting without OAuth flow');
                        res.status(401).json({
                            jsonrpc: '2.0',
                            id: req.body?.id || null,
                            error: {
                                code: -32001,
                                message: 'Unauthorized',
                                data: 'Valid Bearer token required'
                            }
                        });
                    }
                    return;
                }

                console.log('[MCP Auth] Authentication successful');
                // Attach auth context to request for MCP handlers
                (req as any).authContext = authContext;
            }

            try {
                console.log('[MCP] Handling JSON-RPC request:', JSON.stringify(req.body, null, 2));

                // Validate JSON-RPC 2.0 format
                if (!req.body || req.body.jsonrpc !== '2.0') {
                    console.log('[MCP] Invalid JSON-RPC format - missing or invalid jsonrpc field');
                    res.status(400).json({
                        jsonrpc: '2.0',
                        id: req.body?.id || null,
                        error: {
                            code: -32600,
                            message: 'Invalid Request',
                            data: 'Missing or invalid jsonrpc field'
                        }
                    });
                    return;
                }

                // Handle MCP protocol methods by delegating to the actual server
                const method = req.body.method;
                const id = req.body.id;
                const params = req.body.params || {};

                console.log('[MCP] Processing method:', JSON.stringify(method), 'with ID:', id);

                let response: any;

                // Handle specific MCP methods by delegating to the actual server
                switch (method) {
                    case 'notifications/initialized':
                        // This is a notification, just acknowledge receipt
                        console.log('[MCP] Client connection initialized');
                        response = null; // Notifications don't have responses
                        break;

                    case 'initialize':
                    case 'tools/list':
                    case 'tools/call':
                    case 'resources/list':
                    case 'resources/read':
                    case 'resources/subscribe':
                    case 'resources/unsubscribe':
                    case 'prompts/list':
                    case 'prompts/get':
                        // Delegate all methods to the actual MCP server for consistent capabilities
                        const result = await this.callServerMethod(method, params);
                        response = {
                            jsonrpc: '2.0',
                            id: id,
                            result: result
                        };
                        break;

                    default:
                        response = {
                            jsonrpc: '2.0',
                            id: id,
                            error: {
                                code: -32601,
                                message: 'Method not found',
                                data: `Unknown method: ${method}`
                            }
                        };
                }

                // Send response (null for notifications)
                if (response !== null) {
                    console.log('[MCP] Sending response:', JSON.stringify(response, null, 2));
                    res.json(response);
                } else {
                    // For notifications, send 204 No Content
                    res.status(204).send();
                }

                return;

            } catch (error) {
                console.error('[MCP] Request processing error:', error);
                res.status(500).json({
                    jsonrpc: '2.0',
                    id: req.body?.id || null,
                    error: {
                        code: -32603,
                        message: 'Internal error',
                        data: error instanceof Error ? error.message : 'Unknown error'
                    }
                });
                return;
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

    /**
     * Call a method on the MCP server directly using proper transport delegation
     */
    private async callServerMethod(method: string, params: any): Promise<any> {
        return new Promise((resolve, reject) => {
            try {
                // Create a persistent transport for notifications
                let responseHandled = false;
                const persistentTransport = {
                    send: async (message: any) => {
                        if (message.method === 'notifications/resources/updated') {
                            // Handle resource update notification - send via SSE
                            this.broadcastNotification({
                                type: 'resource_updated',
                                data: message.params
                            });
                            return;
                        }

                        if (!responseHandled) {
                            responseHandled = true;
                            if (message.error) {
                                reject(new Error(message.error.message || 'Server error'));
                            } else {
                                resolve(message.result);
                            }
                        }
                    },
                    onmessage: undefined as any,
                    onerror: undefined as any,
                    onclose: undefined as any,
                    start: async () => { },
                    close: async () => { }
                };

                // Connect and send the request
                const mcpServer = this.server.getServer();
                mcpServer.connect(persistentTransport).then(() => {
                    // Send the method call through the transport
                    if (persistentTransport.onmessage) {
                        persistentTransport.onmessage({
                            jsonrpc: '2.0',
                            id: 1,
                            method: method,
                            params: params
                        });
                    }
                }).catch(reject);

                // Set timeout
                setTimeout(() => {
                    if (!responseHandled) {
                        responseHandled = true;
                        reject(new Error('Request timeout'));
                    }
                }, 10000);

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Broadcast notification to all connected SSE clients
     */
    private broadcastNotification(notification: any): void {
        const message = `data: ${JSON.stringify(notification)}\n\n`;

        for (const [connectionId, res] of this.sseConnections.entries()) {
            try {
                res.write(message);
                console.log(`[SSE] Notification sent to ${connectionId}`);
            } catch (error) {
                console.error(`[SSE] Failed to send notification to ${connectionId}:`, error);
                this.sseConnections.delete(connectionId);
            }
        }
    }

    async start(): Promise<void> {
        await this.server.initialize();

        return new Promise((resolve, reject) => {
            this.httpServer = this.app.listen(this.config.httpPort, () => {
                console.log(`[HTTP Transport] MCP server started on port ${this.config.httpPort}`);
                console.log(`[HTTP Transport] OAuth well-known endpoint: http://localhost:${this.config.httpPort}/.well-known/oauth-protected-resource`);
                console.log(`[HTTP Transport] MCP endpoint: http://localhost:${this.config.httpPort}/mcp`);
                console.log(`[HTTP Transport] SSE notifications: http://localhost:${this.config.httpPort}/notifications`);
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

        // Close all SSE connections
        for (const [connectionId, res] of this.sseConnections.entries()) {
            try {
                res.end();
                console.log(`[HTTP Transport] Closed SSE connection: ${connectionId}`);
            } catch (error) {
                console.error(`[HTTP Transport] Error closing SSE connection ${connectionId}:`, error);
            }
        }
        this.sseConnections.clear();

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