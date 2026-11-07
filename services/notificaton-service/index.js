const { Pool } = require('pg');
const { createAuthClient } = require('./src/auth-client');
const { createNotificationStore } = require('./src/notification-store');
const { createNotificationServer } = require('./src/server');
const { startRabbitConsumer } = require('./src/rabbit-consumer');

const PORT = Number(process.env.PORT || 8083);
const RABBITMQ_URL = process.env.RABBITMQ_URL || `amqp://${process.env.RABBITMQ_USER || 'guest'}:${process.env.RABBITMQ_PASSWORD || 'guest'}@${process.env.RABBITMQ_HOST || 'localhost'}:${process.env.RABBITMQ_PORT || 5672}`;
const authClient = createAuthClient({
    url: process.env.AUTH_URL || 'http://localhost:8081/api/auth/validate'
});
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'communication',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: Number(process.env.DB_POOL_MAX || 10),
    connectionTimeoutMillis: 5000
});
const notificationStore = createNotificationStore(pool);
const notificationServer = createNotificationServer({
    authClient,
    notificationStore,
    allowedOrigins: (process.env.WS_ALLOWED_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
});

const server = notificationServer.server.listen(PORT, () => {
    console.log(`Notification Service rodando na porta ${PORT}`);
});

const stopConsumer = startRabbitConsumer({
    url: RABBITMQ_URL,
    onEvent: async (event) => {
        const memberIds = await notificationStore.listChannelMemberIds(event.data.channelId);
        notificationServer.broadcast(event, memberIds);
    },
    onConnectionChange: notificationServer.setBrokerReady
});

async function shutdown() {
    await stopConsumer();
    await notificationServer.close();
    await pool.end();
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
