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

        console.log('[Stdio Transport] Starting MCP server on stdio transport...');

        // Connect the transport to the server
        await this.server.getServer().connect(this.transport);

        console.log('[Stdio Transport] MCP server started and listening on stdin/stdout');
    }

    async stop(): Promise<void> {
        console.log('[Stdio Transport] Stopping MCP server...');
        await this.server.shutdown();
        await this.transport.close();
    }
} 