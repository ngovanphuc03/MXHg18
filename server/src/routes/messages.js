/**
 * Messages Routes — 1-1 Chat history & Conversations
 */
import { Router } from 'express';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/messages/conversations — Chat list (latest msg per conversation)
 */
router.get('/conversations', authenticate, async (req, res) => {
    try {
        const chatList = await Message.getChatList(req.user.id);

        // Enrich with user info for the other party
        const enriched = await Promise.all(chatList.map(async (item) => {
            const msg = item.lastMessage;
            const otherId = msg.sender.toString() === req.user.id
                ? msg.recipient.toString()
                : msg.sender.toString();

            const otherUser = await User.findById(otherId)
                .select('username displayName avatarUrl status lastSeen');

            return {
                conversationId: item._id,
                otherUser: otherUser ? otherUser.toPublicJSON() : { id: otherId, displayName: 'Unknown' },
                lastMessage: {
                    id: msg._id.toString(),
                    content: msg.content,
                    type: msg.type,
                    senderId: msg.sender.toString(),
                    createdAt: msg.createdAt,
                },
                unreadCount: item.unreadCount,
            };
        }));

        res.json(enriched);
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ error: 'Lỗi tải danh sách hội thoại' });
    }
});

/**
 * GET /api/messages/:userId — Get message history with a specific user
 */
router.get('/:userId', authenticate, async (req, res) => {
    try {
        const { before, limit = 50 } = req.query;
        const conversationId = Message.getConversationId(req.user.id, req.params.userId);
        const pageLimit = Math.min(parseInt(limit), 100);

        const filter = { conversationId };
        if (before) {
            filter.createdAt = { $lt: new Date(before) };
        }

        const messages = await Message.find(filter)
            .sort({ createdAt: -1 })
            .limit(pageLimit)
            .populate('sender', 'username displayName avatarUrl');

        // Mark unread messages as read
        await Message.updateMany(
            { conversationId, recipient: req.user.id, read: false },
            { $set: { read: true, readAt: new Date() } }
        );

        res.json({
            messages: messages.reverse().map(m => ({
                id: m._id.toString(),
                senderId: m.sender._id.toString(),
                senderName: m.sender.displayName,
                senderAvatar: m.sender.avatarUrl,
                content: m.content,
                type: m.type,
                mediaUrl: m.mediaUrl,
                read: m.read,
                createdAt: m.createdAt,
            })),
            hasMore: messages.length === pageLimit,
        });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Lỗi tải tin nhắn' });
    }
});

export default router;
