import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { OAuthMcpServer } from '../server.js';
import { ServerConfig } from '../types/index.js';

export class StdioTransport {
    private server: OAuthMcpServer;
    private transport: StdioServerTransport;

    constructor(config: ServerConfig) {
        this.server = new OAuthMcpServer(config);
        this.transport = new StdioServerTransport();
    }

    async start(): Promise<void> {
        await this.server.initialize();

        // For stdio transport, log to stderr to avoid interfering with JSON-RPC on stdout
        console.error('[Stdio Transport] Starting MCP server on stdio transport...');

        // Connect the transport to the server
        await this.server.getServer().connect(this.transport);

        console.error('[Stdio Transport] MCP server started and listening on stdin/stdout');
    }

    async stop(): Promise<void> {
        // For stdio transport, log to stderr to avoid interfering with JSON-RPC on stdout
        console.error('[Stdio Transport] Stopping MCP server...');
        await this.server.shutdown();
        await this.transport.close();
    }
} 