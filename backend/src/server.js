require('dotenv').config();
const { createApp } = require('./app');
const { connectDB } = require('./config/db');

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectDB();
  } catch (err) {
    console.error('[server] Failed to connect to MongoDB. The API will still start, but DB-backed routes (CRUD, history) will fail until MongoDB is reachable.');
    console.error(err.message);
  }

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[server] Timetable Generator API listening on port ${PORT}`);
  });
}

start();
