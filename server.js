const express = require('express');
const fs = require('fs');
const cors = require('cors');
const mysql = require('mysql2');

const app = express();

// Configurazione CORS
const corsOptions = {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true,
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(express.json());

// Configurazione MySQL
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'chatbot_db',
    port: 8889,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Crea la tabella contacts se non esiste
const createTableQuery = `
    CREATE TABLE IF NOT EXISTS contacts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`;

pool.query(createTableQuery, (err) => {
    if (err) {
        console.error('Errore nella creazione della tabella:', err);
    } else {
        console.log('Tabella contacts creata o già esistente');
    }
});

// Carica lo schema delle domande
const loadDialogueSchema = () => {
    try {
        const data = fs.readFileSync('dialogue_schema.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Errore durante il caricamento di dialogue_schema.json:", error.message);
        return [];
    }
};

const dialogueSchema = loadDialogueSchema();

app.get('/start', (req, res) => {
    if (dialogueSchema.length === 0) {
        return res.status(500).json({ error: 'Dialogue schema non disponibile.' });
    }
    res.json(dialogueSchema[0]);
});

app.post('/next', (req, res) => {
    const { question_id, option_id } = req.body;

    const currentQuestion = dialogueSchema.find(q => q.id === Number(question_id));
    if (!currentQuestion) {
        return res.status(400).json({ error: 'Invalid question_id' });
    }

    const selectedOption = currentQuestion.options.find(opt => opt.id === Number(option_id));
    if (!selectedOption) {
        return res.status(400).json({ error: 'Invalid option_id' });
    }

    const nextQuestionId = selectedOption.next_question_id;

    if (nextQuestionId === "show_form") {
        return res.json({ action: "show_form" });
    }

    const nextQuestion = dialogueSchema.find(q => q.id === Number(nextQuestionId));
    if (!nextQuestion) {
        return res.status(500).json({ error: 'Errore interno: domanda successiva non trovata.' });
    }

    res.json(nextQuestion);
});

app.post('/save-contact', async (req, res) => {
    console.log('Richiesta ricevuta:', req.body); // Nuovo log
    const { name, phone } = req.body;

    if (!name || !phone) {
        console.log('Dati mancanti'); // Nuovo log
        return res.status(400).json({ error: 'Nome e numero di telefono sono obbligatori.' });
    }

    try {
        console.log('Provo a salvare:', name, phone); // Nuovo log
        const [result] = await pool.promise().query(
            'INSERT INTO contacts (name, phone) VALUES (?, ?)',
            [name, phone]
        );

        console.log('Salvato con successo, ID:', result.insertId); // Nuovo log
        
        res.json({ 
            success: true,
            message: 'Grazie! Ti contatteremo al più presto.',
            contactId: result.insertId 
        });
    } catch (error) {
        console.log('Errore nel salvataggio:', error); // Nuovo log
        console.error('Errore nel salvataggio del contatto:', error);
        res.status(500).json({ 
            success: false,
            error: 'Errore nel salvataggio del contatto' 
        });
    }
});

// Endpoint per visualizzare tutti i contatti
app.get('/contacts', async (req, res) => {
    try {
        const [rows] = await pool.promise().query(
            'SELECT * FROM contacts ORDER BY created_at DESC'
        );
        res.json(rows);
    } catch (error) {
        console.error('Errore nel recupero dei contatti:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server in esecuzione sulla porta ${PORT}`);
});