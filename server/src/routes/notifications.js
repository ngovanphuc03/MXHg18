/**
 * Notification Routes — Push token registration + notification sending
 * POST /api/notifications/register   — Store FCM token for a user
 * POST /api/notifications/unregister — Remove a token (on logout)
 */
import { Router } from 'express';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/notifications/register
 * Body: { token: "fcm_token_string", platform: "android"|"ios"|"web" }
 */
router.post('/register', authenticate, async (req, res) => {
    try {
        const { token, platform = 'android' } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Token bắt buộc' });
        }

        // Add token to user's fcmTokens array (avoid duplicates)
        await User.findByIdAndUpdate(req.user.id, {
            $addToSet: {
                fcmTokens: { token, platform, updatedAt: new Date() },
            },
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Register push token error:', error);
        res.status(500).json({ error: 'Đăng ký token thất bại' });
    }
});

/**
 * POST /api/notifications/unregister
 * Body: { token: "fcm_token_string" }
 */
router.post('/unregister', authenticate, async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Token bắt buộc' });
        }

        // Remove this specific token
        await User.findByIdAndUpdate(req.user.id, {
            $pull: { fcmTokens: { token } },
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Unregister push token error:', error);
        res.status(500).json({ error: 'Hủy đăng ký token thất bại' });
    }
});

export default router;
