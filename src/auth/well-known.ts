import { WellKnownOAuthResource } from '../types/index.js';

export class WellKnownHandler {
    constructor() {
        // No config needed - using spec-required hardcoded values
    }

    getOAuthResourceMetadata(): WellKnownOAuthResource {
        return {
            resource: "https://api.tradestation.com/",
            resource_name: "TradeStation API",
            authorization_servers: [
                "https://signin.tradestation.com/"
            ],
            scopes_supported: [
                "openid",
                "profile",
                "ReadAccount",
                "Trade",
                "TradeStation",
                "MarketData",
                "News",
                "Matrix",
                "OptionSpreads",
                "offline_access",
                "HotLists"
            ],
            bearer_methods_supported: ["header"]
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