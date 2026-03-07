/**
 * JWT Authentication Middleware
 */
import jwt from 'jsonwebtoken';
import config from '../config/index.js';

export function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token xác thực bắt buộc' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, config.jwt.secret);

        req.user = {
            id: decoded.id,
            username: decoded.username,
            displayName: decoded.displayName,
        };

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token hết hạn' });
        }
        return res.status(401).json({ error: 'Token không hợp lệ' });
    }
}

export function authenticateSocket(socket, next) {
    try {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Token xác thực bắt buộc'));

        const decoded = jwt.verify(token, config.jwt.secret);
        socket.user = {
            id: decoded.id,
            username: decoded.username,
            displayName: decoded.displayName,
        };
        next();
    } catch (error) {
        next(new Error('Token không hợp lệ'));
    }
}

export function generateToken(user) {
    return jwt.sign(
        {
            id: user._id?.toString() || user.id,
            username: user.username,
            displayName: user.displayName,
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
    );
}
