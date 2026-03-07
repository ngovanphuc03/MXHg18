/**
 * database.js — MongoDB + Redis connections
 * MongoDB: persistent data (users, messages, rooms, friendships)
 * Redis: ephemeral data (online status, voice sessions, rate limiting)
 */
import mongoose from 'mongoose';
import { createClient } from 'redis';
import config from './index.js';

// ─── MongoDB ────────────────────────────────────────────
export async function connectMongoDB() {
    try {
        await mongoose.connect(config.mongodb.uri);
        console.log('✅ MongoDB connected:', config.mongodb.uri);
    } catch (err) {
        console.error('❌ MongoDB connection failed:', err.message);
        process.exit(1);
    }

    mongoose.connection.on('error', (err) => {
        console.error('MongoDB error:', err);
    });

    mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB disconnected');
    });
}

// ─── Redis ──────────────────────────────────────────────
let redisClient = null;

export async function connectRedis() {
    console.warn('⚠️ Disabling Redis connection for local testing');
    redisClient = null;
    return null;
}

export function getRedis() {
    return redisClient;
}

// ─── Initialize all databases ───────────────────────────
export async function initDatabases() {
    await connectMongoDB();
    await connectRedis();
}
