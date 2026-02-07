import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { setupWebSocket } from './websocket/socketHandler';
import { apiRouter } from './routes/api';
import { scoringRouter } from './routes/scoring';
import { imageRouter } from './routes/images';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// ── Middleware ──
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: [CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000'], credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Static files ──
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/generated-images', express.static(path.join(__dirname, '..', 'generated-images')));

// Serve client build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', '..', 'client', 'dist')));
}

// ── API Routes ──
app.use('/api', apiRouter);
app.use('/api/scoring', scoringRouter);
app.use('/api/images', imageRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// SPA fallback
if (process.env.NODE_ENV === 'production') {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'client', 'dist', 'index.html'));
  });
}

// ── WebSocket ──
const io = new SocketIOServer(server, {
  cors: { origin: [CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000'], credentials: true },
  pingTimeout: 60000,
  pingInterval: 25000,
});

setupWebSocket(io);

// ── Start ──
server.listen(PORT, () => {
  console.log(`🎨 Accuracy Sketch AI server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});

export { app, server, io };
