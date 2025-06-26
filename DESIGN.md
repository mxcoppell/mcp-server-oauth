# MCP OAuth Server Design Document

## Overview

This document outlines the design and implementation of a comprehensive Model Context Protocol (MCP) server that follows the latest MCP specification (2025-06-18) with OAuth 2.1 authorization support. The server implements dual transport support (stdio and streamable HTTP) with authentication requirements that vary by transport type.

## Requirements Implementation

This implementation satisfies the following original requirements:

1. **MCP Specification Compliance**: Follows the latest MCP specification (2025-06-18)
2. **Authorization Specification**: Implements MCP authorization specification (2025-06-18/basic/authorization)
3. **TypeScript Implementation**: Built entirely in TypeScript with strict typing
4. **Official MCP SDK**: Uses the official MCP TypeScript SDK from modelcontextprotocol/typescript-sdk
5. **Dual Transport Support**: Supports both stdio and streamable HTTP transport
6. **Complete Capability Set**: Implements tools, resources (streamable/non-streamable), and prompts
7. **OAuth Discovery Endpoint**: Provides spec-compliant `/.well-known/oauth-protected-resource`
8. **Transport-Specific Authentication**: 
   - **Stdio**: No authentication required
   - **HTTP**: Bearer token authentication mandatory

## Architecture

### Core Components

1. **MCP Server Core** (`src/server.ts`)
   - Built on official MCP TypeScript SDK
   - Registers tools, resources, and prompts
   - Handles client connections and message routing

2. **Transport Layer** (`src/transports/`)
   - **Stdio Transport** (`stdio.ts`): Direct process communication (no auth)
   - **HTTP Transport** (`http.ts`): Streamable HTTP with OAuth Bearer token validation
   - **Transport Factory** (`index.ts`): Dynamic transport selection

3. **Authorization Layer** (`src/auth/`)
   - **Well-Known Handler** (`well-known.ts`): OAuth discovery endpoint
   - **Token Validator** (`validator.ts`): JWT Bearer token validation

4. **Capabilities** (`src/capabilities/`)
   - **Tools** (`tools.ts`): Interactive functionality examples
   - **Resources** (`resources.ts`): Data access (streaming/non-streaming examples)
   - **Prompts** (`prompts.ts`): Template definitions

## Technical Specifications

### MCP Protocol Compliance

- **Protocol Version**: 2025-06-18
- **Message Format**: JSON-RPC 2.0
- **Transport Support**: stdio (no auth) + streamable HTTP (OAuth required)
- **Authorization**: OAuth 2.1 Bearer tokens (HTTP transport only)

### Transport Implementations

#### Stdio Transport
```typescript
// ✅ No authorization header checking
// ✅ Direct stdin/stdout communication  
// ✅ Process lifecycle management
// ✅ Suitable for local development and CLI usage
```

#### Streamable HTTP Transport
```typescript
// ✅ OAuth Bearer token authentication required
// ✅ HTTP POST endpoint for MCP communication
// ✅ CORS support for web clients
// ✅ Returns 401 with WWW-Authenticate header when unauthorized
```

### OAuth 2.1 Authorization Implementation

#### Discovery Endpoint: `/.well-known/oauth-protected-resource`
Returns the exact metadata format as specified:
```json
{
  "resource": "https://api.tradestation.com/",
  "resource_name": "TradeStation API",
  "authorization_servers": [
    "https://signin.tradestation.com/"
  ],
  "scopes_supported": ["ReadAccount", "Trade", "MarketData"],
  "bearer_methods_supported": ["header"]
}
```

#### Bearer Token Validation (HTTP Transport Only)
1. **Token Extraction**: Extract Bearer token from Authorization header
2. **JWT Validation**: Verify token signature, audience, issuer, and expiration
3. **Scope Checking**: Validate required scopes for resource access
4. **Error Response**: Return 401 with proper WWW-Authenticate header on failure:
   ```
   HTTP/1.1 401 Unauthorized
   WWW-Authenticate: Bearer resource_metadata="http://localhost:<port>/.well-known/oauth-protected-resource"
   ```

## Capability Examples

### 1. Tool Example: `fetch_market_data`
- **Purpose**: Retrieve financial market data for trading analysis
- **Parameters**: 
  - `symbol` (required): Stock symbol (e.g., "AAPL", "TSLA")
  - `timeframe` (optional): Data timeframe ("1m", "5m", "15m", "1h", "1d")
- **Authorization**: Required for HTTP transport, not required for stdio
- **Response**: JSON market data with OHLCV information

### 2. Non-Streamable Resource: `account_info`
- **URI Pattern**: `account://info/ACC001`
- **Content**: Account details and portfolio summary
- **Format**: JSON with account metadata
- **Caching**: 30-second TTL for performance
- **Authorization**: Follows transport-specific auth rules

### 3. Streamable Resource: `market_feed`
- **URI Pattern**: `stream://market/AAPL`
- **Content**: Real-time market data stream simulation
- **Format**: JSON payloads with streaming capability metadata
- **Features**: Live price updates, volume tracking, subscription support
- **Authorization**: Follows transport-specific auth rules

### 4. Prompt Example: `trading_analysis`
- **Template**: Financial analysis prompt with variables for LLM processing
- **Arguments**: symbol, analysis_type, time_period
- **Output**: Structured analysis request template
- **Authorization**: Follows transport-specific auth rules

## Security Implementation

### Token Validation (HTTP Transport)
- **JWT Signature Verification**: Using configured secret key
- **Audience Validation**: Must match configured OAuth audience
- **Issuer Validation**: Must match configured OAuth issuer  
- **Expiration Checking**: Rejects expired tokens
- **Scope-Based Access**: Validates required scopes for operations

### Transport Security
- **Stdio**: No security headers needed (local process communication)
- **HTTP**: CORS policy configuration, proper error responses
- **Input Validation**: Zod schema validation for all inputs
- **Error Sanitization**: Security-safe error messages

## Configuration

### Environment Variables
- `MCP_TRANSPORT`: Transport type (`stdio` | `http`)
- `MCP_HTTP_PORT`: HTTP server port (default: 6060)
- `ENABLE_AUTH`: Enable OAuth authentication (default: true for HTTP, false for stdio)
- `OAUTH_JWT_SECRET`: JWT signing/verification secret
- `OAUTH_ISSUER`: Token issuer URL (`https://signin.tradestation.com`)
- `OAUTH_AUDIENCE`: Expected token audience (`https://api.tradestation.com`)
- `CORS_ORIGIN`: CORS origin configuration (default: `*`)

### Transport Configurations

#### Stdio Configuration (`config/mcp-stdio-config.json`)
```json
{
  "mcpServers": {
    "mcp-server-oauth": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "ENABLE_AUTH": "false"
      }
    }
  }
}
```

#### HTTP Configuration (`config/mcp-http-config.json`)
```json
{
  "mcpServers": {
    "mcp-server-oauth-http": {
      "command": "node", 
      "args": ["dist/index.js"],
      "env": {
        "MCP_TRANSPORT": "http",
        "MCP_HTTP_PORT": "6060",
        "ENABLE_AUTH": "true",
        "OAUTH_JWT_SECRET": "demo-secret-key-for-testing",
        "OAUTH_ISSUER": "https://signin.tradestation.com",
        "OAUTH_AUDIENCE": "https://api.tradestation.com"
      }
    }
  }
}
```

## Usage Patterns

### Stdio Transport (No Authentication)
```bash
# Direct execution
MCP_TRANSPORT=stdio ENABLE_AUTH=false npm start

# Via MCP Inspector
npx @modelcontextprotocol/inspector --config config/mcp-stdio-config.json
```

### Streamable HTTP Transport (OAuth Required)
```bash
# Direct execution with OAuth enabled
MCP_TRANSPORT=http ENABLE_AUTH=true npm start

# Via MCP Inspector
npx @modelcontextprotocol/inspector --config config/mcp-http-config.json
```

## Testing OAuth Implementation

### Generate Test Token
```bash
OAUTH_JWT_SECRET="demo-secret-key-for-testing" \
OAUTH_ISSUER="https://signin.tradestation.com" \
OAUTH_AUDIENCE="https://api.tradestation.com" \
node scripts/generate-test-token.js
```

### Test Well-Known Endpoint
```bash
curl -s http://localhost:6060/.well-known/oauth-protected-resource | jq .
```

### Test 401 Unauthorized Response
```bash
# Without token
curl -i -X POST http://localhost:6060/mcp

# With invalid token  
curl -i -X POST -H "Authorization: Bearer invalid-token" http://localhost:6060/mcp
```

### Test Valid Bearer Token
```bash
curl -i -X POST \
  -H "Authorization: Bearer <GENERATED_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:6060/mcp
```

## File Structure

```
mcp-server-oauth/
├── src/
│   ├── server.ts                 # Main MCP server implementation
│   ├── index.ts                  # Entry point with transport selection
│   ├── config.ts                 # Configuration management
│   ├── transports/
│   │   ├── stdio.ts              # Stdio transport (no auth)
│   │   └── http.ts               # HTTP transport (OAuth required)
│   ├── auth/
│   │   ├── well-known.ts         # OAuth discovery endpoint
│   │   └── validator.ts          # Bearer token validation
│   ├── capabilities/
│   │   ├── tools.ts              # Tool implementations
│   │   ├── resources.ts          # Resource handlers (streamable/non-streamable)
│   │   └── prompts.ts            # Prompt definitions
│   └── types/
│       └── index.ts              # TypeScript type definitions
├── config/
│   ├── mcp-stdio-config.json     # Stdio transport config (no auth)
│   └── mcp-http-config.json      # HTTP transport config (OAuth enabled)
├── scripts/
│   └── generate-test-token.js    # JWT token generation utility
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── DESIGN.md                     # This design document
└── README.md                     # Usage and setup instructions
```

## Implementation Notes

### Key Differences by Transport

| Feature            | Stdio Transport        | HTTP Transport                            |
| ------------------ | ---------------------- | ----------------------------------------- |
| Authentication     | ❌ None required        | ✅ Bearer token mandatory                  |
| Discovery Endpoint | ❌ N/A                  | ✅ `/.well-known/oauth-protected-resource` |
| CORS Support       | ❌ N/A                  | ✅ Configurable origins                    |
| Error Responses    | JSON-RPC errors        | HTTP status codes + JSON                  |
| Use Case           | Local development, CLI | Web clients, production                   |

### OAuth Compliance

This implementation strictly follows:
- **MCP Authorization Specification (2025-06-18/basic/authorization)**
- **OAuth 2.1 Security Best Practices**
- **RFC 8707 Resource Indicators**
- **RFC 9728 Protected Resource Metadata**

The server ensures proper audience validation, token binding, and prevents confused deputy attacks by validating that tokens are specifically issued for the MCP server resource.

## Compliance & Standards

- **MCP Specification**: 2025-06-18 compliant
- **OAuth 2.1**: RFC 6749 + security BCP implementation
- **JSON-RPC 2.0**: Strict protocol adherence for MCP communication
- **TypeScript**: Strict type checking with comprehensive interfaces
- **Security**: OWASP best practices for OAuth and API security

This implementation provides a production-ready MCP server that demonstrates all core protocol features while maintaining security through transport-appropriate authentication mechanisms. 