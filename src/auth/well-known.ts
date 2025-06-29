import { WellKnownOAuthResource, OAuthAuthorizationServerMetadata, ServerConfig } from '../types/index.js';

export class WellKnownHandler {
    private config: ServerConfig;

    constructor(config: ServerConfig) {
        this.config = config;
    }

    getOAuthResourceMetadata(): WellKnownOAuthResource {
        return {
            resource: this.config.oauthAudience,
            resource_name: "Trading API",
            authorization_servers: [
                `http://localhost:${this.config.httpPort}`
            ],
            scopes_supported: [
                "marketdata",
                "realtime",
                "brokerage",
                "orderexecution"
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
            issuer: this.config.oauthIssuer,
            authorization_endpoint: `http://localhost:${this.config.httpPort}/authorize`,
            token_endpoint: `${this.config.oauthIssuer}/oauth/token`,
            registration_endpoint: `http://localhost:${this.config.httpPort}/register`,
            scopes_supported: [
                "openid",
                "profile",
                "marketdata",
                "realtime",
                "brokerage",
                "orderexecution"
            ],
            response_types_supported: ["code"],
            response_modes_supported: ["query"],
            grant_types_supported: ["authorization_code", "refresh_token"],
            token_endpoint_auth_methods_supported: ["none"],
            code_challenge_methods_supported: ["S256"],
            // OAuth provider-specific extensions
            audience: this.config.oauthAudience,
            require_request_uri_registration: false,
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
        // Always returns the pre-configured Auth0 client ID

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

        // Use Auth0-compatible redirect URIs
        // MCP Inspector uses its own hardcoded callback URL regardless of what we return
        const auth0RedirectUris = [
            // MCP Inspector default callback URL
            "http://localhost:6274/oauth/callback",
            // MCP Inspector debug callback URL (actually being used)
            "http://localhost:6274/oauth/callback/debug"
        ];

        // If client provided redirect URIs, check if any match our allowed list
        let redirectUris = auth0RedirectUris;

        if (Array.isArray(requestBody.redirect_uris) && requestBody.redirect_uris.length > 0) {
            // Find intersection between requested URIs and our allowed URIs
            const requestedUris = requestBody.redirect_uris;
            const matchingUris = requestedUris.filter((uri: string) =>
                auth0RedirectUris.includes(uri)
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
            client_id: "E6nNx2Hlko4ZddCDAzdBqspgGWEP2Y2c",
            client_name: requestBody.client_name || "MCP Server OAuth",
            redirect_uris: redirectUris,
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
            scope: "openid profile marketdata realtime brokerage orderexecution",
            token_endpoint_auth_method: "none",  // PKCE - no client secret
            // OAuth provider-specific hints for MCP Inspector
            audience: this.config.oauthAudience,
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