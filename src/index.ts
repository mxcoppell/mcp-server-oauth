#!/usr/bin/env node

import { getServerConfig, validateConfig } from './config.js';
import { StdioTransport } from './transports/stdio.js';
import { HttpTransport } from './transports/http.js';
import { cleanupResourceSubscriptions } from './capabilities/resources.js';

async function main() {
    try {
        const config = getServerConfig();
        validateConfig(config);

        // For stdio transport, log to stderr to avoid interfering with JSON-RPC on stdout
        const log = config.transport === 'stdio' ? console.error : console.log;

        log('🚀 Starting MCP OAuth Server');
        log(`Transport: ${config.transport}`);
        log(`Authentication: ${config.enableAuth ? 'enabled' : 'disabled'}`);

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
            log('\n🛑 Received SIGINT, shutting down gracefully...');
            cleanupResourceSubscriptions();
            await transport.stop();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            log('\n🛑 Received SIGTERM, shutting down gracefully...');
            cleanupResourceSubscriptions();
            await transport.stop();
            process.exit(0);
        });

        // Start the server
        await transport.start();

        // Keep the process alive for HTTP transport
        if (config.transport === 'http') {
            log('✅ HTTP server is running. Press Ctrl+C to stop.');
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