function createNotificationStore(pool) {
    return {
        async healthCheck() {
            await pool.query('SELECT 1');
        },

        async listChannelMemberIds(channelId) {
            const result = await pool.query(
                'SELECT user_id FROM channel_members WHERE channel_id = $1',
                [channelId]
            );
            return result.rows.map((row) => row.user_id);
        }
    };
}

module.exports = { createNotificationStore };