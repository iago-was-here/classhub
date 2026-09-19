const express = require('express');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8081;

// Rota REST para validar a autenticação
app.post('/api/auth/validate', (req, res) => {
    const { token } = req.body;

    if (token) {
        console.log(`[Auth Service] Token recebido: ${token} - Validação OK`);
        return res.status(200).json({ valid: true, user: "aluno_teste" });
    }

    console.log(`[Auth Service] Requisição negada. Token ausente.`);
    return res.status(401).json({ valid: false, error: "Não autorizado" });
});

app.listen(PORT, () => {
    console.log(`Auth Service rodando na porta ${PORT}`);
});