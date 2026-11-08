const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

app.use((req, res, next) => {
    console.log(`[API Gateway] Requisição: ${req.method} ${req.url}`);
    next();
});

const routes = {
    '/api/auth': process.env.AUTH_SERVICE_URL || 'http://auth-service:8081',
    '/api/messages': process.env.MESSAGE_SERVICE_URL || 'http://message-service:8082',
    '/api/channels': process.env.MESSAGE_SERVICE_URL || 'http://message-service:8082'
};

for (const [pathPrefix, targetUrl] of Object.entries(routes)) {
    app.use(createProxyMiddleware({
        pathFilter: pathPrefix,
        target: targetUrl,
        changeOrigin: true,
        onError: (err, req, res) => {
            console.error(`[Gateway Error] Falha ao rotear para ${targetUrl}:`, err.message);
            res.status(503).json({ success: false, error: 'Serviço temporariamente indisponível' });
        }
    }));
}

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'Gateway OK' });
});

app.listen(PORT, () => {
    console.log(`API Gateway do Classhub rodando na porta ${PORT}`);
});