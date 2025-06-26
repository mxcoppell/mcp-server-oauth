import jwt from 'jsonwebtoken';
import { OAuthTokenPayload, AuthorizationContext, ServerConfig } from '../types/index.js';

export class TokenValidator {
    private config: ServerConfig;

    constructor(config: ServerConfig) {
        this.config = config;
    }

    validateToken(token: string): OAuthTokenPayload {
        if (!this.config.enableAuth) {
            throw new Error('Authentication is disabled');
        }

        try {
            const decoded = jwt.verify(token, this.config.oauthJwtSecret) as OAuthTokenPayload;

            // Validate audience
            if (decoded.aud !== this.config.oauthAudience) {
                throw new Error('Invalid audience');
            }

            // Validate issuer
            if (decoded.iss !== this.config.oauthIssuer) {
                throw new Error('Invalid issuer');
            }

            // Check expiration
            const now = Math.floor(Date.now() / 1000);
            if (decoded.exp < now) {
                throw new Error('Token expired');
            }

            return decoded;
        } catch (error) {
            if (error instanceof jwt.JsonWebTokenError) {
                throw new Error('Invalid token');
            }
            throw error;
        }
    }

    extractBearerToken(authHeader?: string): string | null {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }
        return authHeader.substring(7);
    }

    createAuthContext(authHeader?: string): AuthorizationContext {
        if (!this.config.enableAuth) {
            return { isAuthorized: true };
        }

        const token = this.extractBearerToken(authHeader);
        if (!token) {
            return { isAuthorized: false };
        }

        try {
            const payload = this.validateToken(token);
            return {
                token,
                payload,
                isAuthorized: true,
            };
        } catch (error) {
            return {
                token,
                isAuthorized: false,
            };
        }
    }

    generateWWWAuthenticateHeader(): string {
        return `Bearer resource_metadata="http://localhost:${this.config.httpPort}/.well-known/oauth-protected-resource"`;
    }
} 