import { ServerConfig } from './types/index.js';

const env = process.env;

export function getServerConfig(): ServerConfig {
    return {
        transport: (env.MCP_TRANSPORT as 'stdio' | 'http') || 'stdio',
        httpPort: parseInt(env.MCP_HTTP_PORT || '6060', 10),
        oauthIssuer: env.OAUTH_ISSUER || '',
        oauthAudience: env.OAUTH_AUDIENCE || '',
        oauthClientId: env.OAUTH_CLIENT_ID || '',
        oauthResourceName: env.OAUTH_RESOURCE_NAME || 'API Resource',
        oauthApiScopes: (env.OAUTH_API_SCOPES || 'openid,profile').split(',').map(s => s.trim()),
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

    if (config.enableAuth && config.transport === 'http') {
        if (!config.oauthIssuer) {
            throw new Error('OAUTH_ISSUER environment variable is required when authentication is enabled');
        }
        if (!config.oauthAudience) {
            throw new Error('OAUTH_AUDIENCE environment variable is required when authentication is enabled');
        }
        if (!config.oauthClientId) {
            throw new Error('OAUTH_CLIENT_ID environment variable is required when authentication is enabled');
        }
    }
}

export const SERVER_INFO = {
    name: 'mcp-server-oauth',
    version: '1.0.0',
    description: 'MCP Server with OAuth 2.1 Authorization',
    vendor: 'MCP OAuth Example',
    protocolVersion: '2025-03-26',
} as const; 