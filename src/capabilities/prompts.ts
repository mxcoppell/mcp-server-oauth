import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ServerConfig, AuthorizationContext } from '../types/index.js';

export function registerPrompts(
    server: McpServer,
    config: ServerConfig,
    authContext: AuthorizationContext | null
): void {
    // Get auth status for prompt context
    const getAuthStatus = () => {
        if (config.transport === 'stdio') {
            return 'Note: Using stdio transport - no authentication available. Analysis will use demo data.';
        } else if (!config.enableAuth || !authContext?.isAuthorized) {
            return 'Note: Authentication required for personalized analysis and real portfolio data.';
        } else {
            return `Authenticated as user: ${authContext.payload?.sub}. Personalized analysis available.`;
        }
    };

    server.prompt(
        'trading_analysis',
        'Generate detailed trading analysis and recommendations',
        async () => {
            const authStatus = getAuthStatus();

            return {
                description: 'Comprehensive trading analysis and market insights',
                messages: [
                    {
                        role: 'user' as const,
                        content: {
                            type: 'text' as const,
                            text: 'You are a professional trading analyst. Provide comprehensive market analysis including:\n\n' +
                                '1. **Market Overview**: Current market conditions and trends\n' +
                                '2. **Technical Analysis**: Key support/resistance levels, indicators\n' +
                                '3. **Risk Assessment**: Market volatility and risk factors\n' +
                                '4. **Trading Recommendations**: Specific actionable strategies\n' +
                                '5. **Sector Analysis**: Performance across different sectors\n\n' +
                                `${authStatus}\n\n` +
                                'Base your analysis on current market data and provide specific, actionable insights for traders.'
                        }
                    },
                    {
                        role: 'assistant' as const,
                        content: {
                            type: 'text' as const,
                            text: 'I\'ll provide a comprehensive trading analysis based on current market conditions...\n\n' +
                                '## Market Overview\n' +
                                'Current market sentiment shows cautious optimism with increased volatility in key sectors.\n\n' +
                                '## Technical Analysis\n' +
                                'Key resistance levels and trend indicators suggest potential breakout opportunities.\n\n' +
                                '## Risk Assessment\n' +
                                'Moderate risk environment with specific sectors showing heightened volatility.\n\n' +
                                '## Trading Recommendations\n' +
                                'Focus on established companies with strong fundamentals and defensive positions.'
                        }
                    }
                ]
            };
        }
    );

    server.prompt(
        'portfolio_optimization',
        'Optimize portfolio allocation and risk management',
        async () => {
            const authStatus = getAuthStatus();

            return {
                description: 'Portfolio optimization and risk management guidance',
                messages: [
                    {
                        role: 'user' as const,
                        content: {
                            type: 'text' as const,
                            text: 'You are a portfolio management expert. Help optimize portfolio allocation by analyzing:\n\n' +
                                '1. **Asset Allocation**: Optimal distribution across asset classes\n' +
                                '2. **Risk Management**: Diversification and hedging strategies\n' +
                                '3. **Performance Metrics**: Risk-adjusted returns and benchmarking\n' +
                                '4. **Rebalancing Strategy**: When and how to rebalance\n' +
                                '5. **Tax Efficiency**: Tax-optimized allocation strategies\n\n' +
                                `${authStatus}\n\n` +
                                'Provide specific recommendations based on modern portfolio theory and current market conditions.'
                        }
                    },
                    {
                        role: 'assistant' as const,
                        content: {
                            type: 'text' as const,
                            text: 'I\'ll help optimize your portfolio with a focus on risk-adjusted returns...\n\n' +
                                '## Asset Allocation Strategy\n' +
                                'Recommended diversification across equities, bonds, and alternative investments.\n\n' +
                                '## Risk Management Framework\n' +
                                'Implementation of systematic risk controls and position sizing.\n\n' +
                                '## Performance Optimization\n' +
                                'Focus on Sharpe ratio improvement and downside protection.'
                        }
                    }
                ]
            };
        }
    );

    server.prompt(
        'risk_assessment',
        'Comprehensive risk analysis and mitigation strategies',
        async () => {
            const authStatus = getAuthStatus();

            return {
                description: 'Detailed risk assessment and mitigation strategies',
                messages: [
                    {
                        role: 'user' as const,
                        content: {
                            type: 'text' as const,
                            text: 'You are a risk management specialist. Conduct comprehensive risk analysis including:\n\n' +
                                '1. **Market Risk**: Systematic and unsystematic risk factors\n' +
                                '2. **Credit Risk**: Counterparty and default risk assessment\n' +
                                '3. **Liquidity Risk**: Market liquidity and funding considerations\n' +
                                '4. **Operational Risk**: Process and system vulnerabilities\n' +
                                '5. **Regulatory Risk**: Compliance and regulatory changes\n\n' +
                                `${authStatus}\n\n` +
                                'Provide quantitative risk metrics and specific mitigation strategies for each risk category.'
                        }
                    },
                    {
                        role: 'assistant' as const,
                        content: {
                            type: 'text' as const,
                            text: 'I\'ll conduct a comprehensive risk assessment across all major risk categories...\n\n' +
                                '## Market Risk Analysis\n' +
                                'VaR calculations and stress testing results for portfolio exposure.\n\n' +
                                '## Credit Risk Framework\n' +
                                'Counterparty risk assessment and exposure limits.\n\n' +
                                '## Mitigation Strategies\n' +
                                'Specific risk controls and hedging recommendations.'
                        }
                    }
                ]
            };
        }
    );
} 