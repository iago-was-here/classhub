const amqp = require('amqplib');

const QUEUE_NAME = 'notifications.message-created.v1';

function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function sendConfirmed(channel, event) {
    return new Promise((resolve, reject) => {
        channel.sendToQueue(
            QUEUE_NAME,
            Buffer.from(JSON.stringify(event.payload)),
            {
                persistent: true,
                contentType: 'application/json',
                messageId: event.id,
                timestamp: Date.now()
            },
            (error) => error ? reject(error) : resolve()
        );
    });
}

async function publishNext(pool, channel) {
    const client = await pool.connect();
    let event;
    try {
        await client.query('BEGIN');
        const result = await client.query(
            `SELECT id, payload
             FROM message_outbox
             WHERE published_at IS NULL AND available_at <= NOW()
             ORDER BY created_at, id
             FOR UPDATE SKIP LOCKED
             LIMIT 1`
        );
        event = result.rows[0];
        if (!event) {
            await client.query('COMMIT');
            return false;
        }

        await sendConfirmed(channel, event);
        await client.query('UPDATE message_outbox SET published_at = NOW() WHERE id = $1', [event.id]);
        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        if (event) {
            await pool.query(
                `UPDATE message_outbox
                 SET attempts = attempts + 1,
                     available_at = NOW() + LEAST(INTERVAL '5 minutes', INTERVAL '1 second' * power(2, LEAST(attempts, 8))),
                     last_error = $2
                 WHERE id = $1`,
                [event.id, error.message.slice(0, 1000)]
            ).catch(() => {});
        }
        throw error;
    } finally {
        client.release();
    }
}

function startOutboxPublisher(pool, { url }) {
    let stopped = false;
    let connection;

    const run = async () => {
        while (!stopped) {
            try {
                connection = await amqp.connect(url);
                connection.on('error', () => {});
                const channel = await connection.createConfirmChannel();
                channel.on('error', () => {});
                await channel.assertQueue(QUEUE_NAME, { durable: true });

                while (!stopped) {
                    if (!(await publishNext(pool, channel))) await delay(1000);
                }
                await channel.close().catch(() => {});
                await connection.close().catch(() => {});
            } catch (error) {
                console.error('[Message Service] Publisher RabbitMQ indisponível:', error.message);
                await connection?.close().catch(() => {});
                connection = undefined;
                if (!stopped) await delay(3000);
            }
        }
    };

    const worker = run();
    return async () => {
        stopped = true;
        await connection?.close().catch(() => {});
        await worker;
    };
}

module.exports = { startOutboxPublisher };