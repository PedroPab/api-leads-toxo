import { createClient } from 'redis';

const client = createClient({
    url: 'redis://localhost:6379' // Or your Redis server URL
});

client.on('error', (err) => console.error('Redis Client Error', err));

(async () => {
    await client.connect();
    console.log('Redis client connected.');
})();

export default client;