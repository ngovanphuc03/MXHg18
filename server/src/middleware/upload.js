/**
 * File Upload Middleware (Multer)
 * Stores to local disk, returns URL path.
 */
import multer from 'multer';
import { mkdirSync, existsSync } from 'fs';
import { resolve, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/index.js';

const uploadsDir = resolve(config.upload.dir);
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

// Destination folders
['avatars', 'photos', 'chat', 'rooms'].forEach(sub => {
    const dir = resolve(uploadsDir, sub);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
    destination(req, file, cb) {
        const folder = req.uploadFolder || 'chat';
        const dir = resolve(uploadsDir, folder);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename(req, file, cb) {
        const ext = extname(file.originalname).toLowerCase() || '.jpg';
        cb(null, `${uuidv4()}${ext}`);
    },
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/webm',
        'application/pdf', 'text/plain',
    ];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Loại file ${file.mimetype} không được hỗ trợ`), false);
    }
};

const maxSize = config.upload.maxFileSizeMB * 1024 * 1024;

export const uploadSingle = (folder) => {
    return (req, res, next) => {
        req.uploadFolder = folder;
        multer({ storage, fileFilter, limits: { fileSize: maxSize } })
            .single('file')(req, res, next);
    };
};

export const uploadMultiple = (folder, maxFiles = 5) => {
    return (req, res, next) => {
        req.uploadFolder = folder;
        multer({ storage, fileFilter, limits: { fileSize: maxSize, files: maxFiles } })
            .array('files', maxFiles)(req, res, next);
    };
};
