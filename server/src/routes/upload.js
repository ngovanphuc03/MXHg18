/**
 * Upload Routes — Media upload for chat, feed, avatars
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
            url: `/uploads/photos/${req.file.filename}`,
            filename: req.file.originalname,
            size: req.file.size,
        });
    } catch (error) {
        res.status(500).json({ error: 'Upload thất bại' });
    }
});

/**
 * POST /api/upload/chat — Upload chat media (images, files)
 */
router.post('/chat', authenticate, uploadMultiple('chat', 5), async (req, res) => {
    try {
        if (!req.files?.length) return res.status(400).json({ error: 'Không có file' });
        res.json({
            files: req.files.map(f => ({
                url: `/uploads/chat/${f.filename}`,
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
