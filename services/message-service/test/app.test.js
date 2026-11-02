const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { createApp } = require('../src/app');

let server;
let baseUrl;
let created;
let listed;

before(async () => {
    const app = createApp({
        authClient: {
            async validateToken(token) {
                return token === 'valid-token' ? { id: 'user-123' } : null;
            }
        },
        messageStore: {
            async healthCheck() {},
            async create(input) {
                created = input;
                return { id: 'message-123', ...input, createdAt: '2026-01-01T00:00:00.000Z' };
            },
            async list(input) {
                listed = input;
                return [];
            }
        }
    });
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('persists an authenticated message and accepts the legacy body token', async () => {
    const response = await fetch(`${baseUrl}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '  Olá turma  ', token: 'valid-token' })
    });

    assert.equal(response.status, 201);
    assert.deepEqual(created, { authorId: 'user-123', text: 'Olá turma' });
    assert.equal((await response.json()).message.id, 'message-123');
});

test('rejects invalid tokens and malformed message content', async () => {
    const unauthorized = await fetch(`${baseUrl}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Olá', token: 'invalid-token' })
    });
    assert.equal(unauthorized.status, 401);

    const invalidMessage = await fetch(`${baseUrl}/api/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid-token'
        },
        body: JSON.stringify({ text: '   ' })
    });
    assert.equal(invalidMessage.status, 400);
});

test('lists messages with bounded pagination for authenticated users', async () => {
    const response = await fetch(`${baseUrl}/api/messages?limit=500`, {
        headers: { Authorization: 'Bearer valid-token' }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(listed, { limit: 100, before: null });
});

test('reports database readiness', async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
});