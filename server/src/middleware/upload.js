/**
 * File Upload Middleware — Cloudinary Storage
 * Images are stored on Cloudinary CDN, not local disk.
 * Free tier: 25GB storage, 25GB bandwidth/month
 */
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import config from '../config/index.js';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const makeStorage = (folder) => new CloudinaryStorage({
    cloudinary,
    params: {
        folder: `dong-g18/${folder}`,
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm'],
        resource_type: 'auto',
        transformation: folder === 'avatars'
            ? [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }]
            : folder === 'photos'
                ? [{ width: 1080, quality: 'auto:good' }]
                : [{ quality: 'auto:good' }],
    },
});

const fileFilter = (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error(`Loại file không hỗ trợ`), false);
};

const maxSize = (config.upload?.maxFileSizeMB || 10) * 1024 * 1024;

export const uploadSingle = (folder) => (req, res, next) => {
    multer({ storage: makeStorage(folder), fileFilter, limits: { fileSize: maxSize } })
        .single('file')(req, res, next);
};

export const uploadMultiple = (folder, maxFiles = 5) => (req, res, next) => {
    multer({ storage: makeStorage(folder), fileFilter, limits: { fileSize: maxSize, files: maxFiles } })
        .array('files', maxFiles)(req, res, next);
};

    };
};
