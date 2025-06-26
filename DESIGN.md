# MCP OAuth Server Design Document

## Overview

This document outlines the design and implementation of a comprehensive Model Context Protocol (MCP) server that follows the latest 2025-06-18 specification. The server demonstrates OAuth 2.1 authorization patterns, dual transport support (stdio/HTTP), and all core MCP capabilities.

## Architecture

### Core Components

1. **MCP Server Core** (`src/server.ts`)
   - Built on official MCP TypeScript SDK
   - Registers tools, resources, and prompts
   - Handles client connections and message routing

2. **Transport Layer** (`src/transports/`)
   - **Stdio Transport** (`stdio.ts`): Direct process communication
   - **HTTP Transport** (`http.ts`): Streamable HTTP with SSE support
   - **Transport Factory** (`factory.ts`): Dynamic transport selection

3. **Authorization Layer** (`src/auth/`)
   - **OAuth Handler** (`oauth.ts`): Bearer token validation
   - **Well-Known Endpoint** (`well-known.ts`): OAuth metadata discovery
   - **Token Validator** (`validator.ts`): JWT/token verification

4. **Capabilities** (`src/capabilities/`)
   - **Tools** (`tools.ts`): Interactive functionality
   - **Resources** (`resources.ts`): Data access (streaming/non-streaming)
   - **Prompts** (`prompts.ts`): Template definitions

## Technical Specifications

### MCP Protocol Compliance

- **Protocol Version**: 2025-06-18
- **Message Format**: JSON-RPC 2.0
- **Transport Support**: stdio + Streamable HTTP
- **Authorization**: OAuth 2.1 Bearer tokens (HTTP only)

### Transport Implementations

#### Stdio Transport
```typescript
// No authorization required
// Direct stdin/stdout communication
// Process lifecycle management
```

#### Streamable HTTP Transport
```typescript
// OAuth Bearer token authentication
// Server-Sent Events for streaming
// Session management
// CORS support
```

### Authorization Flow

#### OAuth 2.1 Implementation
1. **Discovery Endpoint**: `/.well-known/oauth-protected-resource`
   - Returns TradeStation API metadata
   - Provides authorization server details
   - Lists required scopes

2. **Token Validation**:
   - Extract Bearer token from Authorization header
   - Validate token signature and claims
   - Check audience and scope requirements
   - Return 401 with WWW-Authenticate on failure

3. **Security Headers**:
   ```
   WWW-Authenticate: Bearer realm="mcp-server", 
                     authorization_uri="https://signin.tradestation.com/authorize",
                     resource_id="https://api.tradestation.com"
   ```

## Capability Implementations

### 1. Tool Example: `fetch_market_data`
- **Purpose**: Retrieve financial market data
- **Parameters**: symbol (string), timeframe (optional)
- **Authorization**: Required for HTTP transport
- **Response**: JSON market data with OHLCV information

### 2. Non-Streamable Resource: `account_info`
- **URI Pattern**: `account://info/{account_id}`
- **Content**: Account details and portfolio summary
- **Format**: JSON with account metadata
- **Caching**: 30-second TTL

### 3. Streamable Resource: `market_feed`
- **URI Pattern**: `stream://market/{symbol}`
- **Content**: Real-time market data stream
- **Format**: Server-Sent Events with JSON payloads
- **Features**: Live price updates, volume tracking

### 4. Prompt Example: `trading_analysis`
- **Template**: Financial analysis prompt with variables
- **Arguments**: symbol, analysis_type, time_period
- **Output**: Structured analysis request for LLM

## Security Considerations

### Token Validation
- JWT signature verification
- Audience claim validation
- Expiration time checking
- Scope-based access control

### Transport Security
- HTTPS enforcement for HTTP transport
- CORS policy configuration
- Rate limiting implementation
- Input validation and sanitization

### Error Handling
- Standardized error responses
- Security-safe error messages
- Proper status code usage
- Audit logging

## File Structure

```
mcp-server-oauth/
├── src/
│   ├── server.ts                 # Main MCP server
│   ├── index.ts                  # Entry point with transport selection
│   ├── config.ts                 # Configuration management
│   ├── transports/
│   │   ├── stdio.ts              # Stdio transport implementation
│   │   ├── http.ts               # HTTP transport implementation
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
│       └── index.ts              # TypeScript type definitions
├── config/
│   ├── mcp-stdio-config.json     # Stdio transport config
│   └── mcp-http-config.json      # HTTP transport config
├── package.json
├── tsconfig.json
├── DESIGN.md                     # This document
└── README.md                     # Usage instructions
```

## Configuration

### Environment Variables
- `MCP_TRANSPORT`: Transport type (stdio|http)
- `MCP_HTTP_PORT`: HTTP server port (default: 3000)
- `OAUTH_JWT_SECRET`: JWT signing secret
- `OAUTH_ISSUER`: Token issuer URL
- `OAUTH_AUDIENCE`: Expected token audience

### MCP Inspector Integration
- Compatible with @modelcontextprotocol/inspector
- Supports both transport configurations
- Hot-reload during development

## Usage Patterns

### Stdio Mode
```bash
npm run start:stdio
# OR via MCP Inspector
npx @modelcontextprotocol/inspector --config config/mcp-stdio-config.json
```

### HTTP Mode
```bash
npm run start:http
# OR via MCP Inspector  
npx @modelcontextprotocol/inspector --config config/mcp-http-config.json --server http-dev
```

## Testing Strategy

### Unit Tests
- Token validation logic
- Capability implementations
- Error handling scenarios

### Integration Tests
- Transport layer functionality
- End-to-end OAuth flows
- MCP protocol compliance

### Security Tests
- Authorization bypass attempts
- Token manipulation testing
- Input validation coverage

## Compliance & Standards

- **MCP Specification**: 2025-06-18 compliant
- **OAuth 2.1**: RFC 6749 + security BCP
- **JSON-RPC 2.0**: Strict protocol adherence
- **TypeScript**: Strict type checking
- **Security**: OWASP best practices

This design ensures a production-ready MCP server that demonstrates all core protocol features while maintaining security and extensibility. 