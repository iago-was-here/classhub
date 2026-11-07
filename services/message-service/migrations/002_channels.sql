CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    description VARCHAR(1000) NOT NULL DEFAULT '',
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS channels_created_at_idx
    ON channels (created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS channel_members (
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS channel_members_user_idx
    ON channel_members (user_id, channel_id);

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES channels(id) ON DELETE CASCADE;

INSERT INTO channels (name, description, created_by)
SELECT 'Geral', 'Canal legado para mensagens criadas antes da organização por canais.', users.id
FROM users
WHERE EXISTS (SELECT 1 FROM messages WHERE channel_id IS NULL)
ORDER BY users.created_at, users.id
LIMIT 1;

UPDATE messages
SET channel_id = (SELECT id FROM channels WHERE name = 'Geral' ORDER BY created_at, id LIMIT 1)
WHERE channel_id IS NULL;

INSERT INTO channel_members (channel_id, user_id)
SELECT DISTINCT messages.channel_id, messages.user_id
FROM messages
WHERE messages.channel_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE messages
    ALTER COLUMN channel_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS messages_channel_created_at_idx
    ON messages (channel_id, created_at DESC, id DESC);

UPDATE message_outbox AS outbox
SET payload = jsonb_set(
    outbox.payload,
    '{data,channelId}',
    to_jsonb(messages.channel_id::text),
    true
)
FROM messages
WHERE outbox.message_id = messages.id
  AND outbox.payload #> '{data,channelId}' IS NULL;