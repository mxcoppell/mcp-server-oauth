export interface OAuthTokenPayload {
    sub: string;
    aud: string;
    iss: string;
    exp: number;
    iat: number;
    scope?: string;
    client_id?: string;
}

export interface AuthorizationContext {
    token?: string;
    payload?: OAuthTokenPayload;
    isAuthorized: boolean;
}

export interface ServerConfig {
    transport: 'stdio' | 'http';
    httpPort: number;
    oauthIssuer: string;
    oauthAudience: string;
    corsOrigin: string;
    enableAuth: boolean;
}

export interface MarketData {
    symbol: string;
    price: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: number;
}

export interface AccountInfo {
    accountId: string;
    name: string;
    balance: number;
    equity: number;
    buyingPower: number;
    positions: Position[];
}

export interface Position {
    symbol: string;
    quantity: number;
    averagePrice: number;
    marketValue: number;
    unrealizedPnL: number;
}

export interface StreamData {
    type: 'market_data' | 'account_update' | 'trade_execution';
    timestamp: number;
    data: MarketData | AccountInfo | any;
}

export interface WellKnownOAuthResource {
    resource: string;
    resource_name: string;
    authorization_servers: string[];
    scopes_supported: string[];
    bearer_methods_supported: string[];
}

export interface OAuthAuthorizationServerMetadata {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    registration_endpoint?: string;
    scopes_supported: string[];
    response_types_supported: string[];
    response_modes_supported: string[];
    grant_types_supported: string[];
    token_endpoint_auth_methods_supported: string[];
    code_challenge_methods_supported: string[];
}

export type TransportType = 'stdio' | 'http';

export interface TransportOptions {
    type: TransportType;
    config: ServerConfig;
    authContext?: AuthorizationContext;
} 