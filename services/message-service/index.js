const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8082;

const AUTH_SERVICE_URL = process.env.AUTH_URL || 'http://localhost:8081/api/auth/validate';

app.post('/api/messages', async (req, res) => {
    const { text, token } = req.body;

    try {
        console.log(`[Message Service] Validando token com o Auth Service...`);
        
        // 1. COMUNICAÇÃO REST: Chamando o Auth Service
        const authResponse = await fetch(AUTH_SERVICE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token })
        });

        const authData = await authResponse.json();

        // 2. Lógica de negócio baseada na resposta
        if (authResponse.ok && authData.valid) {
            console.log(`[Message Service] Mensagem aceita do usuário: ${authData.user}`);
            // Aqui futuramente entra a integração com RabbitMQ e PostgreSQL
            return res.status(201).json({ 
                success: true, 
                message: "Mensagem salva e processada!", 
                author: authData.user,
                text: text
            });
        } else {
            console.log(`[Message Service] Mensagem recusada.`);
            return res.status(401).json({ success: false, error: "Usuário não autorizado" });
        }

    } catch (error) {
        console.error(`[Message Service] Erro ao comunicar com Auth Service:`, error.message);
        return res.status(500).json({ success: false, error: "Falha na comunicação interna dos serviços" });
    }
});

app.listen(PORT, () => {
    console.log(`Message Service rodando na porta ${PORT}`);
});