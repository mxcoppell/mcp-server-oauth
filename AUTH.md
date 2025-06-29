# Authentication Architecture and Flow

This document outlines the authentication architecture for the MCP server. The core design principle is that the **MCP server supports the authorization flow at the edge but delegates the core authorization and token issuance logic to Auth0.** The MCP server is an active participant in the authentication flow, but it is not the ultimate source of identity. It acts as a secure facade to a dedicated, robust identity provider.

## Architecture Overview

The following diagram illustrates the high-level system architecture. It shows how the user, through an MCP client, interacts with all the supporting MCP server endpoints, which in turn rely on Auth0 for core identity services.

```mermaid
graph LR;
    User([User with<br>MCP Client]);

    subgraph "MCP Server (The Edge)"
        direction TB
        W1["/.well-known/oauth-<br>protected-resource"];
        W2["/.well-known/oauth-<br>authorization-server"];
        R["/register"];
        A["/authorize"];
    end

    subgraph "Auth0 (The Core)"  
        direction TB
        C("User Authentication");
        E("User Directory");
        D("Token Issuance");
        T["Auth0 /oauth/token"];
    end

    User -- "(1) Discovers" --> W1;
    User -- "(2) Discovers" --> W2;
    User -- "(3) Registers" --> R;
    User -- "(4) Authorizes" --> A;
    User -- "(5) Exchanges Token" --> T;

    A -- "delegates login to" --> C;
    C -- "checks" --> E;
    T -- "uses" --> D;

    style User fill:#2E86AB,stroke:#fff,stroke-width:2px,color:#fff
    style W1 fill:#602F01,stroke:#333,stroke-width:2px
    style W2 fill:#602F01,stroke:#333,stroke-width:2px
    style R fill:#602F01,stroke:#333,stroke-width:2px
    style A fill:#602F01,stroke:#333,stroke-width:2px
    style C fill:#C73E1D,stroke:#fff,stroke-width:2px,color:#fff
    style D fill:#C73E1D,stroke:#fff,stroke-width:2px,color:#fff
    style T fill:#C73E1D,stroke:#fff,stroke-width:2px,color:#fff
    style E fill:#A23B72,stroke:#fff,stroke-width:2px,color:#fff
```

-   **MCP Server (The Edge)**: This is the component that clients interact with directly. It exposes the necessary OAuth 2.0 endpoints but does not implement the core logic itself.
-   **Auth0 (The Core)**: This is our dedicated identity provider. It handles the heavy lifting of securely authenticating users, managing user profiles, and issuing cryptographically-signed access tokens.

## MCP Server Endpoints and Their Roles

The MCP server exposes several OAuth discovery endpoints that provide metadata about the Auth0 tenant. Here is a list of these endpoints and their specific roles:

-   **`/.well-known/oauth-protected-resource`**: A metadata endpoint that describes the protected resource (the API). It informs the client of the resource's identifier, available scopes, and the authorization server to use.
-   **`/.well-known/oauth-authorization-server`**: The authorization server discovery endpoint. It tells the client where to find key endpoints (`/authorize`, `/register`) and the Auth0 token endpoint, along with what capabilities are supported (grant types, PKCE methods, etc.).
-   **`/register`**: The Dynamic Client Registration (DCR) endpoint. The client calls this to register itself and receive a pre-configured Auth0 Application `client_id`.
-   **`/authorize`**: Initiates the user-interactive part of the flow. The server acts as a middleman, redirecting the user to the actual Auth0 Universal Login page with the correct parameters including the required `audience` parameter.

## High-Level Message Flow

This sequence diagram shows the step-by-step process of how a user gets authenticated, including the initial discovery and registration steps.

```mermaid
%%{init: {'theme':'base', 'themeVariables': { 'actorBkg': '#2E86AB', 'actorTextColor': '#fff', 'actorBorder': '#fff', 'c0': '#8B4513', 'c1': '#556B2F', 'c2': '#4682B4', 'c3': '#8B0000', 'actor0': '#2E86AB', 'actor1': '#8B4513', 'actor2': '#556B2F', 'actor3': '#8B0000', 'signalColor': '#ddd', 'signalTextColor': '#ddd', 'labelBoxBkgColor': '#444', 'labelTextColor': '#fff', 'loopTextColor': '#fff', 'noteTextColor': '#fff', 'noteBkgColor': '#555', 'noteBorderColor': '#777', 'activationBkgColor': '#666', 'activationBorderColor': '#888', 'sequenceNumberColor': '#fff' }}}%%
sequenceDiagram
    actor User
    participant Client as MCP Client
    participant Server as MCP Server (Edge)
    participant Auth0 as Auth0 (Core)

    User->>Client: 1. Start using the tool
    Client->>+Server: Initial request (unauthenticated)
    Server-->>-Client: 401 Unauthorized + WWW-Authenticate

    rect rgb(80, 60, 40)
        note over Client,Server: Discovery & Registration (Edge)
        Client->>+Server: GET /.well-known/oauth-protected-resource
        Server-->>-Client: Returns resource metadata
        Client->>+Server: GET /.well-known/oauth-authorization-server
        Server-->>-Client: Returns AS metadata
        Client->>+Server: POST /register
        Server-->>-Client: Returns client_id
    end

    rect rgb(70, 40, 40)
        note over Client,Auth0: Authorization Process (Core)
        Client->>+Server: Redirects user to /authorize
        Server->>+Auth0: Delegates login to Auth0
        User->>Auth0: Enters credentials & gives consent
        Auth0-->>-Client: Redirects user back with an authorization code
        Client->>+Auth0: Exchanges authorization code for token at Auth0 /oauth/token  
        Auth0-->>-Client: Issues secure Access Token directly
    end

    rect rgb(40, 60, 70)
        note over Client,Server: Authorized Access
        Client->>+Server: Makes request with Access Token
        Server-->>-Client: Grants access to resource
    end
```

## OAuth Discovery Implementation Details

To fully understand the MCP server's role in OAuth discovery, it's essential to look at the implementation of its OAuth metadata endpoints. These endpoints provide critical discovery and configuration information to integrate correctly with Auth0.

### Discovery Endpoints (`/.well-known/*`)

These endpoints follow IETF standards to allow clients to automatically discover how to interact with the protected resource and the authorization server.

1.  **`/.well-known/oauth-protected-resource`**: This is the first stop for a client. It returns a simple JSON object that describes the API itself (the "Resource Server"). Its primary function is to tell the client the API's `audience` and the URL of the authorization server that protects it.
2.  **`/.well-known/oauth-authorization-server`**: Once the client knows where the authorization server is, it queries this endpoint to get a detailed configuration object. This response contains all the URLs (`/authorize`, `/register`) along with Auth0's token endpoint (`/oauth/token`) and the supported methods (`grant_types`, `response_types`, `code_challenge_methods`) needed to perform the OAuth flow.

### Dynamic Client Registration (`/register`)

This endpoint is a mock implementation of the OAuth 2.0 Dynamic Client Registration (DCR) protocol.

**Necessity and Function:**

*   **Provides a Pre-configured `client_id`**: Instead of dynamically creating a new client, this endpoint's sole purpose is to return the **configured Auth0 `client_id`** (set via `OAUTH_CLIENT_ID` environment variable). This satisfies clients that are built to use DCR, allowing them to retrieve the necessary `client_id` to proceed with the authorization flow.
*   **Validates Redirect URIs**: It checks the `redirect_uris` requested by the client against a server-side allowlist, providing a layer of security.

### The `/authorize` Endpoint

This endpoint handles the first leg of the OAuth 2.0 Authorization Code Flow, where the user grants permission.

**Necessity and Function:**

1.  **Injects the `audience` Parameter**: Its primary role is to inject the `audience` parameter (configured via `OAUTH_AUDIENCE` environment variable) into the authorization request. The `audience` is a crucial piece of information that tells Auth0 which specific API the client is trying to access. Standard clients may not send this, so the local endpoint adds it to ensure the flow succeeds and the resulting token is correctly scoped for the API.
2.  **Enforces Scopes**: The endpoint programmatically ensures that all required scopes (like `openid`, `profile`, and API-specific scopes) are included in the request sent to Auth0. This centralizes security policy and guarantees the application receives the necessary permissions.
3.  **Abstracts the Identity Provider**: It receives the request at a local URL (`http://localhost:6060/authorize`) and then redirects the user's browser to the actual Auth0 tenant URL. This hides the specifics of the identity provider from the client, simplifying client configuration.

### Direct Auth0 Token Exchange

The token exchange happens directly between the client and Auth0's `/oauth/token` endpoint, without any local proxy.

**Client Requirements:**

1.  **Must Include `audience` Parameter**: Since there's no local proxy to inject the `audience` parameter, clients must include the `audience` parameter (matching your configured `OAUTH_AUDIENCE` value) in their token exchange requests to Auth0. This is critical for Auth0 to issue tokens scoped to the correct API.
2.  **PKCE Support**: Clients must support PKCE (Proof Key for Code Exchange) since the flow uses public clients without client secrets.
3.  **Direct HTTPS Communication**: Clients communicate directly with Auth0's secure endpoints, eliminating the need for a local token proxy.

## Security Considerations

The described design, using PKCE and direct Auth0 communication, is a standard and generally secure pattern. However, any design has potential risks to consider:

1.  **Redirect URI Validation**: The most critical risk in this flow is weak `redirect_uri` validation. The server at the `/authorize` endpoint *must* strictly validate that the `redirect_uri` in the request exactly matches one of the URIs pre-registered for that `client_id`. Failure to do so could allow an attacker to have the authorization code sent to a malicious site.
2.  **Client-Side Audience Parameter**: Since clients now communicate directly with Auth0 for token exchange, they must correctly include the `audience` parameter. Failure to do so will result in tokens that cannot be used to access the API. This shifts some responsibility to the client implementation.
3.  **Direct Auth0 Communication**: With direct client-to-Auth0 communication, the local server is no longer in the token exchange path, reducing the attack surface of the local proxy. However, clients must implement secure HTTPS communication with Auth0.
4.  **Dynamic Client Registration (DCR) Security**: If the `/register` endpoint is open and not properly secured, it could potentially be a vector for attack (e.g., allowing malicious clients to register). In the current flow, it is used to hand out a pre-existing configuration, which is safer. For production, access to this endpoint should be restricted. 