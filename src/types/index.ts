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
    oauthJwtSecret: string;
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

export type TransportType = 'stdio' | 'http';

export interface TransportOptions {
    type: TransportType;
    config: ServerConfig;
    authContext?: AuthorizationContext;
} 