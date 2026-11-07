const { randomUUID } = require('node:crypto');

class ChannelNotFoundError extends Error {}
class NotChannelMemberError extends Error {}

function mapMessage(row) {
    return {
        id: row.id,
        channelId: row.channel_id,
        authorId: row.user_id,
        author: row.author || null,
        text: row.text,
        createdAt: row.created_at
    };
}

function mapChannel(row) {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        createdBy: row.created_by,
        createdAt: row.created_at,
        memberCount: Number(row.member_count || 0),
        isMember: Boolean(row.is_member)
    };
}

async function assertChannelMembership(queryable, channelId, userId) {
    const result = await queryable.query(
        `SELECT channels.id, channel_members.user_id
         FROM channels
         LEFT JOIN channel_members
           ON channel_members.channel_id = channels.id
          AND channel_members.user_id = $2
         WHERE channels.id = $1`,
        [channelId, userId]
    );
    if (result.rowCount === 0) throw new ChannelNotFoundError('Canal não encontrado');
    if (!result.rows[0].user_id) throw new NotChannelMemberError('Inscrição no canal obrigatória');
}

function createMessageStore(pool) {
    return {
        async healthCheck() {
            await pool.query('SELECT 1');
        },

        async createChannel({ userId, name, description }) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const result = await client.query(
                    `INSERT INTO channels (name, description, created_by)
                     VALUES ($1, $2, $3)
                     RETURNING id, name, description, created_by, created_at`,
                    [name, description, userId]
                );
                const channel = result.rows[0];
                await client.query(
                    'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)',
                    [channel.id, userId]
                );
                await client.query('COMMIT');
                return mapChannel({ ...channel, member_count: 1, is_member: true });
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        },

        async listChannels({ userId }) {
            const result = await pool.query(
                `SELECT channels.id, channels.name, channels.description,
                        channels.created_by, channels.created_at,
                        COUNT(members.user_id)::integer AS member_count,
                        BOOL_OR(members.user_id = $1) AS is_member
                 FROM channels
                 LEFT JOIN channel_members AS members ON members.channel_id = channels.id
                 GROUP BY channels.id
                 ORDER BY channels.name, channels.id`,
                [userId]
            );
            return result.rows.map(mapChannel);
        },

        async subscribe({ channelId, userId }) {
            const result = await pool.query(
                `INSERT INTO channel_members (channel_id, user_id)
                 SELECT id, $2 FROM channels WHERE id = $1
                 ON CONFLICT DO NOTHING
                 RETURNING channel_id`,
                [channelId, userId]
            );
            if (result.rowCount > 0) return true;

            const channel = await pool.query('SELECT 1 FROM channels WHERE id = $1', [channelId]);
            if (channel.rowCount === 0) throw new ChannelNotFoundError('Canal não encontrado');
            return false;
        },

        async unsubscribe({ channelId, userId }) {
            const result = await pool.query(
                'DELETE FROM channel_members WHERE channel_id = $1 AND user_id = $2 RETURNING channel_id',
                [channelId, userId]
            );
            if (result.rowCount > 0) return true;

            const channel = await pool.query('SELECT 1 FROM channels WHERE id = $1', [channelId]);
            if (channel.rowCount === 0) throw new ChannelNotFoundError('Canal não encontrado');
            return false;
        },

        async create({ channelId, authorId, text }) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                await assertChannelMembership(client, channelId, authorId);
                const result = await client.query(
                    `INSERT INTO messages (channel_id, user_id, text)
                     VALUES ($1, $2, $3)
                     RETURNING id, channel_id, user_id, text, created_at`,
                    [channelId, authorId, text]
                );
                const message = result.rows[0];
                const author = await client.query('SELECT username FROM users WHERE id = $1', [authorId]);
                message.author = author.rows[0]?.username || null;
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

        async list({ channelId, userId, limit, before }) {
            await assertChannelMembership(pool, channelId, userId);
            const result = await pool.query(
                `SELECT m.id, m.user_id, u.username AS author, m.text, m.created_at
                 FROM messages m
                 JOIN users u ON u.id = m.user_id
                 WHERE m.channel_id = $1
                   AND ($3::timestamptz IS NULL OR m.created_at < $3)
                 ORDER BY m.created_at DESC, m.id DESC
                 LIMIT $2`,
                [channelId, limit, before || null]
            );
            return result.rows.map(mapMessage).reverse();
        }
    };
}

module.exports = {
    ChannelNotFoundError,
    NotChannelMemberError,
    createMessageStore
};