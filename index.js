const express = require('express');
const app = express();
__path = process.cwd()
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 8000;

// අවශ්‍ය routes import කරන්න
const pairRoute = require('./pair');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static files සඳහා
app.use(express.static(__path));

// Routes setup කරන්න
app.use('/code', pairRoute);
app.use('/pair', async (req, res) => {
    res.sendFile(__path + '/pair.html');
});

app.use('/', async (req, res) => {
    res.sendFile(__path + '/index.html');
});

// Default route
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'SULA-MD Bot is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║   𝐒𝚄𝙻𝙰 𝐌𝙳 𝐅𝚁𝙴𝙴 𝐁𝙾𝚃 𝐒𝙴𝚁𝚅𝙴𝚁          ║
║   Server running on port: ${PORT}    ║
║   Don't Forget To Give Star ⭐      ║
╚══════════════════════════════════════╝`);
});

module.exports = app;
