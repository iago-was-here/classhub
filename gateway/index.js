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

app.use('/api/auth', createProxyMiddleware({
    target: 'http://localhost:8081',
    changeOrigin: true,
    pathRewrite: {
        '^/': '/api/auth/' 
    }
}));

app.use('/api/messages', createProxyMiddleware({
    target: 'http://localhost:8082',
    changeOrigin: true,
    pathRewrite: {
        '^/': '/api/messages/'
    }
}));

app.get('/', (req, res) => {
    res.send('O Gateway do Classhub está no ar!');
});

app.listen(PORT, () => {
    console.log(`API Gateway do Classhub rodando na porta ${PORT}`);
});