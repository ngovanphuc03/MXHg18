/**
 * Upload Routes — Media upload via Cloudinary CDN
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { uploadSingle, uploadMultiple } from '../middleware/upload.js';

const router = Router();

/**
 * POST /api/upload/image — Upload single image
 */
router.post('/image', authenticate, uploadSingle('photos'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Không có file' });
        res.json({
            url: req.file.path,          // Cloudinary HTTPS URL
            filename: req.file.originalname,
            size: req.file.size,
        });
    } catch (error) {
        res.status(500).json({ error: 'Upload thất bại' });
    }
});

/**
 * POST /api/upload/avatar — Upload avatar
 */
router.post('/avatar', authenticate, uploadSingle('avatars'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Không có file' });
        res.json({
            url: req.file.path,
            filename: req.file.originalname,
        });
    } catch (error) {
        res.status(500).json({ error: 'Upload avatar thất bại' });
    }
});

/**
 * POST /api/upload/chat — Upload chat media
 */
router.post('/chat', authenticate, uploadMultiple('chat', 5), async (req, res) => {
    try {
        if (!req.files?.length) return res.status(400).json({ error: 'Không có file' });
        res.json({
            files: req.files.map(f => ({
                url: f.path,             // Cloudinary HTTPS URL
                filename: f.originalname,
                mimetype: f.mimetype,
                size: f.size,
            })),
        });
    } catch (error) {
        res.status(500).json({ error: 'Upload thất bại' });
    }
});

export default router;
