const { randomUUID } = require('node:crypto');

function mapMessage(row) {
    return {
        id: row.id,
        authorId: row.user_id,
        author: row.author || null,
        text: row.text,
        createdAt: row.created_at
    };
}

function createMessageStore(pool) {
    return {
        async healthCheck() {
            await pool.query('SELECT 1');
        },

        async create({ authorId, text }) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const result = await client.query(
                    `INSERT INTO messages (user_id, text)
                     VALUES ($1, $2)
                     RETURNING id, user_id, text, created_at`,
                    [authorId, text]
                );
                const message = result.rows[0];
                const eventId = randomUUID();
                const event = {
                    eventId,
                    type: 'message.created',
                    occurredAt: message.created_at,
                    data: mapMessage(message)
                };
                await client.query(
                    `INSERT INTO message_outbox (id, message_id, event_type, payload)
                     VALUES ($1, $2, $3, $4::jsonb)`,
                    [eventId, message.id, event.type, JSON.stringify(event)]
                );
                await client.query('COMMIT');
                return mapMessage(message);
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        },

        async list({ limit, before }) {
            const result = await pool.query(
                `SELECT m.id, m.user_id, u.username AS author, m.text, m.created_at
                 FROM messages m
                 JOIN users u ON u.id = m.user_id
                 WHERE ($2::timestamptz IS NULL OR m.created_at < $2)
                 ORDER BY m.created_at DESC, m.id DESC
                 LIMIT $1`,
                [limit, before || null]
            );
            return result.rows.map(mapMessage).reverse();
        }
    };
}

module.exports = { createMessageStore };