process.loadEnvFile();
import express, { json, urlencoded } from 'express';
import router from './src/ruters.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(json());
app.use(urlencoded({ extended: true }));

router(app);

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});