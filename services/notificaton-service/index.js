const http = require('http');

const PORT = process.env.PORT || 8083;

const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'ok' }));
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Rota não encontrada' }));
});

server.listen(PORT, () => {
    console.log(`Notification Service rodando na porta ${PORT}`);
});
