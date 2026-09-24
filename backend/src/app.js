const express = require('express');
const cors = require('cors');
const timetableRoutes = require('./routes/timetableRoutes');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'timetable-generator-backend' });
  });

  app.use('/api', timetableRoutes);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
  });

  // Centralized error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) {
      console.error(err);
    }
    res.status(status).json({
      message: err.message || 'Internal server error',
      details: err.details || undefined,
    });
  });

  return app;
}

module.exports = { createApp };
