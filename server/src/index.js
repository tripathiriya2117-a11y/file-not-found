import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import filesRouter from './routes/files.js';
import searchRouter from './routes/search.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    app: 'File Not Found Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Mount feature routes
app.use('/api/files', filesRouter);
app.use('/api/search', searchRouter);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'NotFound',
    message: `Cannot ${req.method} ${req.path}`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'UploadTooLarge',
      message: 'Each PDF must be 25 MB or smaller.',
    });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT' || err.message?.startsWith('Invalid file type:')) {
    return res.status(400).json({
      error: 'InvalidUpload',
      message: err.message || 'Upload contains an invalid file or too many files.',
    });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'RequestTooLarge',
      message: 'Request body is too large.',
    });
  }
  res.status(err.status || 500).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred.',
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`===========================================`);
  console.log(`🚀 File Not Found Server running on port ${PORT}`);
  console.log(`📡 Healthcheck: http://localhost:${PORT}/api/health`);
  console.log(`===========================================`);
});
