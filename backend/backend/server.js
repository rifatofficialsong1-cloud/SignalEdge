// backend/server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// মিডলওয়্যার
app.use(cors());
app.use(express.json());

// বেসিক রুট
app.get('/', (req, res) => {
    res.send('SignalEdge API চালু আছে');
});

// হেলথ চেক রুট
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'SignalEdge ব্যাকএন্ড চালু আছে' });
});

// সার্ভার চালু করা
app.listen(PORT, () => {
    console.log(`সার্ভার চলছে পোর্ট ${PORT} এ`);
});
