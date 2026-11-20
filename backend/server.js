require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/api/resumo', async (req, res) => {
    try {
        res.json({
            saldoPrevisto: 2650.00,
            receitas: 5000.00,
            despesas: 2350.00
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar dados' });
    }
});

// Rota curinga atualizada para o Express 5
app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor ContaPay rodando na porta ${PORT}`);
});