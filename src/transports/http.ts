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
                    const wwwAuthenticate = this.tokenValidator.generateWWWAuthenticateHeader();
                    res.status(401)
                        .set('WWW-Authenticate', wwwAuthenticate)
                        .json({
                            error: 'Unauthorized',
                            message: 'Valid Bearer token required'
                        });
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

                // Handle MCP protocol methods
                const method = req.body.method;
                const id = req.body.id;
                // const params = req.body.params || {}; // For future use with method parameters

                console.log('[MCP] Processing method:', JSON.stringify(method), 'with ID:', id);
                console.log('[MCP] Full request body:', JSON.stringify(req.body, null, 2));

                // Handle initialize specially since it needs protocol negotiation
                if (method === 'initialize') {
                    console.log('[MCP] Handling initialize request');
                    const initializeResponse = {
                        jsonrpc: '2.0',
                        id: id,
                        result: {
                            protocolVersion: '2025-03-26',
                            capabilities: {
                                resources: {
                                    subscribe: true,
                                    listChanged: true
                                },
                                tools: {
                                    listChanged: true
                                },
                                prompts: {
                                    listChanged: true
                                },
                                logging: {}
                            },
                            serverInfo: {
                                name: 'oauth-mcp-server',
                                version: '1.0.0'
                            }
                        }
                    };
                    console.log('[MCP] Sending initialize response:', JSON.stringify(initializeResponse, null, 2));
                    res.json(initializeResponse);
                    return;
                }

                // Handle notifications/initialized
                if (method === 'notifications/initialized') {
                    console.log('[MCP] Handling notifications/initialized notification');
                    // Notifications don't require responses per MCP spec, but for HTTP transport
                    // we still need to acknowledge receipt with a 200 status
                    res.status(200).json({ success: true });
                    return;
                }

                // Handle specific MCP methods
                switch (method) {
                    case 'resources/list':
                        console.log('[MCP] Handling resources/list request');
                        res.json({
                            jsonrpc: '2.0',
                            id: id,
                            result: {
                                resources: [
                                    {
                                        uri: 'trading://account',
                                        name: 'Account Information',
                                        description: 'Current trading account information including balance and positions',
                                        mimeType: 'application/json'
                                    },
                                    {
                                        uri: 'trading://positions',
                                        name: 'Trading Positions',
                                        description: 'Current open trading positions',
                                        mimeType: 'application/json'
                                    }
                                ]
                            }
                        });
                        return;

                    case 'resources/read':
                        console.log('[MCP] Handling resources/read request');
                        const resourceUri = req.body.params?.uri;
                        let resourceContent = {};

                        if (resourceUri === 'trading://account') {
                            resourceContent = {
                                account: 'demo-account',
                                balance: 50000,
                                currency: 'USD',
                                status: 'active'
                            };
                        } else if (resourceUri === 'trading://positions') {
                            resourceContent = {
                                positions: [
                                    { symbol: 'AAPL', quantity: 100, price: 150.00 },
                                    { symbol: 'GOOGL', quantity: 50, price: 2800.00 }
                                ]
                            };
                        } else {
                            resourceContent = { error: 'Resource not found' };
                        }

                        res.json({
                            jsonrpc: '2.0',
                            id: id,
                            result: {
                                contents: [
                                    {
                                        uri: resourceUri || 'trading://account',
                                        mimeType: 'application/json',
                                        text: JSON.stringify(resourceContent, null, 2)
                                    }
                                ]
                            }
                        });
                        return;

                    case 'tools/list':
                        console.log('[MCP] Handling tools/list request');
                        res.json({
                            jsonrpc: '2.0',
                            id: id,
                            result: {
                                tools: [
                                    {
                                        name: 'place_order',
                                        description: 'Place a trading order',
                                        inputSchema: {
                                            type: 'object',
                                            properties: {
                                                symbol: { type: 'string', description: 'Stock symbol' },
                                                quantity: { type: 'number', description: 'Number of shares' },
                                                side: { type: 'string', enum: ['buy', 'sell'] }
                                            },
                                            required: ['symbol', 'quantity', 'side']
                                        }
                                    },
                                    {
                                        name: 'get_quote',
                                        description: 'Get current stock quote',
                                        inputSchema: {
                                            type: 'object',
                                            properties: {
                                                symbol: { type: 'string', description: 'Stock symbol' }
                                            },
                                            required: ['symbol']
                                        }
                                    }
                                ]
                            }
                        });
                        return;

                    case 'tools/call':
                        console.log('[MCP] Handling tools/call request');
                        const toolName = req.body.params?.name;
                        const toolArgs = req.body.params?.arguments || {};

                        let toolResult = '';
                        if (toolName === 'place_order') {
                            toolResult = `Order placed: ${toolArgs.side} ${toolArgs.quantity} shares of ${toolArgs.symbol}`;
                        } else if (toolName === 'get_quote') {
                            toolResult = `Current price of ${toolArgs.symbol}: $${(Math.random() * 300 + 100).toFixed(2)}`;
                        } else {
                            toolResult = `Tool "${toolName}" executed with arguments: ${JSON.stringify(toolArgs)}`;
                        }

                        res.json({
                            jsonrpc: '2.0',
                            id: id,
                            result: {
                                content: [
                                    {
                                        type: 'text',
                                        text: toolResult
                                    }
                                ]
                            }
                        });
                        return;

                    case 'prompts/list':
                        console.log('[MCP] Handling prompts/list request');
                        res.json({
                            jsonrpc: '2.0',
                            id: id,
                            result: {
                                prompts: [
                                    {
                                        name: 'trading_analysis',
                                        description: 'Analyze trading portfolio and provide recommendations',
                                        arguments: [
                                            {
                                                name: 'symbol',
                                                description: 'Stock symbol to analyze',
                                                required: false
                                            }
                                        ]
                                    },
                                    {
                                        name: 'risk_assessment',
                                        description: 'Assess portfolio risk and suggest improvements',
                                        arguments: []
                                    }
                                ]
                            }
                        });
                        return;

                    case 'prompts/get':
                        console.log('[MCP] Handling prompts/get request');
                        const promptName = req.body.params?.name;
                        const promptArgs = req.body.params?.arguments || {};

                        let promptMessages: any[] = [];
                        if (promptName === 'trading_analysis') {
                            const symbol = promptArgs.symbol || 'your portfolio';
                            promptMessages = [
                                {
                                    role: 'user',
                                    content: {
                                        type: 'text',
                                        text: `Please analyze ${symbol} and provide trading recommendations based on current market conditions.`
                                    }
                                }
                            ];
                        } else if (promptName === 'risk_assessment') {
                            promptMessages = [
                                {
                                    role: 'user',
                                    content: {
                                        type: 'text',
                                        text: 'Analyze my current portfolio risk exposure and suggest risk management strategies.'
                                    }
                                }
                            ];
                        }

                        res.json({
                            jsonrpc: '2.0',
                            id: id,
                            result: {
                                description: `Trading prompt: ${promptName}`,
                                messages: promptMessages
                            }
                        });
                        return;

                    case 'completion/complete':
                        console.log('[MCP] Handling completion/complete request');
                        const completionRef = req.body.params?.ref;
                        const argument = completionRef?.name || '';

                        let completionValues = [];
                        if (argument === 'symbol' || argument.includes('symbol')) {
                            completionValues = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'META'];
                        } else if (argument === 'side') {
                            completionValues = ['buy', 'sell'];
                        } else {
                            completionValues = ['suggestion1', 'suggestion2', 'suggestion3'];
                        }

                        res.json({
                            jsonrpc: '2.0',
                            id: id,
                            result: {
                                completion: {
                                    values: completionValues,
                                    total: completionValues.length,
                                    hasMore: false
                                }
                            }
                        });
                        return;

                    default:
                        console.log('[MCP] Unknown method:', method);
                        res.json({
                            jsonrpc: '2.0',
                            id: id,
                            error: {
                                code: -32601,
                                message: 'Method not found'
                            }
                        });
                        return;
                }

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