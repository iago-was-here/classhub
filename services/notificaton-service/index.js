const { createAuthClient } = require('./src/auth-client');
const { createNotificationServer } = require('./src/server');
const { startRabbitConsumer } = require('./src/rabbit-consumer');

const PORT = Number(process.env.PORT || 8083);
const RABBITMQ_URL = process.env.RABBITMQ_URL || `amqp://${process.env.RABBITMQ_USER || 'guest'}:${process.env.RABBITMQ_PASSWORD || 'guest'}@${process.env.RABBITMQ_HOST || 'localhost'}:${process.env.RABBITMQ_PORT || 5672}`;
const authClient = createAuthClient({
    url: process.env.AUTH_URL || 'http://localhost:8081/api/auth/validate'
});
const notificationServer = createNotificationServer({
    authClient,
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
    onEvent: notificationServer.broadcast,
    onConnectionChange: notificationServer.setBrokerReady
});

async function shutdown() {
    await stopConsumer();
    await notificationServer.close();
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
