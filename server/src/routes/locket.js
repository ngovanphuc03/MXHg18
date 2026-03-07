/**
 * Locket Routes — Instant photo sharing (Locket-style)
 */
import { Router } from 'express';
import LocketPhoto from '../models/LocketPhoto.js';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { uploadSingle } from '../middleware/upload.js';
import { addExp } from '../utils/gamification.js';

const router = Router();

/**
 * GET /api/locket — Get recent photos feed
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const { before, limit = 50 } = req.query;
        const pageLimit = Math.min(parseInt(limit), 100);

        const filter = {};
        if (before) filter.createdAt = { $lt: new Date(before) };

        const photos = await LocketPhoto.find(filter)
            .sort({ createdAt: -1 })
            .limit(pageLimit)
            .populate('userId', 'username displayName avatarUrl gameStatus level');

        res.json({
            photos: photos.map(p => ({
                id: p._id.toString(),
                userId: p.userId._id.toString(),
                userName: p.userId.displayName,
                userAvatar: p.userId.avatarUrl,
                level: p.userId.level || 1,
                photoUrl: p.photoUrl,
                caption: p.caption,
                reactions: Object.fromEntries(p.reactions || new Map()),
                gameStatus: p.userId.gameStatus,
                createdAt: p.createdAt,
            })),
            hasMore: photos.length === pageLimit,
        });
    } catch (error) {
        console.error('Get locket photos error:', error);
        res.status(500).json({ error: 'Lỗi tải ảnh' });
    }
});

/**
 * GET /api/locket/memories — Get "On This Day" memories + Monthly Rewind
 */
router.get('/memories', authenticate, async (req, res) => {
    try {
        const { type = 'today' } = req.query;
        const now = new Date();

        let photos;

        if (type === 'today') {
            // Find photos from same day+month in previous years
            const day = now.getDate();
            const month = now.getMonth(); // 0-indexed

            photos = await LocketPhoto.aggregate([
                {
                    $addFields: {
                        dayOfMonth: { $dayOfMonth: '$createdAt' },
                        monthOfYear: { $month: '$createdAt' },
                        yearOfDate: { $year: '$createdAt' },
                    },
                },
                {
                    $match: {
                        dayOfMonth: day,
                        monthOfYear: month + 1, // MongoDB $month is 1-indexed
                        yearOfDate: { $ne: now.getFullYear() },
                    },
                },
                { $sort: { createdAt: -1 } },
                { $limit: 50 },
            ]);

            // Populate user info manually
            const userIds = [...new Set(photos.map(p => p.userId.toString()))];
            const users = await User.find({ _id: { $in: userIds } })
                .select('username displayName avatarUrl level');
            const userMap = {};
            users.forEach(u => { userMap[u._id.toString()] = u; });

            photos = photos.map(p => {
                const u = userMap[p.userId.toString()] || {};
                return {
                    id: p._id.toString(),
                    photoUrl: p.photoUrl,
                    caption: p.caption,
                    userName: u.displayName || u.username,
                    userAvatar: u.avatarUrl,
                    level: u.level || 1,
                    createdAt: p.createdAt,
                };
            });
        } else {
            // Monthly rewind: photos from this month
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            photos = await LocketPhoto.find({
                createdAt: { $gte: startOfMonth },
            })
                .sort({ createdAt: -1 })
                .limit(100)
                .populate('userId', 'username displayName avatarUrl level');

            photos = photos.map(p => ({
                id: p._id.toString(),
                photoUrl: p.photoUrl,
                caption: p.caption,
                userName: p.userId?.displayName || p.userId?.username,
                userAvatar: p.userId?.avatarUrl,
                level: p.userId?.level || 1,
                createdAt: p.createdAt,
            }));
        }

        res.json({ photos, type });
    } catch (error) {
        console.error('Get memories error:', error);
        res.status(500).json({ error: 'Lỗi tải kỷ niệm' });
    }
});

/**
 * POST /api/locket — Upload a new locket photo
 */
router.post('/', authenticate, uploadSingle('photos'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Ảnh bắt buộc' });

        const photo = new LocketPhoto({
            userId: req.user.id,
            photoUrl: req.file.path,   // Cloudinary HTTPS URL
            caption: req.body.caption?.trim()?.slice(0, 200) || '',
        });

        await photo.save();
        await photo.populate('userId', 'username displayName avatarUrl gameStatus');

        res.status(201).json({
            id: photo._id.toString(),
            userId: photo.userId._id.toString(),
            userName: photo.userId.displayName,
            userAvatar: photo.userId.avatarUrl,
            photoUrl: photo.photoUrl,
            caption: photo.caption,
            reactions: {},
            createdAt: photo.createdAt,
        });

        // +5 EXP for uploading a Locket photo
        addExp(req.user.id, 5, 'locket_upload');
    } catch (error) {
        console.error('Upload locket photo error:', error);
        res.status(500).json({ error: 'Gửi ảnh thất bại' });
    }
});

/**
 * POST /api/locket/:id/react — React to a photo
 */
router.post('/:id/react', authenticate, async (req, res) => {
    try {
        const { emoji } = req.body;
        if (!emoji) return res.status(400).json({ error: 'Emoji bắt buộc' });

        const photo = await LocketPhoto.findById(req.params.id);
        if (!photo) return res.status(404).json({ error: 'Ảnh không tồn tại' });

        const current = photo.reactions.get(emoji) || 0;
        photo.reactions.set(emoji, current + 1);
        await photo.save();

        res.json({ emoji, count: current + 1 });

        // +2 EXP for reacting to a photo
        addExp(req.user.id, 2, 'locket_react');
    } catch (error) {
        res.status(500).json({ error: 'React thất bại' });
    }
});

export default router;
