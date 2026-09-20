const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8081;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'communication',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
});

function normalizeEmail(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${passwordHash}`;
}

function passwordMatches(password, storedHash) {
    const [salt, passwordHash] = storedHash.split(':');
    if (!salt || !passwordHash) return false;

    const calculatedHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(
        Buffer.from(calculatedHash, 'hex'),
        Buffer.from(passwordHash, 'hex')
    );
}

function publicUser(user) {
    return { id: user.id, name: user.name, username: user.username, email: user.email };
}

function createToken(user) {
    return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1d' });
}

function validPassword(password) {
    return typeof password === 'string' && password.length >= 8;
}

async function check(req, res) {
    const { token } = req.body;
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (token) {
        try {
            const payload = jwt.verify(token, JWT_SECRET);
            return res.status(200).json({ valid: true, user: payload.email, user_id: payload.sub });
        } catch (error) {
            return res.status(401).json({ valid: false, error: 'Token inválido' });
        }
    }

    if (!email || typeof password !== 'string') {
        return res.status(400).json({ valid: false, error: 'Email e senha são obrigatórios' });
    }

    const result = await pool.query(
        'SELECT id, name, username, email, password_hash FROM users WHERE email = $1',
        [email]
    );
    const user = result.rows[0];

    if (!user || !passwordMatches(password, user.password_hash)) {
        return res.status(401).json({ valid: false, error: 'Email ou senha inválidos' });
    }

    return res.status(200).json({ valid: true, user: publicUser(user), token: createToken(user) });
}

async function createUser(req, res) {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!name || !username || !email || !validPassword(password)) {
        return res.status(400).json({
            error: 'Nome, username, email e senha (mínimo de 8 caracteres) são obrigatórios'
        });
    }

    try {
        const result = await pool.query(
            `INSERT INTO users (name, username, email, password_hash)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, username, email`,
            [name, username, email, hashPassword(password)]
        );
        const user = result.rows[0];
        return res.status(201).json({ user: publicUser(user), token: createToken(user) });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Email já cadastrado' });
        }
        throw error;
    }
}

async function resetUserPassword(req, res) {
    const email = normalizeEmail(req.body.email);
    const { password, new_password: newPassword } = req.body;
    const passwordToStore = newPassword || password;

    if (!email || !validPassword(passwordToStore)) {
        return res.status(400).json({
            error: 'Email e nova senha (mínimo de 8 caracteres) são obrigatórios'
        });
    }

    const result = await pool.query(
        `UPDATE users SET password_hash = $1, updated_at = NOW()
         WHERE email = $2 RETURNING id, name, username, email`,
        [hashPassword(passwordToStore), email]
    );

    if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = result.rows[0];
    return res.status(200).json({ user: publicUser(user), token: createToken(user) });
}

app.post('/api/auth/check', (req, res, next) => check(req, res).catch(next));
app.post('/api/auth/create_user', (req, res, next) => createUser(req, res).catch(next));
app.post('/api/auth/reset_user_password', (req, res, next) => resetUserPassword(req, res).catch(next));

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