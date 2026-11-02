const cors = require('cors');
const express = require('express');

const MAX_MESSAGE_LENGTH = 5000;

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

    app.get('/health', async (req, res) => {
        try {
            await messageStore.healthCheck();
            return res.status(200).json({ status: 'ok' });
        } catch (error) {
            return res.status(503).json({ status: 'unavailable' });
        }
    });

    app.post('/api/messages', async (req, res) => {
        const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
        if (!text || text.length > MAX_MESSAGE_LENGTH) {
            return res.status(400).json({
                success: false,
                error: `A mensagem deve conter entre 1 e ${MAX_MESSAGE_LENGTH} caracteres`
            });
        }

        const user = await authenticate(req, res);
        if (!user) return undefined;

        try {
            const message = await messageStore.create({ authorId: user.id, text });
            return res.status(201).json({ success: true, message });
        } catch (error) {
            console.error('[Message Service] Falha ao persistir mensagem:', error.message);
            return res.status(503).json({ success: false, error: 'Não foi possível salvar a mensagem' });
        }
    });

    app.get('/api/messages', async (req, res) => {
        const user = await authenticate(req, res);
        if (!user) return undefined;

        const parsedLimit = Number(req.query.limit || 50);
        const limit = Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 50;
        const before = req.query.before || null;
        if (before && Number.isNaN(Date.parse(before))) {
            return res.status(400).json({ success: false, error: 'Cursor de paginação inválido' });
        }

        try {
            const messages = await messageStore.list({ limit, before });
            return res.status(200).json({ success: true, messages });
        } catch (error) {
            console.error('[Message Service] Falha ao consultar mensagens:', error.message);
            return res.status(503).json({ success: false, error: 'Não foi possível consultar mensagens' });
        }
    });

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