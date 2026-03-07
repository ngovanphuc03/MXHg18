/**
 * Voice Socket Handler — Game Room Voice State
 * Tracks who's in voice, muted/deafened/speaking states.
 * Actual voice data goes through WebRTC (peer-to-peer or LiveKit SFU).
 */
import Room from '../models/Room.js';
import User from '../models/User.js';
import { getRedis } from '../config/database.js';
import config from '../config/index.js';
import { addExp, voiceExpForMinutes } from '../utils/gamification.js';

export default function voiceHandler(io, socket) {
    /**
     * Join voice in a room
     */
    socket.on('voice:join', async (data, callback) => {
        try {
            const { roomId } = data;
            const room = await Room.findById(roomId);
            if (!room) return callback?.({ error: 'Phòng không tồn tại' });

            // Join socket.io room for targeted broadcasts
            socket.join(`room:${roomId}`);

            // Track in Redis for fast lookups
            const redis = getRedis();
            if (redis) {
                await redis.hSet(`voice:${roomId}`, socket.user.id, JSON.stringify({
                    displayName: socket.user.displayName,
                    joinedAt: Date.now(),
                    isMuted: false,
                    isDeafened: false,
                }));
            }

            // Update user status
            await User.findByIdAndUpdate(socket.user.id, { status: 'in-voice' });

            // Broadcast to room
            io.to(`room:${roomId}`).emit('voice:userJoined', {
                userId: socket.user.id,
                displayName: socket.user.displayName,
                roomId,
            });

            // Return current participants in room
            const participants = room.participants.map(p => ({
                userId: p.userId.toString(),
                displayName: p.displayName,
                avatarUrl: p.avatarUrl,
                isMuted: p.isMuted,
                isDeafened: p.isDeafened,
            }));

            callback?.({
                success: true,
                participants,
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    // TURN for 4G/5G users behind symmetric NAT
                    ...(config.turn.username ? [{
                        urls: config.turn.urls,
                        username: config.turn.username,
                        credential: config.turn.credential,
                    }] : [
                        // Free TURN fallback (OpenRelay)
                        {
                            urls: 'turn:openrelay.metered.ca:443',
                            username: 'openrelayproject',
                            credential: 'openrelayproject',
                        },
                        {
                            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                            username: 'openrelayproject',
                            credential: 'openrelayproject',
                        },
                    ]),
                ],
            });
        } catch (error) {
            console.error('Voice join error:', error);
            callback?.({ error: 'Vào voice thất bại' });
        }
    });

    /**
     * Leave voice
     */
    socket.on('voice:leave', async (data, callback) => {
        try {
            const { roomId } = data;
            socket.leave(`room:${roomId}`);

            const redis = getRedis();
            if (redis) {
                // Calculate voice time for EXP
                const voiceData = await redis.hGet(`voice:${roomId}`, socket.user.id);
                if (voiceData) {
                    try {
                        const { joinedAt } = JSON.parse(voiceData);
                        const minutes = (Date.now() - joinedAt) / 60000;
                        const voiceExp = voiceExpForMinutes(minutes);
                        if (voiceExp > 0) {
                            addExp(socket.user.id, voiceExp, `voice_${Math.round(minutes)}min`);
                        }
                    } catch { /* ignore parse error */ }
                }
                await redis.hDel(`voice:${roomId}`, socket.user.id);
            }

            await User.findByIdAndUpdate(socket.user.id, { status: 'online' });

            io.to(`room:${roomId}`).emit('voice:userLeft', {
                userId: socket.user.id,
                displayName: socket.user.displayName,
                roomId,
            });

            callback?.({ success: true });
        } catch (error) {
            callback?.({ error: 'Rời voice thất bại' });
        }
    });

    /**
     * Mute/Unmute
     */
    socket.on('voice:mute', async (data) => {
        const { roomId, isMuted } = data;

        // Update in DB
        await Room.updateOne(
            { _id: roomId, 'participants.userId': socket.user.id },
            { $set: { 'participants.$.isMuted': isMuted } }
        );

        io.to(`room:${roomId}`).emit('voice:muteChanged', {
            userId: socket.user.id,
            isMuted,
            roomId,
        });
    });

    /**
     * Deafen/Undeafen
     */
    socket.on('voice:deafen', async (data) => {
        const { roomId, isDeafened } = data;

        await Room.updateOne(
            { _id: roomId, 'participants.userId': socket.user.id },
            { $set: { 'participants.$.isDeafened': isDeafened } }
        );

        io.to(`room:${roomId}`).emit('voice:deafenChanged', {
            userId: socket.user.id,
            isDeafened,
            roomId,
        });
    });

    /**
     * Speaking indicator (VAD — Voice Activity Detection)
     */
    socket.on('voice:speaking', (data) => {
        const { roomId, isSpeaking } = data;
        socket.to(`room:${roomId}`).emit('voice:userSpeaking', {
            userId: socket.user.id,
            isSpeaking,
            roomId,
        });
    });

    /**
     * Screen share state
     */
    socket.on('voice:screenShare', (data) => {
        const { roomId, isSharing } = data;
        io.to(`room:${roomId}`).emit('voice:screenShareChanged', {
            userId: socket.user.id,
            displayName: socket.user.displayName,
            isSharing,
        });
    });

    /**
     * WebRTC signaling for room peers
     * (Mesh network: each peer connects to every other peer)
     */
    socket.on('voice:signal', (data) => {
        const { roomId, targetUserId, signal } = data;
        io.to(`user:${targetUserId}`).emit('voice:signal', {
            fromUserId: socket.user.id,
            roomId,
            signal,
        });
    });

    /**
     * Room chat message (text in voice room)
     */
    socket.on('room:message', (data) => {
        const { roomId, text, type = 'text' } = data;
        io.to(`room:${roomId}`).emit('room:message', {
            userId: socket.user.id,
            userName: socket.user.displayName,
            text: text?.slice(0, 500),
            type,
            createdAt: new Date().toISOString(),
        });
    });

    /**
     * Soundboard — relay sound effect to room peers
     * Client sends { roomId, soundId }, server broadcasts to room
     */
    socket.on('room:soundboard', (data) => {
        const { roomId, soundId } = data;
        if (!roomId || !soundId) return;
        // Broadcast to everyone else in the room
        socket.to(`room:${roomId}`).emit('room:soundboard', {
            userId: socket.user.id,
            userName: socket.user.displayName,
            soundId,
            roomId,
        });
    });

    /**
     * Clean up on disconnect
     */
    socket.on('disconnect', async () => {
        try {
            // Remove from all voice rooms
            const rooms = await Room.find({ 'participants.userId': socket.user.id });
            for (const room of rooms) {
                io.to(`room:${room._id}`).emit('voice:userLeft', {
                    userId: socket.user.id,
                    displayName: socket.user.displayName,
                    roomId: room._id.toString(),
                });

                const redis = getRedis();
                if (redis) {
                    await redis.hDel(`voice:${room._id}`, socket.user.id);
                }
            }
        } catch (error) {
            console.error('Voice cleanup error:', error);
        }
    });
}
