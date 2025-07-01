# MCP Server with OAuth & Capabilities

A comprehensive Model Context Protocol (MCP) server implementation demonstrating OAuth 2.1 authorization, dual transport support (stdio/HTTP), and all core MCP capabilities following the 2025-06-18 specification.

## 🚀 Features

- **Dual Transport Support**: stdio and Streamable HTTP with Server-Sent Events
- **OAuth 2.1 Authorization**: Bearer token authentication for HTTP transport
- **Complete MCP Implementation**: Tools, Resources (streaming & non-streaming), and Prompts
- **Security-First Design**: Proper token validation, audience checking, and error handling
- **Trading API Integration**: Financial market data examples
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

### Setup Environment

1. Copy the environment template:
   ```bash
   cp .env.sample .env
   ```

2. Update `.env` with your Auth0 configuration values (see template for guidance)

### Environment Variables

| Variable              | Description                            | Default                         | Required      |
| --------------------- | -------------------------------------- | ------------------------------- | ------------- |
| `MCP_TRANSPORT`       | Transport type (`stdio` or `http`)     | `stdio`                         | No            |
| `MCP_HTTP_PORT`       | HTTP server port                       | `6060`                          | No            |
| `ENABLE_AUTH`         | Enable OAuth authentication            | `true`                          | No            |
| `CORS_ORIGIN`         | CORS origin                            | `*`                             | No            |
| `OAUTH_ISSUER`        | Auth0 tenant URL                       | `https://your-tenant.auth0.com` | For HTTP auth |
| `OAUTH_AUDIENCE`      | API audience/identifier                | `https://your-api-identifier`   | For HTTP auth |
| `OAUTH_CLIENT_ID`     | Auth0 application client ID            | `your-auth0-client-id`          | For HTTP auth |
| `OAUTH_RESOURCE_NAME` | Resource name in OAuth metadata        | `Your API Name`                 | No            |
| `OAUTH_API_SCOPES`    | Supported API scopes (comma-separated) | `scope1,scope2,scope3`          | No            |

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

# Via MCP Inspector (connect to running server)
npx @modelcontextprotocol/inspector
# Then connect to: http://localhost:6060/mcp
```

## 🔐 OAuth Authentication

> **📖 For detailed authentication architecture and flows, see [AUTH.md](AUTH.md)**

### Quick Start

For HTTP transport, include Bearer token in Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

Invalid/missing tokens return:
```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="http://localhost:6060/.well-known/oauth-protected-resource"
```

### Well-Known Discovery Endpoint

The server exposes OAuth metadata at:
```
GET /.well-known/oauth-protected-resource
```

Response (example with configured values):
```json
{
  "resource": "https://your-api.example.com/",
  "resource_name": "Your API Name",
  "authorization_servers": [
    "https://your-tenant.auth0.com/"
  ],
  "scopes_supported": [
    "openid", 
    "profile", 
    "api:read", 
    "api:write", 
    "admin"
  ],
  "bearer_methods_supported": ["header"]
}
```

> **Note**: The actual values are configured via environment variables. See `.env.sample` for configuration details.

## 🛠️ Capabilities

### Tools

#### `get-user-info`
Get information about the current authenticated user (HTTP transport only).

**Parameters:**
- `includeDetails` (optional): Whether to include detailed user information (default: false)

**Example:**
```json
{
  "name": "get-user-info",
  "arguments": {
    "includeDetails": true
  }
}
```

#### `place-order`
Place a trading order (requires authentication for HTTP transport).

**Parameters:**
- `symbol` (required): Stock symbol to trade
- `side` (required): Order side ("buy" or "sell")
- `quantity` (required): Number of shares

**Example:**
```json
{
  "name": "place-order",
  "arguments": {
    "symbol": "AAPL",
    "side": "buy",
    "quantity": 100
  }
}
```

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

**Example:**
```json
{
  "name": "calculate_portfolio_metrics",
  "arguments": {
    "account_id": "ACC001",
    "metric_type": "all"
  }
}
```

### Resources

#### Authentication Token Information: `auth://token/info`
Display current authentication token information and decoded claims.

**URI:** `auth://token/info`

#### Non-Streamable: `account://info/ACC001`
Get account information and portfolio summary (fixed account ID).

**URI:** `account://info/ACC001`

#### Streamable: `stream://market/AAPL`
Real-time market data stream for AAPL using Server-Sent Events.

**URI:** `stream://market/AAPL`

### Prompts

#### `trading_analysis`
Generate comprehensive trading analysis and market insights.

**Arguments:** None (provides general market analysis based on authentication status)

#### `portfolio_optimization`
Optimize portfolio allocation and risk management.

**Arguments:** None (provides general optimization guidance based on authentication status)

#### `risk_assessment`
Comprehensive risk analysis and mitigation strategies.

**Arguments:** None (provides general risk assessment based on authentication status)

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

# Then connect inspector to running server
npx @modelcontextprotocol/inspector
# Connect to: http://localhost:6060/mcp
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
├── .env.sample                   # Environment template
├── .env                          # Your environment config (git ignored)
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
│   └── mcp-stdio-config.json     # Stdio config
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
- [Auth0 API](https://auth0.com/docs/api) 