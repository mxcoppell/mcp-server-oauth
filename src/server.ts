import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SERVER_INFO } from './config.js';
import { ServerConfig } from './types/index.js';
import { registerTools } from './capabilities/tools.js';
import { registerResources } from './capabilities/resources.js';
import { registerPrompts } from './capabilities/prompts.js';

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
        this.setupResourceSubscriptionHandlers();
    }

    private setupCapabilities(): void {
        const requireAuth = this.config.transport === 'http' && this.config.enableAuth;

        // Register all capabilities
        registerTools(this.mcpServer, requireAuth);
        registerResources(this.mcpServer, requireAuth);
        registerPrompts(this.mcpServer, requireAuth);
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

    private setupResourceSubscriptionHandlers(): void {

        // Handle resource subscription requests
        this.mcpServer.server.setRequestHandler(
            z.object({
                method: z.literal('resources/subscribe'),
                params: z.object({
                    uri: z.string()
                })
            }),
            async (request, _extra) => {
                const { uri } = request.params;
                const log = this.config.transport === 'stdio' ? console.error : console.log;
                log(`[MCP Server] Resource subscription requested for: ${uri}`);

                if (!uri.startsWith('stream://')) {
                    throw new Error('Only streaming resources support subscriptions');
                }

                // For now, return success - actual streaming would need a more complex implementation
                return {
                    _meta: {},
                    success: true
                };
            }
        );

        // Handle resource unsubscription requests
        this.mcpServer.server.setRequestHandler(
            z.object({
                method: z.literal('resources/unsubscribe'),
                params: z.object({
                    uri: z.string()
                })
            }),
            async (request, _extra) => {
                const { uri } = request.params;
                const log = this.config.transport === 'stdio' ? console.error : console.log;
                log(`[MCP Server] Resource unsubscription requested for: ${uri}`);

                return {
                    _meta: {},
                    success: true
                };
            }
        );
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
        await this.mcpServer.close();
    }
} 