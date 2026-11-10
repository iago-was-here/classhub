const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { WebSocket } = require('ws');
const { createNotificationServer } = require('../src/server');

let service;
let baseUrl;

before(async () => {
    service = createNotificationServer({
        authClient: {
            async validateToken(token) {
                if (token === 'valid-token') return { id: 'user-123' };
                if (token === 'other-token') return { id: 'user-456' };
                if (token === 'auth-down') throw new Error('auth unavailable');
                return null;
            }
        },
        notificationStore: { async healthCheck() {} },
        allowedOrigins: ['http://localhost:3000']
    });
    service.setBrokerReady(true);
    service.server.listen(0);
    await new Promise((resolve) => service.server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${service.server.address().port}`;
});

after(async () => {
    await service.close();
});

test('reports broker readiness over HTTP', async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', connectedClients: 0 });
});

test('broadcasts events only to authenticated WebSocket clients', async () => {
    const websocket = new WebSocket(`${baseUrl.replace('http', 'ws')}/ws?token=valid-token`, {
        origin: 'http://localhost:3000'
    });
    const otherWebsocket = new WebSocket(`${baseUrl.replace('http', 'ws')}/ws?token=other-token`, {
        origin: 'http://localhost:3000'
    });
    await Promise.all([websocket, otherWebsocket].map((client) => new Promise((resolve, reject) => {
        client.once('open', resolve);
        client.once('error', reject);
    })));
    const excluded = new Promise((resolve) => {
        otherWebsocket.once('message', () => resolve(false));
        setTimeout(() => resolve(true), 50);
    });

    const event = {
        eventId: 'event-123',
        type: 'message.created.v1',
        data: { id: 'message-123', channelId: 'channel-123', text: 'Olá' }
    };
    const received = new Promise((resolve, reject) => {
        websocket.once('message', (payload) => resolve(JSON.parse(payload.toString())));
        websocket.once('error', reject);
    });
    service.broadcast(event, ['user-123']);

    assert.deepEqual(await received, event);
    assert.equal(await excluded, true);
    websocket.close();
    otherWebsocket.close();
});

test('rejects invalid tokens, unavailable auth and untrusted origins', async () => {
    const invalidToken = new WebSocket(`${baseUrl.replace('http', 'ws')}/ws?token=invalid-token`);
    const unauthorized = await new Promise((resolve, reject) => {
        invalidToken.once('unexpected-response', (request, response) => resolve(response.statusCode));
        invalidToken.once('error', reject);
    });
    assert.equal(unauthorized, 401);

    const authUnavailable = new WebSocket(`${baseUrl.replace('http', 'ws')}/ws?token=auth-down`);
    const unavailable = await new Promise((resolve, reject) => {
        authUnavailable.once('unexpected-response', (request, response) => resolve(response.statusCode));
        authUnavailable.once('error', reject);
    });
    assert.equal(unavailable, 503);

    const untrustedOrigin = new WebSocket(`${baseUrl.replace('http', 'ws')}/ws?token=valid-token`, {
        origin: 'https://untrusted.example'
    });
    const forbidden = await new Promise((resolve, reject) => {
        untrustedOrigin.once('unexpected-response', (request, response) => resolve(response.statusCode));
        untrustedOrigin.once('error', reject);
    });
    assert.equal(forbidden, 403);
});