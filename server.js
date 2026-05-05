const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// Ensure data.json exists
if (!fs.existsSync(DATA_FILE)) {
    const EXAMPLE_FILE = path.join(__dirname, 'data.json.example');
    if (fs.existsSync(EXAMPLE_FILE)) {
        console.log("data.json not found, initializing from data.json.example");
        fs.copyFileSync(EXAMPLE_FILE, DATA_FILE);
    } else {
        const initialData = {
            currentProfileId: "Software Engineer",
            allProfiles: {}
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    }
}

// Get data
app.get('/api/data', (req, res) => {
    fs.readFile(DATA_FILE, 'utf8', (err, json) => {
        if (err) return res.status(500).send("Error reading data");
        res.send(json);
    });
});

// Save data
app.post('/api/data', (req, res) => {
    const data = JSON.stringify(req.body, null, 2);
    fs.writeFile(DATA_FILE, data, (err) => {
        if (err) return res.status(500).send("Error saving data");
        console.log("Data saved to data.json");
        res.send({ status: "success" });
    });
});

app.listen(PORT, () => {
    console.log(`
=========================================
CV Studio Server is running!
Access it at: http://localhost:${PORT}
Changes will be saved directly to data.json
=========================================
    `);
});
