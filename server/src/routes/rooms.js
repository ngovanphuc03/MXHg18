/**
 * Rooms Routes — Create / List / Join / Leave Game Rooms
 * Supports Public & Private (password-protected) rooms.
 */
import { Router } from 'express';
import Room from '../models/Room.js';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const formatRoom = (r) => ({
    ...r.toJSON(),
    participantCount: r.participants.length,
    isPrivate: r.type === 'private',
    creatorName: r.creator?.displayName || 'Unknown',
});

/**
 * GET /api/rooms — List all active rooms
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const rooms = await Room.find({ isActive: true })
            .populate('creator', 'username displayName avatarUrl')
            .sort({ createdAt: -1 });

        res.json(rooms.map(formatRoom));
    } catch (error) {
        res.status(500).json({ error: 'Lỗi tải danh sách phòng' });
    }
});

/**
 * POST /api/rooms — Create a new room
 */
router.post('/', authenticate, async (req, res) => {
    try {
        const { name, description, type, password, icon, color, maxParticipants } = req.body;

        if (!name || name.trim().length < 2) {
            return res.status(400).json({ error: 'Tên phòng phải có ít nhất 2 ký tự' });
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const room = new Room({
            name: name.trim(),
            description: description?.trim() || '',
            type: type === 'private' ? 'private' : 'public',
            creator: req.user.id,
            icon: icon || '🎮',
            color: color || '#7c5cfc',
            maxParticipants: Math.min(Math.max(parseInt(maxParticipants) || 8, 2), 8),
        });

        // Set password for private rooms
        if (type === 'private' && password) {
            await room.setPassword(password);
        }

        // Creator auto-joins
        room.addParticipant(user);
        await room.save();

        await room.populate('creator', 'username displayName avatarUrl');

        const formattedRoom = formatRoom(room);
        req.app.get('io').emit('room:created', formattedRoom);
        res.status(201).json(formattedRoom);
    } catch (error) {
        console.error('Create room error:', error);
        res.status(500).json({ error: 'Tạo phòng thất bại' });
    }
});

/**
 * POST /api/rooms/:id/join — Join a room
 */
router.post('/:id/join', authenticate, async (req, res) => {
    try {
        const room = await Room.findById(req.params.id);
        if (!room || !room.isActive) {
            return res.status(404).json({ error: 'Phòng không tồn tại' });
        }

        if (room.participants.length >= room.maxParticipants) {
            return res.status(400).json({ error: 'Phòng đã đầy' });
        }

        // Check password for private rooms
        if (room.type === 'private') {
            const { password } = req.body;
            if (!password) {
                return res.status(403).json({ error: 'Phòng yêu cầu mật khẩu', requirePassword: true });
            }
            const valid = await room.verifyPassword(password);
            if (!valid) {
                return res.status(403).json({ error: 'Mật khẩu không đúng' });
            }
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Leave any other room first
        await Room.updateMany(
            { 'participants.userId': user._id, _id: { $ne: room._id } },
            { $pull: { participants: { userId: user._id } } }
        );

        room.addParticipant(user);
        await room.save();
        await room.populate('creator', 'username displayName avatarUrl');

        const formattedRoom = formatRoom(room);
        req.app.get('io').emit('room:updated', formattedRoom);
        res.json(formattedRoom);
    } catch (error) {
        console.error('Join room error:', error);
        res.status(500).json({ error: 'Vào phòng thất bại' });
    }
});

/**
 * POST /api/rooms/:id/leave — Leave a room
 */
router.post('/:id/leave', authenticate, async (req, res) => {
    try {
        const room = await Room.findById(req.params.id);
        if (!room) return res.status(404).json({ error: 'Phòng không tồn tại' });

        room.removeParticipant(req.user.id);

        let isDeleted = false;
        // If room is empty and not created by system, deactivate
        if (room.participants.length === 0) {
            room.isActive = false;
            isDeleted = true;
        }

        await room.save();

        if (isDeleted) {
            req.app.get('io').emit('room:deleted', { roomId: room._id.toString() });
        } else {
            await room.populate('creator', 'username displayName avatarUrl');
            req.app.get('io').emit('room:updated', formatRoom(room));
        }

        res.json({ message: 'Đã rời phòng' });
    } catch (error) {
        res.status(500).json({ error: 'Rời phòng thất bại' });
    }
});

/**
 * DELETE /api/rooms/:id — Delete a room (creator only)
 */
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const room = await Room.findById(req.params.id);
        if (!room) return res.status(404).json({ error: 'Phòng không tồn tại' });

        if (room.creator.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Chỉ chủ phòng mới có thể xóa' });
        }

        room.isActive = false;
        room.participants = [];
        await room.save();

        req.app.get('io').emit('room:deleted', { roomId: room._id.toString() });
        res.json({ message: 'Đã xóa phòng' });
    } catch (error) {
        res.status(500).json({ error: 'Xóa phòng thất bại' });
    }
});

export default router;
