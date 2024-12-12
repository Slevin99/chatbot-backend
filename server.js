const express = require('express');
const fs = require('fs');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();

// Configurazione CORS per la produzione
const corsOptions = {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true,
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(express.json());

// Configurazione SQLite
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Errore nella connessione al database:', err);
    } else {
        console.log('Connesso al database SQLite');
    }
});

// Crea la tabella contacts se non esiste
db.run(`
    CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`, (err) => {
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

app.post('/save-contact', (req, res) => {
    const { name, phone } = req.body;

    if (!name || !phone) {
        return res.status(400).json({ error: 'Nome e numero di telefono sono obbligatori.' });
    }

    const query = 'INSERT INTO contacts (name, phone) VALUES (?, ?)';
    db.run(query, [name, phone], function(err) {
        if (err) {
            console.error('Errore nel salvataggio del contatto:', err);
            return res.status(500).json({ 
                success: false,
                error: 'Errore nel salvataggio del contatto' 
            });
        }

        console.log(`Contatto salvato: Nome - ${name}, Telefono - ${phone}`);
        
        res.json({ 
            success: true,
            message: 'Grazie! Ti contatteremo al più presto.',
            contactId: this.lastID 
        });
    });
});

// Chiudi il database quando l'app viene terminata
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Errore nella chiusura del database:', err);
        } else {
            console.log('Database chiuso');
        }
        process.exit(0);
    });
});

// Endpoint per visualizzare tutti i contatti
app.get('/contacts', (req, res) => {
    db.all('SELECT * FROM contacts ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server in esecuzione sulla porta ${PORT}`);
});