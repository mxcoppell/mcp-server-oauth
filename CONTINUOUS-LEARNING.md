# Continuous Learning: MCP OAuth Server with Auth0

This document captures critical lessons learned during the implementation of an MCP (Model Context Protocol) OAuth server with Auth0 integration.

## Overview

Successfully implemented an MCP OAuth server that:
- Serves OAuth metadata locally with CORS support
- Proxies authorization and token requests to Auth0
- Supports Dynamic Client Registration (DCR)
- Works with MCP Inspector for testing
- Properly handles API scopes and permissions

## Key Technical Challenges & Solutions

### 1. Auth0 Native Application API Scope Issues

**Problem**: Native applications using Authorization Code + PKCE flow were not receiving API scopes in tokens, only getting `"scope": "openid profile"` and `"permissions": []` despite correct OAuth flow implementation.

**Root Cause**: Auth0 requires users to have explicit permissions assigned through roles for Native applications to receive API scopes in tokens.

**Solution**: 
1. Create a role with API permissions
2. Assign the role to users
3. Enable proper API configuration

```bash
# Create role
auth0 roles create --name "Trading User" --description "User with trading API access"

# Add API permissions to role  
auth0 roles permissions add <role-id> --api-id <api-id> --permissions read:data,write:data,execute:trades

# Assign role to user
auth0 users roles assign "<user-id>" --roles <role-id>
```

**Critical Learning**: Client grants do NOT work for Native applications - they only work for Machine-to-Machine applications. Native apps require role-based permissions.

### 2. MCP Inspector Callback URL Hardcoding

**Problem**: MCP Inspector ignores DCR response redirect URIs and hardcodes `http://localhost:6274/oauth/callback`.

**Solution**: Configure Auth0 application with the hardcoded callback URL rather than trying to configure it through DCR.

**Learning**: Some OAuth clients have hardcoded behaviors that override standard OAuth flows.

### 3. CORS Issues with Direct Auth0 Access

**Problem**: MCP Inspector couldn't fetch OAuth metadata directly from Auth0 due to CORS restrictions.

**Solution**: Implement OAuth metadata discovery endpoints with CORS headers:
- `/.well-known/oauth-protected-resource`
- `/.well-known/oauth-authorization-server` 
- `/register` (DCR endpoint)

### 4. Auth0 API Configuration Requirements

**Critical Auth0 API Settings**:
```json
{
  "enforce_policies": true,
  "token_dialect": "access_token_authz",
  "skip_consent_for_verifiable_first_party_clients": false,
  "allow_offline_access": true
}
```

**Learning**: 
- `enforce_policies: true` is required for RBAC to work
- `token_dialect: "access_token_authz"` ensures proper token format
- `skip_consent_for_verifiable_first_party_clients: false` forces consent screen for API scopes

### 5. OAuth Flow Implementation

**Architecture**: Server handles authorization flow with direct Auth0 token exchange:

```javascript
// Authorization proxy - adds audience parameter and redirects to Auth0
app.get('/authorize', (req, res) => {
  const authUrl = new URL('https://tenant.auth0.com/authorize');
  // Copy all query parameters
  Object.entries(req.query).forEach(([key, value]) => {
    authUrl.searchParams.set(key, value);
  });
  // Add audience for API access
  authUrl.searchParams.set('audience', 'https://api.example.com');
  res.redirect(authUrl.toString());
});

// Clients exchange tokens directly with Auth0
// Clients must include audience parameter in their token requests to:
// POST https://tenant.auth0.com/oauth/token
```

## Auth0 Configuration Checklist

### API Configuration
- [ ] Create API with proper identifier (audience)
- [ ] Define all required scopes
- [ ] Set `enforce_policies: true`
- [ ] Set `token_dialect: "access_token_authz"`
- [ ] Set `skip_consent_for_verifiable_first_party_clients: false`
- [ ] Enable `allow_offline_access: true` if refresh tokens needed

### Application Configuration  
- [ ] Create Native application (not Machine-to-Machine)
- [ ] Configure callback URLs (including MCP Inspector's hardcoded URL)
- [ ] Set allowed origins for CORS
- [ ] Enable Authorization Code + PKCE grant type

### Role-Based Access Control
- [ ] Create roles for different user types
- [ ] Add API permissions to roles using CLI: `auth0 roles permissions add`
- [ ] Assign roles to users: `auth0 users roles assign`

### Testing Verification
- [ ] DCR request includes all required scopes
- [ ] Authorization request includes `audience` parameter
- [ ] Token request includes `audience` parameter  
- [ ] Token response includes API scopes in `scope` field
- [ ] Token response includes API permissions in `permissions` array

## Common Pitfalls

1. **Client Grants Confusion**: Don't try to use client grants for Native applications - they only work for M2M flows.

2. **Missing Audience Parameter**: Auth0 requires `audience` parameter in authorization and token requests to include API scopes.

3. **Role Assignment**: Users must have roles with API permissions assigned, not just application access.

4. **CORS Configuration**: Auth0 doesn't serve OAuth metadata with CORS headers, requiring discovery endpoint proxy.

5. **Consent Screen**: Disabling consent can prevent API scopes from being requested properly.

## Debugging Tools

### Comprehensive HTTP Logging
Implemented detailed request/response logging for all endpoints:
- Request correlation with unique IDs
- Complete header and body logging  
- Response duration tracking
- Outbound Auth0 API request/response logging

### Auth0 CLI Commands
```bash
# Verify API configuration
auth0 apis show <api-id> --json

# Check user roles
auth0 users show "<user-id>" --json

# List role permissions
auth0 roles permissions list <role-id>

# Test token contents (decode JWT)
echo "<jwt-token>" | base64 -d
```

### Token Verification
Always verify token contents contain:
- Correct `aud` (audience) array including API identifier
- All requested scopes in `scope` field
- All user permissions in `permissions` array

## Success Metrics

✅ **Working OAuth Flow**:
- DCR returns client configuration with all scopes
- Authorization includes API audience parameter
- Token response includes: `"scope": "openid profile read:data write:data execute:trades"`
- Token response includes: `"permissions": ["read:data", "write:data", "execute:trades"]`

✅ **MCP Inspector Integration**:
- Successfully registers client via DCR
- Completes authorization flow with consent screen showing API scopes
- Receives access token with API permissions
- Can make authenticated requests to protected resources

## Future Considerations

1. **User Management**: Implement automated role assignment for new users
2. **Scope Management**: Dynamic scope requests based on client needs
3. **Token Refresh**: Implement refresh token handling for long-lived sessions
4. **Error Handling**: Enhanced error responses for OAuth failures
5. **Security**: Rate limiting and additional validation for production use

## References

- [Auth0 Authorization Code + PKCE Flow](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow-with-proof-key-for-code-exchange-pkce)
- [Auth0 Role-Based Access Control](https://auth0.com/docs/manage-users/access-control/rbac)
- [MCP OAuth Specification](https://spec.modelcontextprotocol.io/specification/server/authentication/)
- [OAuth 2.0 Dynamic Client Registration](https://tools.ietf.org/html/rfc7591) 