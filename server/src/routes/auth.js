/**
 * Auth Routes — Register / Login / Profile / Members
 * JWT-based authentication with MongoDB.
 */
import { Router } from 'express';
import User from '../models/User.js';
import { authenticate, generateToken } from '../middleware/auth.js';
import { uploadSingle } from '../middleware/upload.js';

const router = Router();

/**
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
    try {
        const { username, displayName, email, password } = req.body;

        if (!username || !displayName || !email || !password) {
            return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
        }
        if (username.length < 3) {
            return res.status(400).json({ error: 'Username phải có ít nhất 3 ký tự' });
        }

        // Check existing
        const existing = await User.findOne({
            $or: [
                { username: username.toLowerCase() },
                { email: email.toLowerCase() },
            ],
        });
        if (existing) {
            return res.status(409).json({ error: 'Username hoặc email đã được sử dụng' });
        }

        const user = new User({
            username: username.toLowerCase().trim(),
            displayName: displayName.trim(),
            email: email.toLowerCase().trim(),
            passwordHash: password, // Will be hashed by pre-save hook
            avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
        });

        await user.save();
        const token = generateToken(user);

        res.status(201).json({
            token,
            user: user.toPublicJSON(),
        });
    } catch (error) {
        console.error('Register error:', error);
        if (error.code === 11000) {
            return res.status(409).json({ error: 'Username hoặc email đã tồn tại' });
        }
        res.status(500).json({ error: 'Đăng ký thất bại' });
    }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Vui lòng nhập username/email và mật khẩu' });
        }

        // Find by username or email
        const user = await User.findOne({
            $or: [
                { username: username.toLowerCase() },
                { email: username.toLowerCase() },
            ],
        });

        if (!user) {
            return res.status(401).json({ error: 'Tài khoản không tồn tại' });
        }

        const valid = await user.comparePassword(password);
        if (!valid) {
            return res.status(401).json({ error: 'Mật khẩu không đúng' });
        }

        // Update status
        user.status = 'online';
        user.lastSeen = new Date();
        await user.save();

        const token = generateToken(user);

        res.json({
            token,
            user: user.toPublicJSON(),
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Đăng nhập thất bại' });
    }
});

/**
 * GET /api/auth/me — Current user profile
 */
router.get('/me', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
        res.json(user.toPublicJSON());
    } catch (error) {
        res.status(500).json({ error: 'Lỗi tải thông tin' });
    }
});

/**
 * PUT /api/auth/profile — Update profile
 */
router.put('/profile', authenticate, uploadSingle('avatars'), async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

        const { displayName, bio, gameStatus, gameRank } = req.body;

        if (displayName) user.displayName = displayName.trim().slice(0, 50);
        if (bio !== undefined) user.bio = bio.trim().slice(0, 200);
        if (gameStatus !== undefined) user.gameStatus = gameStatus.trim().slice(0, 100);
        if (gameRank !== undefined) user.gameRank = gameRank.trim().slice(0, 50);

        if (req.file) {
            // req.file.path = full Cloudinary HTTPS URL
            user.avatarUrl = req.file.path;
        }

        await user.save();
        res.json(user.toPublicJSON());
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Cập nhật thất bại' });
    }
});

/**
 * GET /api/auth/members — All members list
 */
router.get('/members', authenticate, async (req, res) => {
    try {
        const members = await User.find({})
            .select('username displayName avatarUrl status gameStatus lastSeen')
            .sort({ displayName: 1 });

        res.json(members.map(m => m.toPublicJSON()));
    } catch (error) {
        res.status(500).json({ error: 'Lỗi tải danh sách' });
    }
});

/**
 * GET /api/auth/user/:id — Get user by ID
 */
router.get('/user/:id', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
        res.json(user.toPublicJSON());
    } catch (error) {
        res.status(500).json({ error: 'Lỗi tải thông tin' });
    }
});

export default router;
