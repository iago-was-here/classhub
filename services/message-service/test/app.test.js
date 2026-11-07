const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { createApp } = require('../src/app');
const { NotChannelMemberError } = require('../src/message-store');
const CHANNEL_ID = '123e4567-e89b-42d3-a456-426614174000';

let server;
let baseUrl;
let created;
let listed;

before(async () => {
    const app = createApp({
        authClient: {
            async validateToken(token) {
                if (token === 'valid-token') return { id: 'user-123' };
                if (token === 'other-token') return { id: 'other-user' };
                return null;
            }
        },
        messageStore: {
            async healthCheck() {},
            async createChannel(input) {
                return { id: CHANNEL_ID, ...input, memberCount: 1, isMember: true };
            },
            async listChannels() {
                return [{ id: CHANNEL_ID, name: 'Sistemas Distribuídos', isMember: false }];
            },
            async subscribe() { return true; },
            async unsubscribe() { return true; },
            async create(input) {
                if (input.authorId === 'other-user') throw new NotChannelMemberError();
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
    const response = await fetch(`${baseUrl}/api/channels/${CHANNEL_ID}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '  Olá turma  ', token: 'valid-token' })
    });

    assert.equal(response.status, 201);
    assert.deepEqual(created, { channelId: CHANNEL_ID, authorId: 'user-123', text: 'Olá turma' });
    assert.equal((await response.json()).message.id, 'message-123');
});

test('rejects invalid tokens and malformed message content', async () => {
    const unauthorized = await fetch(`${baseUrl}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Olá', token: 'invalid-token' })
    });
    assert.equal(unauthorized.status, 401);

    const invalidMessage = await fetch(`${baseUrl}/api/channels/${CHANNEL_ID}/messages`, {
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
    const response = await fetch(`${baseUrl}/api/channels/${CHANNEL_ID}/messages?limit=500`, {
        headers: { Authorization: 'Bearer valid-token' }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(listed, {
        channelId: CHANNEL_ID,
        userId: 'user-123',
        limit: 100,
        before: null
    });
});

test('creates discoverable channels and supports idempotent subscriptions', async () => {
    const headers = {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token'
    };
    const createdChannel = await fetch(`${baseUrl}/api/channels`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: ' Sistemas Distribuídos ', description: 'Estudos' })
    });
    assert.equal(createdChannel.status, 201);
    assert.equal((await createdChannel.json()).channel.isMember, true);

    const listedChannels = await fetch(`${baseUrl}/api/channels`, { headers });
    assert.equal((await listedChannels.json()).channels[0].isMember, false);

    const subscribed = await fetch(`${baseUrl}/api/channels/${CHANNEL_ID}/subscriptions`, {
        method: 'POST',
        headers
    });
    assert.equal(subscribed.status, 201);
    assert.deepEqual(await subscribed.json(), { success: true, subscribed: true });
});

test('requires a valid channel id for legacy message routes', async () => {
    const response = await fetch(`${baseUrl}/api/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid-token'
        },
        body: JSON.stringify({ text: 'Sem canal' })
    });
    assert.equal(response.status, 400);
});

test('prevents users outside the channel from sending messages', async () => {
    const response = await fetch(`${baseUrl}/api/channels/${CHANNEL_ID}/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer other-token'
        },
        body: JSON.stringify({ text: 'Não sou membro' })
    });
    assert.equal(response.status, 403);
});

test('reports database readiness', async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
});