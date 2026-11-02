const amqp = require('amqplib');

const QUEUE_NAME = 'classhub.messages';

function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isMessageEvent(event) {
    return Boolean(
        event &&
        typeof event.eventId === 'string' &&
        event.type === 'message.created' &&
        event.data &&
        typeof event.data.id === 'string' &&
        typeof event.data.authorId === 'string' &&
        typeof event.data.text === 'string'
    );
}

function startRabbitConsumer({
    url,
    onEvent,
    onConnectionChange = () => {},
    connect = amqp.connect,
    retryDelayMs = 3000
}) {
    let stopping = false;
    let connection;
    let channel;

    async function consumeMessage(message) {
        if (!message) return;
        let event;
        try {
            event = JSON.parse(message.content.toString());
        } catch (error) {
            console.error('[Notification Service] Evento JSON inválido descartado');
            channel.ack(message);
            return;
        }

        if (!isMessageEvent(event)) {
            console.error('[Notification Service] Evento incompatível descartado');
            channel.ack(message);
            return;
        }

        try {
            await onEvent(event);
            channel.ack(message);
        } catch (error) {
            console.error('[Notification Service] Falha ao distribuir evento:', error.message);
            channel.nack(message, false, true);
        }
    }

    async function run() {
        while (!stopping) {
            try {
                connection = await connect(url);
                connection.on('error', () => {});
                channel = await connection.createChannel();
                channel.on('error', () => {});
                await channel.assertQueue(QUEUE_NAME, { durable: true });
                await channel.prefetch(100);
                onConnectionChange(true);

                await new Promise((resolve, reject) => {
                    const disconnected = () => resolve();
                    connection.once('close', disconnected);
                    channel.once('close', disconnected);
                    channel.consume(QUEUE_NAME, consumeMessage, { noAck: false }).catch(reject);
                });
            } catch (error) {
                if (!stopping) {
                    console.error('[Notification Service] RabbitMQ indisponível:', error.message);
                }
            } finally {
                onConnectionChange(false);
                await channel?.close().catch(() => {});
                await connection?.close().catch(() => {});
                channel = undefined;
                connection = undefined;
            }

            if (!stopping) await delay(retryDelayMs);
        }
    }

    const worker = run();
    return async () => {
        stopping = true;
        await channel?.close().catch(() => {});
        await connection?.close().catch(() => {});
        await worker;
    };
}

module.exports = { QUEUE_NAME, isMessageEvent, startRabbitConsumer };