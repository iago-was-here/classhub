const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');
const { createApp } = require('./src/app');
const { createAuthClient } = require('./src/auth-client');
const { createMessageStore } = require('./src/message-store');
const { startOutboxPublisher } = require('./src/outbox-publisher');

const PORT = Number(process.env.PORT || 8082);
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'communication',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: Number(process.env.DB_POOL_MAX || 10),
    connectionTimeoutMillis: 5000
});

async function start() {
    const migrationPath = path.join(__dirname, 'migrations', '001_messages.sql');
    await pool.query(await fs.readFile(migrationPath, 'utf8'));

    const app = createApp({
        authClient: createAuthClient({
            url: process.env.AUTH_URL || 'http://localhost:8081/api/auth/validate'
        }),
        messageStore: createMessageStore(pool)
    });
    const server = app.listen(PORT, () => {
        console.log(`Message Service rodando na porta ${PORT}`);
    });
    const stopPublisher = startOutboxPublisher(pool, {
        url: process.env.RABBITMQ_URL || `amqp://${process.env.RABBITMQ_USER || 'guest'}:${process.env.RABBITMQ_PASSWORD || 'guest'}@${process.env.RABBITMQ_HOST || 'localhost'}:${process.env.RABBITMQ_PORT || 5672}`
    });

    async function shutdown() {
        server.close();
        await stopPublisher();
        await pool.end();
    }

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
}

start().catch(async (error) => {
    console.error('[Message Service] Falha ao iniciar:', error.message);
    await pool.end();
    process.exitCode = 1;
});