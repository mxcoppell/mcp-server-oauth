import { ServerConfig } from './types/index.js';

const env = process.env;

export function getServerConfig(): ServerConfig {
    return {
        transport: (env.MCP_TRANSPORT as 'stdio' | 'http') || 'stdio',
        httpPort: parseInt(env.MCP_HTTP_PORT || '6060', 10),
        oauthIssuer: env.OAUTH_ISSUER || 'https://mxcoppell.us.auth0.com',
        oauthAudience: env.OAUTH_AUDIENCE || 'https://fancy-api.trading',
        corsOrigin: env.CORS_ORIGIN || '*',
        enableAuth: env.ENABLE_AUTH !== 'false',
    };
}

export function validateConfig(config: ServerConfig): void {
    if (!config.transport || !['stdio', 'http'].includes(config.transport)) {
        throw new Error('Invalid transport type. Must be "stdio" or "http"');
    }

    if (config.transport === 'http' && !config.httpPort) {
        throw new Error('HTTP port must be specified for HTTP transport');
    }


}

export const SERVER_INFO = {
    name: 'mcp-server-oauth',
    version: '1.0.0',
    description: 'MCP Server with OAuth 2.1 Authorization',
    vendor: 'MCP OAuth Example',
    protocolVersion: '2025-03-26',
} as const; 