/**
 * Socket.io Initialization
 * Manages connections, auth, and dispatches to module handlers.
 */
import { authenticateSocket } from '../middleware/auth.js';
import User from '../models/User.js';
import { getRedis } from '../config/database.js';
import chatHandler from './chatHandler.js';
import voiceHandler from './voiceHandler.js';

// Track socket<->user mapping
const userSockets = new Map(); // userId -> Set<socketId>

export function getUserSocket(userId) {
    return userSockets.get(userId);
}

export function initializeSocket(io) {
    // Auth middleware
    io.use(authenticateSocket);

    io.on('connection', async (socket) => {
        const userId = socket.user.id;
        console.log(`🔌 Connected: ${socket.user.displayName} (${userId})`);

        // Track user socket
        if (!userSockets.has(userId)) {
            userSockets.set(userId, new Set());
        }
        userSockets.get(userId).add(socket.id);

        // Update online status
        await User.findByIdAndUpdate(userId, { status: 'online', lastSeen: new Date() });

        // Redis online status
        const redis = getRedis();
        if (redis) {
            await redis.sAdd('online_users', userId);
        }

        // Notify others
        socket.broadcast.emit('user:online', {
            userId,
            displayName: socket.user.displayName,
        });

        // Send online list to new user
        if (redis) {
            const onlineIds = await redis.sMembers('online_users');
            socket.emit('user:onlineList', onlineIds);
        }

        // Join personal room for targeted events
        socket.join(`user:${userId}`);

        // Register module handlers
        chatHandler(io, socket);
        voiceHandler(io, socket);

        // ─── Disconnect ─────────────────────────────
        socket.on('disconnect', async () => {
            console.log(`🔌 Disconnected: ${socket.user.displayName}`);

            const sockets = userSockets.get(userId);
            if (sockets) {
                sockets.delete(socket.id);
                if (sockets.size === 0) {
                    userSockets.delete(userId);

                    // Only mark offline when all sockets disconnected
                    await User.findByIdAndUpdate(userId, { status: 'offline', lastSeen: new Date() });

                    if (redis) {
                        await redis.sRem('online_users', userId);
                    }

                    socket.broadcast.emit('user:offline', { userId });
                }
            }
        });

        // Heartbeat
        socket.on('ping', (cb) => cb?.({ ts: Date.now() }));
    });

    console.log('✅ Socket.io initialized');
}
