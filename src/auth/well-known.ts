import { WellKnownOAuthResource, ServerConfig } from '../types/index.js';

export class WellKnownHandler {
    private config: ServerConfig;

    constructor(config: ServerConfig) {
        this.config = config;
    }

    getOAuthResourceMetadata(): WellKnownOAuthResource {
        return {
            resource: this.config.oauthAudience,
            authorization_server: this.config.oauthIssuer,
            scopes_supported: [
                'read:account',
                'read:market_data',
                'trade:execute',
                'stream:market_feed'
            ],
            bearer_methods_supported: [
                'header',
                'body'
            ],
            resource_documentation: 'https://api.tradestation.com/docs/oauth'
        };
    }

    handleWellKnownRequest(): { status: number; headers: Record<string, string>; body: string } {
        const metadata = this.getOAuthResourceMetadata();

        return {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=3600',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: JSON.stringify(metadata, null, 2)
        };
    }
} 