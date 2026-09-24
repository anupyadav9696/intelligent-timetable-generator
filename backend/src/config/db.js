const mongoose = require('mongoose');

async function connectDB(uri) {
  const connectionString = uri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/timetable_generator';
  mongoose.set('strictQuery', true);
  await mongoose.connect(connectionString);
  console.log(`[db] Connected to MongoDB at ${connectionString}`);
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
