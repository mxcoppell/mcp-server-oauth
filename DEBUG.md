# Debug Guide

This guide helps you manually start the MCP server and MCP Inspector separately for debugging purposes.

## Prerequisites

1. Build the project:
```bash
npm run build
```

2. Ensure you have the MCP Inspector installed:
```bash
npm install -g @modelcontextprotocol/inspector
```

## Stdio Transport (No Authentication)

### Start MCP Server (Stdio)

In Terminal 1:
```bash
# Set environment variables
export MCP_TRANSPORT=stdio
export ENABLE_AUTH=false

# Start the server
node dist/index.js
```

The server will start in stdio mode and wait for JSON-RPC messages on stdin.

### Start MCP Inspector (Stdio)

In Terminal 2:
```bash
npx @modelcontextprotocol/inspector --config config/mcp-stdio-config.json --server mcp-server-oauth
```

The inspector will:
- Launch the MCP server as a child process
- Connect via stdio transport
- Open a web interface (usually at http://localhost:5173)
- Display an authentication token URL for secure access

## Streamable HTTP Transport (OAuth Required)

### Start MCP Server (HTTP)

In Terminal 1:
```bash
# Set environment variables
export MCP_TRANSPORT=http
export MCP_HTTP_PORT=6060
export ENABLE_AUTH=true
export OAUTH_ISSUER=https://your-tenant.auth0.com
export OAUTH_AUDIENCE=https://your-api.example.com
export CORS_ORIGIN=*

# Start the server
node dist/index.js
```

The server will start on http://localhost:6060 and show:
```
MCP Server starting...
Transport: http
HTTP Port: 6060
Auth: enabled
Server started successfully
HTTP server listening on port 6060
```

### Test HTTP Server Endpoints

Verify the server is running:

1. **Test well-known endpoint**:
```bash
curl -s http://localhost:6060/.well-known/oauth-protected-resource | jq .
```

Expected response (using your configured values):
```json
{
  "resource": "https://your-api.example.com/",
  "resource_name": "Your API Name",
  "authorization_servers": ["http://localhost:6060"],
  "scopes_supported": ["api:read", "api:write"],
  "bearer_methods_supported": ["header"]
}
```

2. **Test 401 Unauthorized** (without token):
```bash
curl -i -X POST http://localhost:6060/mcp
```

Expected response:
```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="http://localhost:6060/.well-known/oauth-protected-resource"
```

### Start MCP Inspector (HTTP)

In Terminal 2:
```bash
npx @modelcontextprotocol/inspector
```

Then in the inspector web interface:
- Server URL: `http://localhost:6060/mcp`
- The inspector will handle OAuth authentication

## Troubleshooting

### Common Issues

1. **Port already in use**:
   - Change the port: `export MCP_HTTP_PORT=6061`
   - Or kill the process using the port: `lsof -ti:6060 | xargs kill`

2. **Inspector can't connect**:
   - Ensure the MCP server is running first
   - Check the port matches in both server and inspector config
   - For HTTP: verify the server shows "HTTP server listening on port 6060"

3. **OAuth/Authentication issues**:
   - For stdio: Ensure `ENABLE_AUTH=false`
   - For HTTP: Ensure `ENABLE_AUTH=true`
   - Check that OAUTH_ISSUER and OAUTH_AUDIENCE match your Auth0 configuration

### Debug Logs

Add debug logging by setting:
```bash
export DEBUG=mcp:*
```

### Verify Server Status

Check if the HTTP server is responding:
```bash
# Health check
curl -i http://localhost:6060/

# Should return 404 (expected - no root handler)
# But confirms server is running
```

### Configuration Files

The config file used by the inspector is:
- `config/mcp-stdio-config.json` - For stdio transport

For HTTP transport, connect directly to the running server at `http://localhost:6060/mcp`

## Manual Testing Workflow

1. **Start the MCP server** in one terminal
2. **Verify server is running** (for HTTP: test endpoints)
3. **Start MCP Inspector** in another terminal
4. **Open inspector web interface** (usually http://localhost:5173)
5. **Test MCP capabilities** (tools, resources, prompts)

This approach gives you full control over both processes and makes debugging easier. 