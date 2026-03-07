import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../.env') });

const config = {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    isDev: process.env.NODE_ENV !== 'production',

    jwt: {
        secret: process.env.JWT_SECRET || 'dev-secret-change-me',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },

    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/dong_g18',
    },

    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
    },

    livekit: {
        apiKey: process.env.LIVEKIT_API_KEY || '',
        apiSecret: process.env.LIVEKIT_API_SECRET || '',
        url: process.env.LIVEKIT_URL || 'ws://localhost:7880',
    },

    upload: {
        dir: process.env.UPLOAD_DIR || './uploads',
        maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),
    },

    clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

    // Firebase Cloud Messaging (for push notifications)
    fcm: {
        serverKey: process.env.FCM_SERVER_KEY || '',
    },

    // TURN server for WebRTC (4G/5G users behind symmetric NAT)
    turn: {
        urls: process.env.TURN_URL || 'turn:turn.dongg18.com:3478',
        username: process.env.TURN_USERNAME || '',
        credential: process.env.TURN_CREDENTIAL || '',
    },
};

export default config;
