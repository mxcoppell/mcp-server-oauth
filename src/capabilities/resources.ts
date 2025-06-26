import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AccountInfo, MarketData } from '../types/index.js';

const accountCache = new Map<string, { data: AccountInfo; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

export function registerResources(server: McpServer, requireAuth: boolean = true): void {
    // Non-streamable resource: Account Information
    server.resource(
        'Account Information',
        'account://info/ACC001',
        {
            description: 'Get detailed account information and portfolio summary',
            mimeType: 'application/json'
        },
        async (uri, extra) => {
            if (requireAuth && !extra?.authInfo?.token) {
                throw new Error('Unauthorized: Valid Bearer token required');
            }

            const cacheKey = 'account_info';
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

            // Generate mock account data matching the AccountInfo interface
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
    server.resource(
        'Market Data Stream',
        'stream://market/AAPL',
        {
            description: 'Real-time market data stream for AAPL. Supports subscriptions for live updates.',
            mimeType: 'application/json'
        },
        async (uri, extra) => {
            if (requireAuth && !extra?.authInfo?.token) {
                throw new Error('Unauthorized: Valid Bearer token required');
            }

            // Generate mock market data matching the MarketData interface
            const basePrice = 175.23;
            const marketData: MarketData = {
                symbol: 'AAPL',
                price: basePrice + (Math.random() - 0.5) * 10,
                open: basePrice + (Math.random() - 0.5) * 5,
                high: basePrice + Math.random() * 8,
                low: basePrice - Math.random() * 8,
                close: basePrice + (Math.random() - 0.5) * 3,
                volume: Math.floor(Math.random() * 1000000) + 500000,
                timestamp: Date.now()
            };

            return {
                contents: [{
                    uri: uri.href,
                    text: JSON.stringify({
                        ...marketData,
                        // Indicate this resource supports streaming
                        _metadata: {
                            type: 'streaming',
                            subscription_supported: true,
                            update_frequency: '1s',
                            last_updated: new Date().toISOString()
                        }
                    }, null, 2),
                    mimeType: 'application/json'
                }]
            };
        }
    );
} 