import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SubscribeRequestSchema, UnsubscribeRequestSchema, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { SERVER_INFO } from './config.js';
import { ServerConfig } from './types/index.js';
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
    private mcpServer: McpServer;
    private config: ServerConfig;

    constructor(config: ServerConfig) {
        this.config = config;
        this.mcpServer = new McpServer(
            {
                name: SERVER_INFO.name,
                version: SERVER_INFO.version,
                description: SERVER_INFO.description,
                vendor: SERVER_INFO.vendor,
                protocolVersion: SERVER_INFO.protocolVersion,
            },
            {
                capabilities: {
                    tools: {},
                    resources: {
                        subscribe: true,
                        listChanged: true
                    },
                    prompts: {},
                    logging: {},
                },
            }
        );

        this.setupCapabilities();
        this.setupEventHandlers();
    }

    private setupCapabilities(): void {
        // Register all capabilities
        // Auth validation is now handled at transport level (http.ts middleware)
        registerTools(this.mcpServer);
        registerResources(this.mcpServer);
        registerPrompts(this.mcpServer);

        // Add custom subscription handlers that the SDK is missing
        this.setupSubscriptionHandlers();
    }

    private setupSubscriptionHandlers(): void {
        // Handler for resources/subscribe
        this.mcpServer.server.setRequestHandler(
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
        this.mcpServer.server.setRequestHandler(
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
        this.mcpServer.server.onerror = (error: Error) => {
            console.error('[MCP Server Error]', error);
        };

        this.mcpServer.server.onclose = () => {
            // For stdio transport, log to stderr to avoid interfering with JSON-RPC on stdout
            const log = this.config.transport === 'stdio' ? console.error : console.log;
            log('[MCP Server] Connection closed');
        };
    }

    getServer(): McpServer {
        return this.mcpServer;
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

        await this.mcpServer.close();
    }
} 