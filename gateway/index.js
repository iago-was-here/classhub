const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

// Log para provar que a requisição entrou na portaria
app.use((req, res, next) => {
    console.log(`[API Gateway] Requisição cruzando a portaria: ${req.method} ${req.url}`);
    next();
});

const messagesProxy = createProxyMiddleware({ 
    target: 'http://localhost:8082', 
    changeOrigin: true 
});

const authProxy = createProxyMiddleware({ 
    target: 'http://auth-service:8081', 
    changeOrigin: true 
});

// O próprio Gateway avalia a rota original e decide para qual proxy mandar
app.use((req, res, next) => {
    if (req.url.startsWith('/api/messages')) {
        return messagesProxy(req, res, next);
    }
    if (req.url.startsWith('/api/auth')) {
        return authProxy(req, res, next);
    }
    next();
});

app.get('/', (req, res) => {
    res.send('O Gateway do Classhub está no ar!');
});

app.listen(PORT, () => {
    console.log(`API Gateway do Classhub rodando na porta ${PORT}`);
});