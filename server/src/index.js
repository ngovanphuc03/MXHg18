/**
 * Động G18 — Main Server Entry Point
 * Express + Socket.io + MongoDB + Redis
 */
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { resolve } from 'path';

import config from './config/index.js';
import { initDatabases } from './config/database.js';
import { initializeSocket } from './socket/index.js';

// Route imports
import authRoutes from './routes/auth.js';
import friendsRoutes from './routes/friends.js';
import roomsRoutes from './routes/rooms.js';
import messagesRoutes from './routes/messages.js';
import uploadRoutes from './routes/upload.js';
import locketRoutes from './routes/locket.js';
import notificationRoutes from './routes/notifications.js';
import gamificationRoutes from './routes/gamification.js';

// ─── Express App ────────────────────────────────────────
const app = express();
const httpServer = createServer(app);

// Allow all origins for mobile app (Capacitor doesn't send standard Origin)
const corsOptions = {
    origin: true,
    credentials: true,
};

const io = new SocketIO(httpServer, {
    cors: {
        origin: true,
        methods: ['GET', 'POST'],
        credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 10000,
    maxHttpBufferSize: 1e7,
    transports: ['websocket', 'polling'],
});

app.set('io', io);

// ─── Middleware ──────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (config.isDev) {
    app.use(morgan('dev'));
}

// Rate limiting
app.use('/api/', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: { error: 'Quá nhiều request, vui lòng chờ' },
}));

// Serve uploaded files
app.use('/uploads', express.static(resolve(config.upload.dir)));

// ─── API Routes ─────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/locket', locketRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/gamification', gamificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(err.status || 500).json({
        error: config.isDev ? err.message : 'Lỗi server',
    });
});

// ─── Start Server ───────────────────────────────────────
async function startServer() {
    await initDatabases();
    initializeSocket(io);

    httpServer.listen(config.port, () => {
        console.log('');
        console.log('╔══════════════════════════════════════════════╗');
        console.log('║    🎮 Động G18 — Backend Server              ║');
        console.log('╠══════════════════════════════════════════════╣');
        console.log(`║  🌐 HTTP:    http://localhost:${config.port}            ║`);
        console.log(`║  🔌 WS:      ws://localhost:${config.port}              ║`);
        console.log(`║  📦 Env:     ${config.nodeEnv.padEnd(30)}║`);
        console.log(`║  🗄️  MongoDB: ${config.mongodb.uri.slice(0, 28).padEnd(30)}║`);
        console.log('╚══════════════════════════════════════════════╝');
        console.log('');
    });
}

startServer().catch((err) => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Shutting down...');
    httpServer.close(() => process.exit(0));
});
