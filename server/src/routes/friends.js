/**
 * Friends Routes — Add / Accept / Remove / List
 * Manages friendship relationships between users.
 */
import { Router } from 'express';
import Friendship from '../models/Friendship.js';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/friends — List accepted friends
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const friendships = await Friendship.getFriends(req.user.id);

        const friends = friendships.map(f => {
            const friend = f.requester._id.toString() === req.user.id
                ? f.recipient
                : f.requester;
            return {
                friendshipId: f._id.toString(),
                id: friend._id.toString(),
                username: friend.username,
                displayName: friend.displayName,
                avatarUrl: friend.avatarUrl,
                status: friend.status,
                gameStatus: friend.gameStatus,
                lastSeen: friend.lastSeen,
            };
        });

        res.json(friends);
    } catch (error) {
        console.error('Get friends error:', error);
        res.status(500).json({ error: 'Lỗi tải danh sách bạn bè' });
    }
});

/**
 * GET /api/friends/requests — Pending friend requests received
 */
router.get('/requests', authenticate, async (req, res) => {
    try {
        const requests = await Friendship.getPendingRequests(req.user.id);

        res.json(requests.map(r => ({
            friendshipId: r._id.toString(),
            id: r.requester._id.toString(),
            username: r.requester.username,
            displayName: r.requester.displayName,
            avatarUrl: r.requester.avatarUrl,
            createdAt: r.createdAt,
        })));
    } catch (error) {
        res.status(500).json({ error: 'Lỗi tải lời mời kết bạn' });
    }
});

/**
 * GET /api/friends/sent — Pending friend requests sent
 */
router.get('/sent', authenticate, async (req, res) => {
    try {
        const sent = await Friendship.getSentRequests(req.user.id);

        res.json(sent.map(r => ({
            friendshipId: r._id.toString(),
            id: r.recipient._id.toString(),
            username: r.recipient.username,
            displayName: r.recipient.displayName,
            avatarUrl: r.recipient.avatarUrl,
            createdAt: r.createdAt,
        })));
    } catch (error) {
        res.status(500).json({ error: 'Lỗi tải lời mời đã gửi' });
    }
});

/**
 * POST /api/friends/add — Send friend request
 * Body: { userId } or { username }
 */
router.post('/add', authenticate, async (req, res) => {
    try {
        const { userId, username } = req.body;

        let targetUser;
        if (userId) {
            targetUser = await User.findById(userId);
        } else if (username) {
            targetUser = await User.findOne({ username: username.toLowerCase() });
        }

        if (!targetUser) {
            return res.status(404).json({ error: 'Không tìm thấy người dùng' });
        }

        if (targetUser._id.toString() === req.user.id) {
            return res.status(400).json({ error: 'Không thể kết bạn với chính mình' });
        }

        // Check existing relationship
        const existing = await Friendship.findBetween(req.user.id, targetUser._id);
        if (existing) {
            if (existing.status === 'accepted') {
                return res.status(409).json({ error: 'Đã là bạn bè rồi' });
            }
            if (existing.status === 'pending') {
                return res.status(409).json({ error: 'Đã gửi lời mời rồi' });
            }
            if (existing.status === 'blocked') {
                return res.status(403).json({ error: 'Không thể kết bạn' });
            }
        }

        const friendship = new Friendship({
            requester: req.user.id,
            recipient: targetUser._id,
            status: 'pending',
        });
        await friendship.save();

        res.status(201).json({
            message: 'Đã gửi lời mời kết bạn',
            friendshipId: friendship._id.toString(),
            user: targetUser.toPublicJSON(),
        });
    } catch (error) {
        console.error('Add friend error:', error);
        if (error.code === 11000) {
            return res.status(409).json({ error: 'Lời mời đã tồn tại' });
        }
        res.status(500).json({ error: 'Gửi lời mời thất bại' });
    }
});

/**
 * PUT /api/friends/accept/:friendshipId — Accept a friend request
 */
router.put('/accept/:friendshipId', authenticate, async (req, res) => {
    try {
        const friendship = await Friendship.findById(req.params.friendshipId);
        if (!friendship) {
            return res.status(404).json({ error: 'Lời mời không tồn tại' });
        }

        if (friendship.recipient.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Chỉ người nhận mới có thể chấp nhận' });
        }

        if (friendship.status !== 'pending') {
            return res.status(400).json({ error: 'Lời mời đã được xử lý' });
        }

        friendship.status = 'accepted';
        await friendship.save();

        res.json({ message: 'Đã chấp nhận lời mời kết bạn' });
    } catch (error) {
        res.status(500).json({ error: 'Chấp nhận lời mời thất bại' });
    }
});

/**
 * PUT /api/friends/reject/:friendshipId — Reject a friend request
 */
router.put('/reject/:friendshipId', authenticate, async (req, res) => {
    try {
        const friendship = await Friendship.findById(req.params.friendshipId);
        if (!friendship) {
            return res.status(404).json({ error: 'Lời mời không tồn tại' });
        }

        if (friendship.recipient.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Không có quyền' });
        }

        await Friendship.findByIdAndDelete(req.params.friendshipId);
        res.json({ message: 'Đã từ chối lời mời kết bạn' });
    } catch (error) {
        res.status(500).json({ error: 'Từ chối lời mời thất bại' });
    }
});

/**
 * DELETE /api/friends/:friendshipId — Remove friend
 */
router.delete('/:friendshipId', authenticate, async (req, res) => {
    try {
        const friendship = await Friendship.findById(req.params.friendshipId);
        if (!friendship) {
            return res.status(404).json({ error: 'Không tìm thấy' });
        }

        // Either party can remove
        const isParty =
            friendship.requester.toString() === req.user.id ||
            friendship.recipient.toString() === req.user.id;

        if (!isParty) {
            return res.status(403).json({ error: 'Không có quyền' });
        }

        await Friendship.findByIdAndDelete(req.params.friendshipId);
        res.json({ message: 'Đã hủy kết bạn' });
    } catch (error) {
        res.status(500).json({ error: 'Hủy kết bạn thất bại' });
    }
});

/**
 * GET /api/friends/search?q=keyword — Search users to add
 */
router.get('/search', authenticate, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.json([]);
        }

        const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const users = await User.find({
            _id: { $ne: req.user.id },
            $or: [
                { username: regex },
                { displayName: regex },
            ],
        }).select('username displayName avatarUrl status').limit(20);

        res.json(users.map(u => u.toPublicJSON()));
    } catch (error) {
        res.status(500).json({ error: 'Tìm kiếm thất bại' });
    }
});

export default router;
