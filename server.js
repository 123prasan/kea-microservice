require('dns').setServers(['1.1.1.1', '8.8.8.8']);

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// 1. Connect to your existing MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// 2. Strict CORS Security (Only allow your main website)
const allowedOrigins = [
    'https://vidyari.com',
    'https://www.vidyari.com',
    'http://localhost:8000' // For your local testing
];

app.use(cors({
    origin: function (origin, callback) {
        // allow requests with no origin (like mobile apps or curl requests)
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('CORS Policy: Access Denied.'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 3. Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Mount API Routes
const kcetRoutes = require('./KCETroutes');
// We mount it exactly at /kcet/api so your frontend URLs don't break
app.use('/kcet', kcetRoutes);

const authRouter = require('./routes/KCETauth');
if (authRouter) app.use('/kcet/api/auth', authRouter);

// 5. Start Server
const PORT = process.env.PORT ;
app.listen(PORT, () => {
    console.log(`KCET Microservice running on port ${PORT}`);
});
