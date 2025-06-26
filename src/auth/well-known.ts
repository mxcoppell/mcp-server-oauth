import { WellKnownOAuthResource, OAuthAuthorizationServerMetadata } from '../types/index.js';

export class WellKnownHandler {
    constructor() {
        // No config needed - using spec-required hardcoded values
    }

    getOAuthResourceMetadata(): WellKnownOAuthResource {
        return {
            resource: "https://api.tradestation.com/",
            resource_name: "TradeStation API",
            authorization_servers: [
                "http://localhost:6060"
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

    getOAuthAuthorizationServerMetadata(): OAuthAuthorizationServerMetadata {
        return {
            issuer: "http://localhost:6060",
            authorization_endpoint: "https://signin.tradestation.com/authorize",
            token_endpoint: "https://signin.tradestation.com/oauth/token",
            registration_endpoint: "http://localhost:6060/register",
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
            response_types_supported: ["code"],
            response_modes_supported: ["query"],
            grant_types_supported: ["authorization_code", "refresh_token"],
            token_endpoint_auth_methods_supported: ["none"],
            code_challenge_methods_supported: ["S256"]
        };
    }

    handleAuthorizationServerMetadataRequest(): { status: number; headers: Record<string, string>; body: string } {
        const metadata = this.getOAuthAuthorizationServerMetadata();

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

    handleRegistrationRequest(requestBody: any): { status: number; headers: Record<string, string>; body: string } {
        // Mock Dynamic Client Registration endpoint for PKCE public clients
        // Always returns the pre-configured TradeStation client ID

        // Validate request body
        if (!requestBody || typeof requestBody !== 'object') {
            return {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                },
                body: JSON.stringify({
                    error: "invalid_request",
                    error_description: "Request body must be a JSON object"
                }, null, 2)
            };
        }

        // Use TradeStation-compatible redirect URIs
        // MCP Inspector uses its own hardcoded callback URL regardless of what we return
        const tradeStationRedirectUris = [
            // Actual TradeStation redirect URI (confirmed from Auth0 config)
            "https://signin.tradestation.com/login/callback"
        ];

        // If client provided redirect URIs, check if any match our allowed list
        let redirectUris = tradeStationRedirectUris;

        if (Array.isArray(requestBody.redirect_uris) && requestBody.redirect_uris.length > 0) {
            // Find intersection between requested URIs and our allowed URIs
            const requestedUris = requestBody.redirect_uris;
            const matchingUris = requestedUris.filter((uri: string) =>
                tradeStationRedirectUris.includes(uri)
            );

            if (matchingUris.length > 0) {
                redirectUris = matchingUris;
                console.log(`[DCR] Using client-requested redirect URIs: ${matchingUris.join(', ')}`);
            } else {
                console.log(`[DCR] Client requested URIs not in allowed list, using defaults: ${requestedUris.join(', ')}`);
            }
        }

        // Registration response optimized for PKCE public clients
        const registrationResponse = {
            client_id: "Sg8Fa1mdIC7IAEYxbHw6wZn4gzjLccl7",
            client_name: requestBody.client_name || "MCP Inspector",
            redirect_uris: redirectUris,
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
            scope: "openid profile ReadAccount Trade TradeStation MarketData News Matrix OptionSpreads offline_access HotLists",
            token_endpoint_auth_method: "none",  // PKCE - no client secret
            // Note: No client_secret returned - this is a public client using PKCE
        };

        console.log(`[DCR] Registered client: ${registrationResponse.client_name} with redirect URIs: ${redirectUris.join(', ')}`);

        return {
            status: 201,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: JSON.stringify(registrationResponse, null, 2)
        };
    }
} 