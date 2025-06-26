#!/usr/bin/env node

import { getServerConfig, validateConfig } from './config.js';
import { StdioTransport } from './transports/stdio.js';
import { HttpTransport } from './transports/http.js';

async function main() {
    try {
        const config = getServerConfig();
        validateConfig(config);

        console.log('🚀 Starting MCP OAuth Server');
        console.log(`Transport: ${config.transport}`);
        console.log(`Authentication: ${config.enableAuth ? 'enabled' : 'disabled'}`);

        let transport: StdioTransport | HttpTransport;

        switch (config.transport) {
            case 'stdio':
                transport = new StdioTransport(config);
                break;
            case 'http':
                transport = new HttpTransport(config);
                break;
            default:
                throw new Error(`Unsupported transport: ${config.transport}`);
        }

        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 Received SIGINT, shutting down gracefully...');
            await transport.stop();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
            await transport.stop();
            process.exit(0);
        });

        // Start the server
        await transport.start();

        // Keep the process alive for HTTP transport
        if (config.transport === 'http') {
            console.log('✅ HTTP server is running. Press Ctrl+C to stop.');
            // Keep alive
            process.stdin.resume();
        }

    } catch (error) {
        console.error('❌ Failed to start MCP server:', error);
        process.exit(1);
    }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error('❌ Unhandled error:', error);
        process.exit(1);
    });
} 