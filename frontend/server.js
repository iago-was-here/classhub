const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;

// Mapeamento de tipos MIME
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Método não permitido');
  }

  const parsedUrl = url.parse(req.url);
  let pathname = parsedUrl.pathname;

  // Redirecionamentos e rotas amigáveis
  if (pathname === '/' || pathname === '') {
    pathname = '/login.html';
  } else if (pathname === '/login') {
    pathname = '/login.html';
  } else if (pathname === '/cadastro') {
    pathname = '/cadastro.html';
  } else if (pathname === '/recuperacao') {
    pathname = '/recuperacao.html';
  } else if (pathname === '/chat' || pathname === '/dashboard' || pathname === '/app') {
    pathname = '/index.html';
  }

  // Previne Directory Traversal
  const safeSuffix = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safeSuffix);

  // Verifica se o arquivo existe dentro do diretório do frontend
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Acesso proibido');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Página não encontrada');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    if (req.method === 'HEAD') {
      return res.end();
    }

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  Frontend ClassHub rodando na porta ${PORT}`);
  console.log(`  Acesse: http://localhost:${PORT}`);
  console.log(`  Login:        http://localhost:${PORT}/login.html`);
  console.log(`  Cadastro:     http://localhost:${PORT}/cadastro.html`);
  console.log(`  Recuperação:  http://localhost:${PORT}/recuperacao.html`);
  console.log(`====================================================`);
});
