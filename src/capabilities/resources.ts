import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AccountInfo, MarketData } from '../types/index.js';

const accountCache = new Map<string, { data: AccountInfo; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

export function registerResources(server: McpServer, requireAuth: boolean = true): void {
    // Non-streamable resource: Account Information
    server.resource(
        'Account Information',
        'account://info/{accountId}',
        { description: 'Get detailed account information and portfolio summary', mimeType: 'application/json' },
        async (uri, extra) => {
            if (requireAuth && !extra?.authInfo?.token) {
                throw new Error('Unauthorized: Valid Bearer token required');
            }

            const accountId = extractAccountIdFromUri(uri.toString());
            if (!accountId) {
                throw new Error('Invalid account URI format. Use account://info/{accountId}');
            }

            // Check cache first
            const cached = accountCache.get(accountId);
            const now = Date.now();

            if (cached && (now - cached.timestamp) < CACHE_TTL) {
                return {
                    contents: [
                        {
                            uri: uri.toString(),
                            mimeType: 'application/json',
                            text: JSON.stringify(cached.data, null, 2)
                        }
                    ]
                };
            }

            // Fetch fresh data
            const accountInfo = await fetchAccountInfo(accountId);

            // Update cache
            accountCache.set(accountId, { data: accountInfo, timestamp: now });

            return {
                contents: [
                    {
                        uri: uri.toString(),
                        mimeType: 'application/json',
                        text: JSON.stringify(accountInfo, null, 2)
                    }
                ]
            };
        }
    );

    // Streamable resource: Market Data Stream
    // This resource supports subscriptions through the MCP protocol's built-in subscription mechanism
    server.resource(
        'Market Data Stream',
        'stream://market/{symbol}',
        {
            description: 'Real-time market data stream for a given symbol. Supports subscriptions for live updates.',
            mimeType: 'application/json'
        },
        async (uri, extra) => {
            if (requireAuth && !extra?.authInfo?.token) {
                throw new Error('Unauthorized: Valid Bearer token required');
            }

            const symbol = extractSymbolFromUri(uri.toString());
            if (!symbol) {
                throw new Error('Invalid stream URI format. Use stream://market/{symbol}');
            }

            // Return current market data snapshot
            const marketData = generateMockMarketData(symbol);

            return {
                contents: [
                    {
                        uri: uri.toString(),
                        mimeType: 'application/json',
                        text: JSON.stringify({
                            type: 'market_data_snapshot',
                            timestamp: Date.now(),
                            symbol: symbol,
                            data: marketData,
                            subscription_info: {
                                supports_streaming: true,
                                update_frequency: '2s',
                                note: 'Use resources/subscribe to get live updates'
                            }
                        }, null, 2)
                    }
                ]
            };
        }
    );

    // Static resource: Trading Schedule
    server.resource(
        'Trading Schedule',
        'static://trading/schedule',
        { description: 'Market trading hours and holiday schedule', mimeType: 'application/json' },
        async (uri, _extra) => {
            const tradingSchedule = {
                market: 'NYSE',
                timezone: 'America/New_York',
                regular_hours: {
                    open: '09:30',
                    close: '16:00',
                    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
                },
                extended_hours: {
                    pre_market: { open: '04:00', close: '09:30' },
                    after_market: { open: '16:00', close: '20:00' }
                },
                holidays: [
                    '2024-01-01', // New Year's Day
                    '2024-01-15', // Martin Luther King Jr. Day
                    '2024-02-19', // Presidents' Day
                    '2024-03-29', // Good Friday
                    '2024-05-27', // Memorial Day
                    '2024-06-19', // Juneteenth
                    '2024-07-04', // Independence Day
                    '2024-09-02', // Labor Day
                    '2024-11-28', // Thanksgiving
                    '2024-12-25'  // Christmas
                ],
                last_updated: new Date().toISOString()
            };

            return {
                contents: [
                    {
                        uri: uri.toString(),
                        mimeType: 'application/json',
                        text: JSON.stringify(tradingSchedule, null, 2)
                    }
                ]
            };
        }
    );
}

// Helper functions
function extractAccountIdFromUri(uri: string): string | null {
    const match = uri.match(/account:\/\/info\/(.+)/);
    return match ? match[1] || null : null;
}

function extractSymbolFromUri(uri: string): string | null {
    const match = uri.match(/stream:\/\/market\/(.+)/);
    return match ? (match[1]?.toUpperCase() || null) : null;
}

async function fetchAccountInfo(accountId: string): Promise<AccountInfo> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200));

    // Generate mock account data
    const mockPositions = [
        {
            symbol: 'AAPL',
            quantity: 100,
            averagePrice: 150.25,
            marketValue: 15500.00,
            unrealizedPnL: 275.00
        },
        {
            symbol: 'TSLA',
            quantity: 50,
            averagePrice: 220.80,
            marketValue: 11200.00,
            unrealizedPnL: -160.00
        },
        {
            symbol: 'MSFT',
            quantity: 75,
            averagePrice: 280.50,
            marketValue: 21600.00,
            unrealizedPnL: 562.50
        }
    ];

    const totalMarketValue = mockPositions.reduce((sum, pos) => sum + pos.marketValue, 0);

    return {
        accountId,
        name: `Trading Account ${accountId}`,
        balance: 25000.00,
        equity: totalMarketValue + 25000.00,
        buyingPower: 50000.00,
        positions: mockPositions
    };
}

function generateMockMarketData(symbol: string): MarketData {
    const basePrice = Math.random() * 200 + 50;
    const volatility = 0.02;

    const open = basePrice * (1 + (Math.random() - 0.5) * volatility);
    const close = open * (1 + (Math.random() - 0.5) * volatility);
    const high = Math.max(open, close) * (1 + Math.random() * volatility);
    const low = Math.min(open, close) * (1 - Math.random() * volatility);
    const price = close;
    const volume = Math.floor(Math.random() * 10000000) + 1000000;

    return {
        symbol: symbol.toUpperCase(),
        price,
        open,
        high,
        low,
        close,
        volume,
        timestamp: Date.now()
    };
} 