import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { AccountInfo, MarketData } from '../types/index.js';

const accountCache = new Map<string, { data: AccountInfo; timestamp: number }>();
const subscriptions = new Map<string, NodeJS.Timeout>(); // Track active subscriptions
const CACHE_TTL = 30000; // 30 seconds

export function registerResources(server: McpServer): void {
    // Non-streamable resource: Account Information
    server.resource(
        'Account Information',
        'account://info/ACC001',
        {
            description: 'Get detailed account information and portfolio summary',
            mimeType: 'application/json'
        },
        async (uri) => {

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
            mimeType: 'application/json',
            streamable: true
        },
        async (uri) => {

            const symbol = 'AAPL';
            const basePrice = 150.25;
            const currentPrice = basePrice + (Math.random() - 0.5) * 10;
            const marketData: MarketData = {
                symbol,
                price: currentPrice,
                open: basePrice,
                high: currentPrice + 2.50,
                low: currentPrice - 2.50,
                close: currentPrice,
                volume: Math.floor(Math.random() * 1000000) + 500000,
                timestamp: Date.now()
            };

            return {
                contents: [{
                    uri: uri.toString(),
                    mimeType: 'application/json',
                    text: JSON.stringify({
                        ...marketData,
                        // Resource metadata indicating streaming capability
                        _metadata: {
                            streamable: true,
                            subscription_supported: true,
                            update_frequency: 'real-time',
                            note: 'This resource supports streaming. Use resources/subscribe to receive live updates.'
                        }
                    }, null, 2)
                }]
            };
        }
    );

    // Setup resource subscription handlers
    setupResourceSubscriptionHandlers(server);
}

function setupResourceSubscriptionHandlers(server: McpServer): void {
    // Handle resource subscription requests
    server.server.setRequestHandler(
        z.object({
            method: z.literal('resources/subscribe'),
            params: z.object({
                uri: z.string()
            })
        }),
        async (request, _extra) => {
            const { uri } = request.params;
            console.error(`[Resources] Subscription requested for: ${uri}`);

            if (!uri.startsWith('stream://')) {
                throw new Error('Only streaming resources support subscriptions');
            }

            // Stop existing subscription if any
            if (subscriptions.has(uri)) {
                clearInterval(subscriptions.get(uri)!);
                subscriptions.delete(uri);
            }

            // Start periodic updates every 2 seconds
            const interval = setInterval(async () => {
                try {
                    await sendResourceUpdate(server, uri);
                } catch (error) {
                    console.error(`[Resources] Error sending resource update for ${uri}:`, error);
                }
            }, 2000);

            subscriptions.set(uri, interval);
            console.error(`[Resources] Started streaming for: ${uri}`);

            return {
                _meta: {},
                success: true
            };
        }
    );

    // Handle resource unsubscription requests
    server.server.setRequestHandler(
        z.object({
            method: z.literal('resources/unsubscribe'),
            params: z.object({
                uri: z.string()
            })
        }),
        async (request, _extra) => {
            const { uri } = request.params;
            console.error(`[Resources] Unsubscription requested for: ${uri}`);

            // Stop the subscription if it exists
            if (subscriptions.has(uri)) {
                clearInterval(subscriptions.get(uri)!);
                subscriptions.delete(uri);
                console.error(`[Resources] Stopped streaming for: ${uri}`);
            } else {
                console.error(`[Resources] No active subscription found for: ${uri}`);
            }

            return {
                _meta: {},
                success: true
            };
        }
    );
}

async function sendResourceUpdate(server: McpServer, uri: string): Promise<void> {
    // Generate updated market data for the streaming resource
    if (uri === 'stream://market/AAPL') {
        const basePrice = 150.25;
        const currentPrice = basePrice + (Math.random() - 0.5) * 10;
        const marketData = {
            symbol: 'AAPL',
            price: currentPrice,
            open: basePrice,
            high: currentPrice + 2.50,
            low: currentPrice - 2.50,
            close: currentPrice,
            volume: Math.floor(Math.random() * 1000000) + 500000,
            timestamp: Date.now()
        };

        // Send resource updated notification
        await server.server.sendResourceUpdated({
            uri,
            content: {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({
                    ...marketData,
                    _metadata: {
                        streamable: true,
                        subscription_supported: true,
                        update_frequency: 'real-time',
                        last_updated: new Date().toISOString()
                    }
                }, null, 2)
            }
        });
    }
}

export function cleanupResourceSubscriptions(): void {
    // Clean up all active subscriptions
    for (const [uri, interval] of subscriptions.entries()) {
        clearInterval(interval);
        console.error(`[Resources] Cleaned up subscription for: ${uri}`);
    }
    subscriptions.clear();
} 