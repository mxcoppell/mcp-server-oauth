import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SubscribeRequestSchema, UnsubscribeRequestSchema, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { SERVER_INFO } from './config.js';
import { ServerConfig, AuthorizationContext } from './types/index.js';
import { registerTools } from './capabilities/tools.js';
import { registerResources, cleanupResourceSubscriptions } from './capabilities/resources.js';
import { registerPrompts } from './capabilities/prompts.js';

// Store subscription callbacks separately since they're not part of standard ResourceMetadata
interface SubscriptionCallbacks {
    onSubscribe?: (uri: string) => void;
    onUnsubscribe?: (uri: string) => void;
}

const subscriptionCallbacks = new Map<string, SubscriptionCallbacks>();

// Function to register subscription callbacks for a resource
export function registerResourceSubscriptionCallbacks(uri: string, callbacks: SubscriptionCallbacks): void {
    subscriptionCallbacks.set(uri, callbacks);
}

export class OAuthMcpServer {
    private server: McpServer;
    private config: ServerConfig;
    private authContext: AuthorizationContext | null;

    constructor(config: ServerConfig, authContext: AuthorizationContext | null = null) {
        this.config = config;
        this.authContext = authContext;
        this.server = new McpServer(SERVER_INFO, {
            capabilities: {
                resources: {
                    subscribe: true,
                    listChanged: true
                },
                tools: {},
                prompts: {},
                logging: {},
                experimental: {}
            }
        });

        this.setupEventHandlers();
        this.registerCapabilities();
    }

    private registerCapabilities(): void {
        // Register all capabilities with auth context
        registerTools(this.server, this.config, this.authContext);
        registerResources(this.server, this.config, this.authContext);
        registerPrompts(this.server, this.config, this.authContext);

        // Add custom subscription handlers that the SDK is missing
        this.setupSubscriptionHandlers();
    }

    private setupSubscriptionHandlers(): void {
        // Handler for resources/subscribe
        this.server.server.setRequestHandler(
            SubscribeRequestSchema,
            async (request) => {
                const { uri } = request.params;
                console.log(`[MCP Server] Received subscription request for: ${uri}`);

                // Find the subscription callbacks for this resource
                const callbacks = subscriptionCallbacks.get(uri);
                if (!callbacks || !callbacks.onSubscribe) {
                    throw new McpError(
                        ErrorCode.InvalidParams,
                        `Resource ${uri} is not streamable`
                    );
                }

                // Call the onSubscribe callback
                callbacks.onSubscribe(uri);

                console.log(`[MCP Server] Successfully subscribed to: ${uri}`);
                return {}; // Empty result
            }
        );

        // Handler for resources/unsubscribe
        this.server.server.setRequestHandler(
            UnsubscribeRequestSchema,
            async (request) => {
                const { uri } = request.params;
                console.log(`[MCP Server] Received unsubscription request for: ${uri}`);

                // Find the subscription callbacks for this resource
                const callbacks = subscriptionCallbacks.get(uri);
                if (!callbacks || !callbacks.onUnsubscribe) {
                    // Allow unsubscribe even if callbacks don't exist (graceful handling)
                    console.log(`[MCP Server] No unsubscribe callback for: ${uri}`);
                    return {}; // Empty result
                }

                // Call the onUnsubscribe callback
                callbacks.onUnsubscribe(uri);

                console.log(`[MCP Server] Successfully unsubscribed from: ${uri}`);
                return {}; // Empty result
            }
        );
    }

    private setupEventHandlers(): void {
        this.server.server.onerror = (error: Error) => {
            console.error('[MCP Server Error]', error);
        };

        this.server.server.onclose = () => {
            // For stdio transport, log to stderr to avoid interfering with JSON-RPC on stdout
            const log = this.config.transport === 'stdio' ? console.error : console.log;
            log('[MCP Server] Connection closed');
        };
    }

    getServer(): McpServer {
        return this.server;
    }

    getAuthContext(): AuthorizationContext | null {
        return this.authContext;
    }

    updateAuthContext(authContext: AuthorizationContext | null): void {
        this.authContext = authContext;
        // Re-register capabilities with updated auth context
        this.registerCapabilities();
    }

    async initialize(): Promise<void> {
        // For stdio transport, log to stderr to avoid interfering with JSON-RPC on stdout
        const log = this.config.transport === 'stdio' ? console.error : console.log;

        log(`[MCP Server] Initializing ${SERVER_INFO.name} v${SERVER_INFO.version}`);
        log(`[MCP Server] Transport: ${this.config.transport}`);
        log(`[MCP Server] Authentication: ${this.config.enableAuth ? 'enabled' : 'disabled'}`);

        if (this.config.transport === 'http') {
            log(`[MCP Server] HTTP Port: ${this.config.httpPort}`);
        }
    }

    async shutdown(): Promise<void> {
        // For stdio transport, log to stderr to avoid interfering with JSON-RPC on stdout
        const log = this.config.transport === 'stdio' ? console.error : console.log;
        log('[MCP Server] Shutting down...');

        // Clean up all active resource subscriptions
        cleanupResourceSubscriptions();

        await this.server.close();
    }
} 