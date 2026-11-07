const cors = require('cors');
const express = require('express');
const { ChannelNotFoundError, NotChannelMemberError } = require('./message-store');

const MAX_MESSAGE_LENGTH = 5000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getToken(req) {
    const authorization = req.get('authorization') || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : req.body?.token;
}

function createApp({ authClient, messageStore }) {
    const app = express();
    app.disable('x-powered-by');
    app.use(cors());
    app.use(express.json({ limit: '16kb' }));

    async function authenticate(req, res) {
        const token = getToken(req);
        if (typeof token !== 'string' || !token.trim()) {
            res.status(401).json({ success: false, error: 'Autenticação obrigatória' });
            return null;
        }

        try {
            const user = await authClient.validateToken(token.trim());
            if (!user) {
                res.status(401).json({ success: false, error: 'Token inválido ou expirado' });
                return null;
            }
            return user;
        } catch (error) {
            res.status(503).json({ success: false, error: 'Serviço de autenticação indisponível' });
            return null;
        }
    }

    function handleStoreError(res, error, fallbackMessage) {
        if (error instanceof ChannelNotFoundError) {
            return res.status(404).json({ success: false, error: 'Canal não encontrado' });
        }
        if (error instanceof NotChannelMemberError) {
            return res.status(403).json({ success: false, error: 'Inscreva-se no canal para acessar as mensagens' });
        }
        if (error.code === '23503') {
            return res.status(404).json({ success: false, error: 'Canal ou usuário não encontrado' });
        }
        console.error('[Message Service] Falha na operação:', error.message);
        return res.status(503).json({ success: false, error: fallbackMessage });
    }

    function validChannelId(channelId) {
        return typeof channelId === 'string' && UUID_PATTERN.test(channelId);
    }

    async function channelIdForRequest(req, res) {
        const channelId = req.params.channelId || req.body?.channelId || req.query.channelId;
        if (!validChannelId(channelId)) {
            res.status(400).json({ success: false, error: 'ID de canal inválido ou ausente' });
            return null;
        }
        return channelId;
    }

    app.get('/health', async (req, res) => {
        try {
            await messageStore.healthCheck();
            return res.status(200).json({ status: 'ok' });
        } catch (error) {
            return res.status(503).json({ status: 'unavailable' });
        }
    });

    app.get('/api/channels', async (req, res) => {
        const user = await authenticate(req, res);
        if (!user) return undefined;

        try {
            const channels = await messageStore.listChannels({ userId: user.id });
            return res.status(200).json({ success: true, channels });
        } catch (error) {
            return handleStoreError(res, error, 'Não foi possível consultar os canais');
        }
    });

    app.post('/api/channels', async (req, res) => {
        const user = await authenticate(req, res);
        if (!user) return undefined;

        const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
        const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
        if (!name || name.length > 120 || description.length > 1000) {
            return res.status(400).json({
                success: false,
                error: 'Nome do canal (1 a 120 caracteres) e descrição (até 1000 caracteres) inválidos'
            });
        }

        try {
            const channel = await messageStore.createChannel({ userId: user.id, name, description });
            return res.status(201).json({ success: true, channel });
        } catch (error) {
            return handleStoreError(res, error, 'Não foi possível criar o canal');
        }
    });

    app.post('/api/channels/:channelId/subscriptions', async (req, res) => {
        const user = await authenticate(req, res);
        if (!user) return undefined;
        const channelId = await channelIdForRequest(req, res);
        if (!channelId) return undefined;

        try {
            const subscribed = await messageStore.subscribe({ channelId, userId: user.id });
            return res.status(subscribed ? 201 : 200).json({ success: true, subscribed: true });
        } catch (error) {
            return handleStoreError(res, error, 'Não foi possível se inscrever no canal');
        }
    });

    app.delete('/api/channels/:channelId/subscriptions', async (req, res) => {
        const user = await authenticate(req, res);
        if (!user) return undefined;
        const channelId = await channelIdForRequest(req, res);
        if (!channelId) return undefined;

        try {
            await messageStore.unsubscribe({ channelId, userId: user.id });
            return res.status(200).json({ success: true, subscribed: false });
        } catch (error) {
            return handleStoreError(res, error, 'Não foi possível sair do canal');
        }
    });

    async function createMessage(req, res) {
        const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
        if (!text || text.length > MAX_MESSAGE_LENGTH) {
            return res.status(400).json({
                success: false,
                error: `A mensagem deve conter entre 1 e ${MAX_MESSAGE_LENGTH} caracteres`
            });
        }

        const user = await authenticate(req, res);
        if (!user) return undefined;
        const channelId = await channelIdForRequest(req, res);
        if (!channelId) return undefined;

        try {
            const message = await messageStore.create({ channelId, authorId: user.id, text });
            return res.status(201).json({ success: true, message });
        } catch (error) {
            return handleStoreError(res, error, 'Não foi possível salvar a mensagem');
        }
    }

    app.post('/api/channels/:channelId/messages', createMessage);
    app.post('/api/messages', createMessage);

    async function listMessages(req, res) {
        const user = await authenticate(req, res);
        if (!user) return undefined;
        const channelId = await channelIdForRequest(req, res);
        if (!channelId) return undefined;

        const parsedLimit = Number(req.query.limit || 50);
        const limit = Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 50;
        const before = req.query.before || null;
        if (before && Number.isNaN(Date.parse(before))) {
            return res.status(400).json({ success: false, error: 'Cursor de paginação inválido' });
        }

        try {
            const messages = await messageStore.list({ channelId, userId: user.id, limit, before });
            return res.status(200).json({ success: true, messages });
        } catch (error) {
            return handleStoreError(res, error, 'Não foi possível consultar mensagens');
        }
    }

    app.get('/api/channels/:channelId/messages', listMessages);
    app.get('/api/messages', listMessages);

    app.use((error, req, res, next) => {
        if (error.type === 'entity.too.large') {
            return res.status(413).json({ success: false, error: 'Requisição muito grande' });
        }
        if (error instanceof SyntaxError && error.status === 400) {
            return res.status(400).json({ success: false, error: 'JSON inválido' });
        }
        console.error('[Message Service] Erro inesperado:', error.message);
        return res.status(500).json({ success: false, error: 'Erro interno' });
    });

    return app;
}

module.exports = { createApp };