
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MarketData } from '../types/index.js';
import { z } from 'zod';

// Schema removed as it's handled by the tool registration

export function registerTools(server: McpServer): void {
    server.tool(
        'fetch_market_data',
        'Retrieve financial market data for a given symbol',
        {
            symbol: z.string().min(1).max(10).describe('The stock symbol to fetch data for (e.g., AAPL, TSLA)'),
            timeframe: z.enum(['1m', '5m', '15m', '1h', '1d']).optional().default('1d').describe('The timeframe for the market data')
        },
        async (args) => {

            try {
                const { symbol, timeframe } = args;

                // Simulate API call to fetch market data
                const marketData = await fetchMarketDataFromAPI(symbol, timeframe);

                return {
                    content: [
                        {
                            type: 'text',
                            text: `Market data for ${symbol.toUpperCase()}:\n\n` +
                                `Price: $${marketData.price.toFixed(2)}\n` +
                                `Open: $${marketData.open.toFixed(2)}\n` +
                                `High: $${marketData.high.toFixed(2)}\n` +
                                `Low: $${marketData.low.toFixed(2)}\n` +
                                `Close: $${marketData.close.toFixed(2)}\n` +
                                `Volume: ${marketData.volume.toLocaleString()}\n` +
                                `Timeframe: ${timeframe}\n` +
                                `Last Updated: ${new Date(marketData.timestamp).toLocaleString()}`
                        },
                        {
                            type: 'text',
                            text: JSON.stringify(marketData, null, 2)
                        }
                    ]
                };
            } catch (error) {
                if (error instanceof z.ZodError) {
                    throw new Error(`Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
                }
                throw error;
            }
        }
    );

    server.tool(
        'calculate_portfolio_metrics',
        'Calculate portfolio performance metrics',
        {
            account_id: z.string().describe('The account ID to calculate metrics for'),
            metric_type: z.enum(['return', 'volatility', 'sharpe_ratio', 'all']).optional().default('all').describe('The type of metric to calculate')
        },
        async (args) => {

            const { account_id, metric_type = 'all' } = args;

            // Simulate portfolio metrics calculation
            const metrics = calculatePortfolioMetrics(account_id, metric_type);

            return {
                content: [
                    {
                        type: 'text',
                        text: `Portfolio metrics for account ${account_id}:\n\n${JSON.stringify(metrics, null, 2)}`
                    }
                ]
            };
        }
    );
}

// Simulated API functions
async function fetchMarketDataFromAPI(symbol: string, _timeframe: string): Promise<MarketData> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Generate realistic but fake market data
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

function calculatePortfolioMetrics(accountId: string, metricType: string) {
    const mockMetrics = {
        account_id: accountId,
        total_return: (Math.random() * 0.2 - 0.1) * 100, // -10% to +10%
        annualized_return: (Math.random() * 0.15 - 0.05) * 100, // -5% to +10%
        volatility: Math.random() * 0.3 + 0.1, // 10% to 40%
        sharpe_ratio: Math.random() * 2 - 0.5, // -0.5 to 1.5
        max_drawdown: Math.random() * 0.2, // 0% to 20%
        beta: Math.random() * 1.5 + 0.5, // 0.5 to 2.0
        calculated_at: new Date().toISOString()
    };

    if (metricType === 'all') {
        return mockMetrics;
    }

    // Return specific metric
    const metricMap: Record<string, any> = {
        return: {
            total_return: mockMetrics.total_return,
            annualized_return: mockMetrics.annualized_return
        },
        volatility: { volatility: mockMetrics.volatility },
        sharpe_ratio: { sharpe_ratio: mockMetrics.sharpe_ratio }
    };

    return metricMap[metricType] || mockMetrics;
} 