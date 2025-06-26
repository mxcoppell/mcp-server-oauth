#!/usr/bin/env node

const jwt = require('jsonwebtoken');

const secret = process.env.OAUTH_JWT_SECRET || 'demo-secret-key-for-testing';
const issuer = process.env.OAUTH_ISSUER || 'https://signin.tradestation.com';
const audience = process.env.OAUTH_AUDIENCE || 'https://api.tradestation.com';

const payload = {
    sub: 'test-user-123',
    aud: audience,
    iss: issuer,
    exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour from now
    iat: Math.floor(Date.now() / 1000),
    scope: 'read:account read:market_data trade:execute stream:market_feed',
    client_id: 'test-client'
};

const token = jwt.sign(payload, secret);

console.log('Test JWT Token Generated:');
console.log('='.repeat(50));
console.log(token);
console.log('='.repeat(50));
console.log('\nToken Payload:');
console.log(JSON.stringify(payload, null, 2));
console.log('\nUsage:');
console.log('Authorization: Bearer ' + token);
console.log('\nExpires:', new Date(payload.exp * 1000).toISOString()); 