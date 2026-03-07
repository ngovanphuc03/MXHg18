/**
 * Gamification Routes — EXP, Levels, Leaderboard
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
    getGamificationProfile,
    LEVEL_REWARDS,
    levelFromExp,
    getRewardForLevel,
} from '../utils/gamification.js';
import User from '../models/User.js';

const router = Router();

/**
 * GET /api/gamification/me — Current user's gamification profile
 */
router.get('/me', authenticate, async (req, res) => {
    try {
        const profile = await getGamificationProfile(req.user.id);
        if (!profile) return res.status(404).json({ error: 'User not found' });
        res.json(profile);
    } catch (err) {
        console.error('Gamification profile error:', err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

/**
 * GET /api/gamification/user/:id — Another user's gamification profile
 */
router.get('/user/:id', authenticate, async (req, res) => {
    try {
        const profile = await getGamificationProfile(req.params.id);
        if (!profile) return res.status(404).json({ error: 'User not found' });
        res.json(profile);
    } catch (err) {
        res.status(500).json({ error: 'Lỗi server' });
    }
});

/**
 * GET /api/gamification/leaderboard — Top 20 users by EXP
 */
router.get('/leaderboard', authenticate, async (req, res) => {
    try {
        const topUsers = await User.find({})
            .sort({ exp: -1, level: -1 })
            .limit(20)
            .select('displayName username avatarUrl exp level');

        const leaderboard = topUsers.map((u, i) => ({
            rank: i + 1,
            userId: u._id.toString(),
            displayName: u.displayName,
            username: u.username,
            avatarUrl: u.avatarUrl,
            exp: u.exp || 0,
            level: u.level || levelFromExp(u.exp || 0),
            reward: getRewardForLevel(u.level || levelFromExp(u.exp || 0)),
        }));

        res.json(leaderboard);
    } catch (err) {
        console.error('Leaderboard error:', err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

/**
 * GET /api/gamification/rewards — All reward definitions
 */
router.get('/rewards', authenticate, (req, res) => {
    res.json(LEVEL_REWARDS);
});

export default router;
