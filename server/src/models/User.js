/**
 * User Model — MongoDB Schema
 * Stores user profile, auth, and status information.
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        minlength: 3,
        maxlength: 30,
        match: /^[a-z0-9._]+$/,
    },
    displayName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    passwordHash: {
        type: String,
        required: true,
    },
    avatarUrl: {
        type: String,
        default: '',
    },
    bio: {
        type: String,
        default: 'Thành viên mới của Động G18 ✨',
        maxlength: 200,
    },
    status: {
        type: String,
        enum: ['online', 'offline', 'in-voice', 'in-game', 'idle'],
        default: 'offline',
    },
    gameStatus: {
        type: String,
        default: '',
        maxlength: 100,
    },
    gameRank: {
        type: String,
        default: '',
        maxlength: 50,
    },
    // ─── Gamification RPG fields ───
    exp: {
        type: Number,
        default: 0,
        min: 0,
    },
    level: {
        type: Number,
        default: 1,
        min: 1,
    },
    fcmTokens: [{
        token: { type: String, required: true },
        platform: { type: String, enum: ['android', 'ios', 'web'], default: 'android' },
        updatedAt: { type: Date, default: Date.now },
    }],
    lastSeen: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
    toJSON: {
        transform(doc, ret) {
            ret.id = ret._id.toString();
            delete ret._id;
            delete ret.__v;
            delete ret.passwordHash;
            return ret;
        },
    },
});

// Index for text search
userSchema.index({ username: 'text', displayName: 'text' });

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('passwordHash')) return next();
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function (password) {
    return bcrypt.compare(password, this.passwordHash);
};

// Public profile (safe to send to other users)
userSchema.methods.toPublicJSON = function () {
    return {
        id: this._id.toString(),
        username: this.username,
        displayName: this.displayName,
        avatarUrl: this.avatarUrl,
        bio: this.bio,
        status: this.status,
        gameStatus: this.gameStatus,
        gameRank: this.gameRank,
        exp: this.exp || 0,
        level: this.level || 1,
        lastSeen: this.lastSeen,
    };
};

export default mongoose.model('User', userSchema);
