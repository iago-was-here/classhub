const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const indexPath = path.join(__dirname, 'index.html');

const server = http.createServer((req, res) => {
    if (req.method !== 'GET' || req.url !== '/') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Página não encontrada');
    }

    fs.readFile(indexPath, (error, content) => {
        if (error) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end('Erro ao carregar o frontend');
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(content);
    });
});

server.listen(PORT, () => {
    console.log(`Frontend temporário rodando na porta ${PORT}`);
});
