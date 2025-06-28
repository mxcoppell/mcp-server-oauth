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
            console.log('[Token Validation] Starting validation...');

            // TODO: Implement Auth0 JWT verification using JWKS
            // For now, decode without verification for development
            const decoded = jwt.decode(token) as OAuthTokenPayload;

            if (!decoded) {
                console.log('[Token Validation] FAILED: Invalid token format');
                throw new Error('Invalid token format');
            }

            console.log('[Token Validation] Decoded token:', {
                iss: decoded.iss,
                aud: decoded.aud,
                sub: decoded.sub,
                exp: decoded.exp,
                iat: decoded.iat
            });

            console.log('[Token Validation] Expected config:', {
                issuer: this.config.oauthIssuer,
                audience: this.config.oauthAudience
            });

            // Validate issuer with normalized comparison (remove trailing slash)
            const normalizeUrl = (url: string) => url.replace(/\/$/, '');
            const tokenIssuer = normalizeUrl(decoded.iss);
            const expectedIssuer = normalizeUrl(this.config.oauthIssuer);

            if (tokenIssuer !== expectedIssuer) {
                console.log('[Token Validation] FAILED: Issuer mismatch', {
                    tokenIssuer,
                    expectedIssuer,
                    originalTokenIssuer: decoded.iss,
                    originalExpectedIssuer: this.config.oauthIssuer
                });
                throw new Error('Invalid issuer');
            }

            console.log('[Token Validation] ✅ Issuer validation passed');

            // Validate audience - handle both string and array cases
            const isValidAudience = Array.isArray(decoded.aud)
                ? decoded.aud.includes(this.config.oauthAudience)
                : decoded.aud === this.config.oauthAudience;

            if (!isValidAudience) {
                console.log('[Token Validation] FAILED: Audience mismatch:', {
                    expected: this.config.oauthAudience,
                    received: decoded.aud,
                    type: Array.isArray(decoded.aud) ? 'array' : 'string'
                });
                throw new Error('Invalid audience');
            }

            console.log('[Token Validation] ✅ Audience validation passed');

            // Check expiration
            const now = Math.floor(Date.now() / 1000);
            if (decoded.exp < now) {
                console.log('[Token Validation] FAILED: Token expired', {
                    exp: decoded.exp,
                    now: now,
                    expired: (now - decoded.exp) + ' seconds ago'
                });
                throw new Error('Token expired');
            }

            console.log('[Token Validation] ✅ Expiration validation passed');
            console.log('[Token Validation] ✅ Token successfully validated for user:', decoded.sub);
            return decoded;
        } catch (error) {
            console.error('[Token Validation] ERROR:', error);
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