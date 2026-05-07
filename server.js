const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const SERVER_LOG_PREFIX = "[CV Studio Server]";

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// Serve uploaded photos
app.use('/uploads', express.static(UPLOADS_DIR));

// Multer config for photo uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        // Use a clean filename: photo_<timestamp>.<ext>
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        const name = 'photo_' + Date.now() + ext;
        cb(null, name);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed (jpg, png, webp, gif)'));
        }
    }
});

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
    console.log(`${SERVER_LOG_PREFIX} GET /api/data`);
    fs.readFile(DATA_FILE, 'utf8', (err, json) => {
        if (err) {
            console.error(`${SERVER_LOG_PREFIX} Failed reading data.json`, err);
            return res.status(500).send("Error reading data");
        }
        console.log(`${SERVER_LOG_PREFIX} GET /api/data success`, { bytes: json.length });
        res.send(json);
    });
});

// Save data
app.post('/api/data', (req, res) => {
    const profileId = req.body && req.body.currentProfileId;
    const profilesCount = req.body && req.body.allProfiles ? Object.keys(req.body.allProfiles).length : 0;
    console.log(`${SERVER_LOG_PREFIX} POST /api/data`, { profileId, profilesCount });
    const data = JSON.stringify(req.body, null, 2);
    fs.writeFile(DATA_FILE, data, (err) => {
        if (err) {
            console.error(`${SERVER_LOG_PREFIX} Failed saving data.json`, err);
            return res.status(500).send("Error saving data");
        }
        console.log(`${SERVER_LOG_PREFIX} Data saved to data.json`, { bytes: data.length });
        res.send({ status: "success" });
    });
});

// Upload photo
app.post('/api/upload-photo', upload.single('photo'), (req, res) => {
    console.log(`${SERVER_LOG_PREFIX} POST /api/upload-photo`);
    if (!req.file) {
        console.warn(`${SERVER_LOG_PREFIX} Upload photo called with no file`);
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const photoUrl = '/uploads/' + req.file.filename;
    console.log(`${SERVER_LOG_PREFIX} Photo uploaded`, {
        photoUrl,
        originalName: req.file.originalname,
        bytes: req.file.size
    });
    res.json({ url: photoUrl });
});

// Delete a photo
app.delete('/api/photo', (req, res) => {
    const { url } = req.body;
    console.log(`${SERVER_LOG_PREFIX} DELETE /api/photo`, { url });
    if (!url || !url.startsWith('/uploads/')) {
        console.warn(`${SERVER_LOG_PREFIX} Invalid photo delete path`, { url });
        return res.status(400).json({ error: 'Invalid photo path' });
    }
    const filePath = path.join(__dirname, url);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`${SERVER_LOG_PREFIX} Photo deleted`, { url });
    } else {
        console.warn(`${SERVER_LOG_PREFIX} Photo delete skipped, file missing`, { url });
    }
    res.json({ status: "deleted" });
});

app.listen(PORT, () => {
    console.log(`
=========================================
CV Studio Server is running!
Access it at: http://localhost:${PORT}
Changes will be saved directly to data.json
Photos saved in uploads/ (gitignored)
=========================================
    `);
});
