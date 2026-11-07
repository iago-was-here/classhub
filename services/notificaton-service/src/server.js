const http = require('node:http');
const { WebSocket, WebSocketServer } = require('ws');

const MAX_BUFFERED_BYTES = 1024 * 1024;

function sendUpgradeError(socket, status, message) {
    if (socket.destroyed) return;
    socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    socket.destroy();
}

function createNotificationServer({ authClient, notificationStore, allowedOrigins = [], heartbeatIntervalMs = 30000 }) {
    let brokerReady = false;
    const server = http.createServer(async (req, res) => {
        if (req.method === 'GET' && req.url === '/health') {
            let databaseReady = true;
            try {
                await notificationStore.healthCheck();
            } catch (error) {
                databaseReady = false;
            }
            const ready = brokerReady && databaseReady;
            const status = ready ? 200 : 503;
            res.writeHead(status, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
                status: ready ? 'ok' : 'unavailable',
                connectedClients: websocketServer.clients.size
            }));
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Rota não encontrada' }));
    });
    const websocketServer = new WebSocketServer({
        noServer: true,
        clientTracking: true,
        maxPayload: 16 * 1024,
        perMessageDeflate: false
    });

    server.on('upgrade', async (req, socket, head) => {
        let requestUrl;
        try {
            requestUrl = new URL(req.url, 'http://localhost');
        } catch (error) {
            return sendUpgradeError(socket, 400, 'Bad Request');
        }

        if (requestUrl.pathname !== '/ws') {
            return sendUpgradeError(socket, 404, 'Not Found');
        }

        const origin = req.headers.origin;
        if (origin && allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
            return sendUpgradeError(socket, 403, 'Forbidden');
        }

        const token = requestUrl.searchParams.get('token');
        if (!token) return sendUpgradeError(socket, 401, 'Unauthorized');

        try {
            const user = await authClient.validateToken(token);
            if (!user) return sendUpgradeError(socket, 401, 'Unauthorized');

            websocketServer.handleUpgrade(req, socket, head, (websocket) => {
                websocket.userId = user.id;
                websocket.isAlive = true;
                websocketServer.emit('connection', websocket, req);
            });
        } catch (error) {
            sendUpgradeError(socket, 503, 'Service Unavailable');
        }
    });

    websocketServer.on('connection', (websocket) => {
        websocket.on('pong', () => {
            websocket.isAlive = true;
        });
        websocket.on('error', () => {});
    });

    const heartbeat = setInterval(() => {
        for (const websocket of websocketServer.clients) {
            if (!websocket.isAlive) {
                websocket.terminate();
                continue;
            }
            websocket.isAlive = false;
            websocket.ping();
        }
    }, heartbeatIntervalMs);
    heartbeat.unref();

    function broadcast(event, recipientIds) {
        const payload = JSON.stringify(event);
        const recipients = new Set(recipientIds);
        for (const websocket of websocketServer.clients) {
            if (websocket.readyState !== WebSocket.OPEN || !recipients.has(websocket.userId)) continue;
            if (websocket.bufferedAmount > MAX_BUFFERED_BYTES) {
                websocket.close(1013, 'Cliente lento');
                continue;
            }
            websocket.send(payload, (error) => {
                if (error) websocket.terminate();
            });
        }
    }

    function setBrokerReady(ready) {
        brokerReady = ready;
    }

    function close() {
        clearInterval(heartbeat);
        for (const websocket of websocketServer.clients) websocket.close(1001, 'Serviço encerrando');
        websocketServer.close();
        return new Promise((resolve, reject) => {
            if (!server.listening) return resolve();
            server.close((error) => error ? reject(error) : resolve());
        });
    }

    return { server, broadcast, setBrokerReady, close };
}

module.exports = { createNotificationServer };