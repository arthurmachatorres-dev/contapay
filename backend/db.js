require('dotenv').config();
const admin = require('firebase-admin');

let db = null;

// Só tenta conectar se você já colocou os dados reais no arquivo .env
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID !== 'seu-project-id') {
    try {
        const serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        };

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        db = admin.firestore();
        console.log("✅ Conectado ao Firebase Firestore com sucesso!");
    } catch (error) {
        console.error("❌ Erro ao conectar no Firebase:", error.message);
    }
} else {
    console.log("⚠️ Aviso: Firebase aguardando chaves reais no arquivo .env (Rodando em modo local).");
}

module.exports = db;