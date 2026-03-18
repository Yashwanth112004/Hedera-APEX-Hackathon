const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5001;
const DATA_FILE = path.join(__dirname, 'insurance_requests.json');

app.use(cors());
app.use(bodyParser.json());

// Initialize data file
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

app.get('/api/insurance/requests', (req, res) => {
    const fiduciaries = req.query.fiduciary;
    const data = JSON.parse(fs.readFileSync(DATA_FILE));
    if (fiduciaries) {
        return res.json(data.filter(r => r.fiduciary.toLowerCase() === fiduciaries.toLowerCase()));
    }
    res.json(data);
});

app.post('/api/insurance/requests', (req, res) => {
    const newRequest = req.body;
    const data = JSON.parse(fs.readFileSync(DATA_FILE));
    data.push({
        ...newRequest,
        id: Date.now(),
        timestamp: new Date().toISOString(),
        status: 'Pending Review'
    });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    res.status(201).json({ success: true, message: 'Request stored in backend' });
});

app.listen(PORT, () => {
    console.log(`Insurance Backend running on http://localhost:${PORT}`);
});
