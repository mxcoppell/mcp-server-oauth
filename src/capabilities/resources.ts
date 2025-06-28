import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AccountInfo, MarketData, ServerConfig, AuthorizationContext } from '../types/index.js';
import { registerResourceSubscriptionCallbacks } from '../server.js';

const accountCache = new Map<string, { data: AccountInfo; timestamp: number }>();
const subscriptions = new Map<string, NodeJS.Timeout>(); // Track active subscriptions
const CACHE_TTL = 30000; // 30 seconds

export function registerResources(
    server: McpServer,
    config: ServerConfig,
    authContext: AuthorizationContext | null
): void {
    // Authentication Token Information Resource
    server.resource(
        'Authentication Token Info',
        'auth://token/info',
        {
            description: 'Display current authentication token information and decoded claims',
            mimeType: 'application/json'
        },
        async (uri: URL) => {
            if (config.transport === 'stdio') {
                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify({
                            transport: 'stdio',
                            message: 'No authentication token for stdio transport',
                            timestamp: new Date().toISOString()
                        }, null, 2),
                        mimeType: 'application/json'
                    }]
                };
            }

            if (!config.enableAuth) {
                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify({
                            transport: 'http',
                            message: 'Authentication is disabled for this server',
                            timestamp: new Date().toISOString()
                        }, null, 2),
                        mimeType: 'application/json'
                    }]
                };
            }

            if (!authContext?.isAuthorized) {
                const errorInfo = {
                    transport: 'http',
                    authenticated: false,
                    message: authContext?.token ? 'Invalid or expired token' : 'No authentication token provided',
                    timestamp: new Date().toISOString()
                };

                if (authContext?.token) {
                    errorInfo.message += ' - token was provided but failed validation';
                }

                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify(errorInfo, null, 2),
                        mimeType: 'application/json'
                    }]
                };
            }

            // Valid auth context with decoded token
            const tokenInfo = {
                transport: 'http',
                authenticated: true,
                token: {
                    subject: authContext.payload?.sub,
                    issuer: authContext.payload?.iss,
                    audience: authContext.payload?.aud,
                    issuedAt: authContext.payload?.iat ? new Date(authContext.payload.iat * 1000).toISOString() : undefined,
                    expiresAt: authContext.payload?.exp ? new Date(authContext.payload.exp * 1000).toISOString() : undefined,
                    scope: authContext.payload?.scope,
                    clientId: authContext.payload?.client_id,
                    timeUntilExpiry: authContext.payload?.exp ?
                        Math.max(0, authContext.payload.exp - Math.floor(Date.now() / 1000)) + ' seconds' : undefined
                },
                timestamp: new Date().toISOString()
            };

            return {
                contents: [{
                    uri: uri.href,
                    text: JSON.stringify(tokenInfo, null, 2),
                    mimeType: 'application/json'
                }]
            };
        }
    );

    // Non-streamable resource: Account Information
    server.resource(
        'Account Information',
        'account://info/ACC001',
        {
            description: 'Get detailed account information and portfolio summary',
            mimeType: 'application/json'
        },
        async (uri: URL) => {
            const cacheKey = uri.toString();
            const cached = accountCache.get(cacheKey);

            if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify(cached.data, null, 2),
                        mimeType: 'application/json'
                    }]
                };
            }

            const accountInfo: AccountInfo = {
                accountId: 'ACC001',
                name: 'Main Trading Account',
                balance: 125750.43,
                equity: 98320.12,
                buyingPower: 27430.31,
                positions: [
                    { symbol: 'AAPL', quantity: 50, averagePrice: 175.23, marketValue: 8761.50, unrealizedPnL: 1234.56 },
                    { symbol: 'GOOGL', quantity: 25, averagePrice: 142.18, marketValue: 3554.50, unrealizedPnL: -123.45 },
                    { symbol: 'MSFT', quantity: 75, averagePrice: 378.85, marketValue: 28413.75, unrealizedPnL: 567.89 }
                ]
            };

            accountCache.set(cacheKey, { data: accountInfo, timestamp: Date.now() });

            return {
                contents: [{
                    uri: uri.href,
                    text: JSON.stringify(accountInfo, null, 2),
                    mimeType: 'application/json'
                }]
            };
        }
    );

    // Streamable resource: Market Data Stream
    const streamUri = 'stream://market/AAPL';

    // Register the resource (without subscription callbacks in metadata)
    server.resource(
        'Market Data Stream',
        streamUri,
        {
            description: 'Real-time market data stream for AAPL. Supports subscriptions for live updates.',
            mimeType: 'application/json'
        },
        async (uri: URL) => { // Read handler
            const marketData = generateMarketData('AAPL');
            return {
                contents: [{
                    uri: uri.toString(),
                    mimeType: 'application/json',
                    text: JSON.stringify(marketData, null, 2)
                }]
            };
        }
    );

    // Register subscription callbacks separately
    registerResourceSubscriptionCallbacks(streamUri, {
        onSubscribe: (uri: string) => {
            console.log(`[Resources] Client SUBscribed to: ${uri}`);
            if (subscriptions.has(uri)) {
                clearInterval(subscriptions.get(uri));
            }
            const interval = setInterval(() => {
                console.log(`[Resources] Sending update for: ${uri}`);
                server.server.sendResourceUpdated({ uri });
            }, 2000);
            subscriptions.set(uri, interval);
        },
        onUnsubscribe: (uri: string) => {
            console.log(`[Resources] Client UNsubscribed from: ${uri}`);
            if (subscriptions.has(uri)) {
                clearInterval(subscriptions.get(uri));
                subscriptions.delete(uri);
                console.log(`[Resources] Stopped streaming for: ${uri}`);
            }
        }
    });
}

function generateMarketData(symbol: string): MarketData {
    const basePrice = 150.25;
    const currentPrice = basePrice + (Math.random() - 0.5) * 10;
    return {
        symbol,
        price: parseFloat(currentPrice.toFixed(2)),
        open: parseFloat(basePrice.toFixed(2)),
        high: parseFloat((currentPrice + 2.50).toFixed(2)),
        low: parseFloat((currentPrice - 2.50).toFixed(2)),
        close: parseFloat(currentPrice.toFixed(2)),
        volume: Math.floor(Math.random() * 1000000) + 500000,
        timestamp: Date.now()
    };
}

export function cleanupResourceSubscriptions(): void {
    console.log('[Resources] Cleaning up all active subscriptions...');
    for (const [uri, interval] of subscriptions.entries()) {
        clearInterval(interval);
        console.log(`[Resources] Cleaned up subscription for: ${uri}`);
    }
    subscriptions.clear();
} 