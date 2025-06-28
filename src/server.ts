import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SERVER_INFO } from './config.js';
import { ServerConfig } from './types/index.js';
import { registerTools } from './capabilities/tools.js';
import { registerResources, cleanupResourceSubscriptions } from './capabilities/resources.js';
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
    }

    private setupCapabilities(): void {
        // Register all capabilities
        // Auth validation is now handled at transport level (http.ts middleware)
        registerTools(this.mcpServer);
        registerResources(this.mcpServer);
        registerPrompts(this.mcpServer);
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