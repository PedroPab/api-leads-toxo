import express, { json, urlencoded } from 'express';
import router from './src/ruters.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});
app.use(json());
app.use(urlencoded({ extended: true }));

router(app);

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});