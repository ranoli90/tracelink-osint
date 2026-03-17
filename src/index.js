import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import linksRouter from './routes/links.js';
import clickRouter from './routes/click.js';
import analyticsRouter from './routes/analytics.js';
import meRouter from './routes/me.js';
import osintRouter from './routes/osint.js';
import { initGeo } from './services/geo.js';
import { createBot } from './bot/telegram.js';

const app = express();
const prisma = new PrismaClient();

app.set('trust proxy', true);
app.set('prisma', prisma);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    // In production, only allow specific origins
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      process.env.BASE_URL,
      process.env.WEBAPP_URL,
      'https://telegram.org',
      'https://twa-dev.github.io'
    ].filter(Boolean);

    // In production, strict origin checking
    if (process.env.NODE_ENV === 'production') {
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    }

    // In development, allow localhost and common dev ports
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }

    return callback(null, true); // Allow for easier testing
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Telegram-InitData'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Bot webhook endpoint (only if BOT_TOKEN is set)
const bot = createBot();
if (bot) {
  // Use webhook callback for Express
  app.use('/bot/webhook', bot.webhookCallback('/bot/webhook'));
  console.log('Telegram bot webhook enabled');
} else {
  console.log('Telegram bot not initialized - set BOT_TOKEN to enable');
}

app.use('/api/links', linksRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/click', clickRouter);
app.use('/api/me', meRouter);
app.use('/api/osint', osintRouter);

app.get('/admin', (req, res) => {
  res.sendFile('admin.html', { root: 'public' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.message);

  if (err.name === 'SyntaxError') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  if (err.code === 'P2021' || err.code === 'P2022') {
    return res.status(500).json({ error: 'Database error' });
  }

  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, async () => {
  await initGeo();
  console.log(`TraceLink server running on port ${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/admin`);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
