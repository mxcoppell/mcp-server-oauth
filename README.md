# MCP OAuth Server

A comprehensive Model Context Protocol (MCP) server implementation demonstrating OAuth 2.1 authorization, dual transport support (stdio/HTTP), and all core MCP capabilities following the 2025-06-18 specification.

## 🚀 Features

- **Dual Transport Support**: stdio and Streamable HTTP with Server-Sent Events
- **OAuth 2.1 Authorization**: Bearer token authentication for HTTP transport
- **Complete MCP Implementation**: Tools, Resources (streaming & non-streaming), and Prompts
- **Security-First Design**: Proper token validation, audience checking, and error handling
- **TradeStation API Integration**: Financial market data examples
- **TypeScript**: Fully typed with strict type checking
- **MCP Inspector Compatible**: Ready-to-use configurations included

## 📋 Requirements

- Node.js 18+
- TypeScript 5.2+
- MCP Inspector (optional, for testing)

## 🛠️ Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd mcp-server-oauth

# Install dependencies
npm install

# Build the project
npm run build
```

## ⚙️ Configuration

### Environment Variables

| Variable         | Description                        | Default                           | Required      |
| ---------------- | ---------------------------------- | --------------------------------- | ------------- |
| `MCP_TRANSPORT`  | Transport type (`stdio` or `http`) | `stdio`                           | No            |
| `MCP_HTTP_PORT`  | HTTP server port                   | `3000`                            | No            |
| `OAUTH_ISSUER`   | Token issuer URL                   | `https://signin.tradestation.com` | For HTTP auth |
| `OAUTH_AUDIENCE` | Expected token audience            | `https://api.tradestation.com`    | For HTTP auth |
| `CORS_ORIGIN`    | CORS origin                        | `*`                               | No            |
| `ENABLE_AUTH`    | Enable OAuth authentication        | `true`                            | No            |

## 🚀 Usage

### Stdio Transport (No Authentication)

```bash
# Direct execution
npm run start:stdio

# Development mode
npm run dev:stdio

# Via MCP Inspector
npm run inspector:stdio
```

### HTTP Transport (With OAuth)

```bash
# Direct execution
npm run start:http

# Development mode
npm run dev:http

# Via MCP Inspector
npm run inspector:http
```

## 🔐 OAuth Authentication

### Well-Known Discovery Endpoint

The server exposes OAuth metadata at:
```
GET /.well-known/oauth-protected-resource
```

Response:
```json
{
  "resource": "https://api.tradestation.com/",
  "resource_name": "TradeStation API",
  "authorization_servers": [
    "https://signin.tradestation.com/"
  ],
  "scopes_supported": [
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
  "bearer_methods_supported": ["header"]
}
```

### Token Validation

For HTTP transport, include Bearer token in Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

Invalid/missing tokens return:
```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="http://localhost:6060/.well-known/oauth-protected-resource"
```

## 🛠️ Capabilities

### Tools

#### `fetch_market_data`
Retrieve financial market data for a given symbol.

**Parameters:**
- `symbol` (required): Stock symbol (e.g., "AAPL", "TSLA")
- `timeframe` (optional): Data timeframe ("1m", "5m", "15m", "1h", "1d")

**Example:**
```json
{
  "name": "fetch_market_data",
  "arguments": {
    "symbol": "AAPL",
    "timeframe": "1d"
  }
}
```

#### `calculate_portfolio_metrics`
Calculate portfolio performance metrics.

**Parameters:**
- `account_id` (required): Account ID
- `metric_type` (optional): Metric type ("return", "volatility", "sharpe_ratio", "all")

### Resources

#### Non-Streamable: `account://info/{account_id}`
Get account information and portfolio summary.

**Example URI:** `account://info/12345`

#### Streamable: `stream://market/{symbol}`
Real-time market data stream using Server-Sent Events.

**Example URI:** `stream://market/AAPL`

#### Static: `static://trading/schedule`
Trading hours and holiday schedule.

### Prompts

#### `trading_analysis`
Generate comprehensive trading analysis.

**Arguments:**
- `symbol` (required): Stock symbol
- `analysis_type` (optional): Analysis type
- `time_period` (optional): Time period

#### `portfolio_optimization`
Generate portfolio optimization recommendations.

**Arguments:**
- `account_id` (required): Account ID
- `risk_tolerance` (optional): Risk level
- `investment_horizon` (optional): Time horizon

#### `risk_assessment`
Generate risk assessment for positions.

**Arguments:**
- `positions` (required): JSON string of positions
- `market_conditions` (optional): Market conditions

## 🧪 Testing with MCP Inspector

### Stdio Mode
[Use the stdio configuration from memory][[memory:2513256715134277487]]
```bash
npx @modelcontextprotocol/inspector --config config/mcp-stdio-config.json
```

### HTTP Mode
```bash
# Start the server first
npm run start:http

# Then connect inspector
npx @modelcontextprotocol/inspector --config config/mcp-http-config.json --server http-dev
```

## 🔧 Development

### Scripts

```bash
npm run build          # Build TypeScript
npm run dev           # Development mode with watch
npm run test          # Run tests
npm run lint          # Lint code
npm run lint:fix      # Fix linting issues
```

### File Structure

```
mcp-server-oauth/
├── src/
│   ├── server.ts                 # Main MCP server
│   ├── index.ts                  # Entry point
│   ├── config.ts                 # Configuration
│   ├── transports/
│   │   ├── stdio.ts              # Stdio transport
│   │   ├── http.ts               # HTTP transport
│   │   └── factory.ts            # Transport factory
│   ├── auth/
│   │   ├── oauth.ts              # OAuth handler
│   │   ├── well-known.ts         # Discovery endpoint
│   │   └── validator.ts          # Token validation
│   ├── capabilities/
│   │   ├── tools.ts              # Tool implementations
│   │   ├── resources.ts          # Resource handlers
│   │   └── prompts.ts            # Prompt definitions
│   └── types/
│       └── index.ts              # Type definitions
├── config/
│   ├── mcp-stdio-config.json     # Stdio config
│   └── mcp-http-config.json      # HTTP config
└── README.md
```

## 🛡️ Security

- JWT signature verification
- Audience and issuer validation
- Expiration time checking
- CORS policy enforcement
- Input validation with Zod
- Error message sanitization
- Rate limiting ready

## 📚 MCP Specification Compliance

This implementation follows the MCP specification version 2025-06-18:
- JSON-RPC 2.0 messaging
- Proper capability registration
- Error handling standards
- Transport-agnostic design
- OAuth 2.1 security patterns

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and tests
6. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details.

## 🔗 Related Links

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [OAuth 2.1 Specification](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1)
- [TradeStation API](https://api.tradestation.com/) 