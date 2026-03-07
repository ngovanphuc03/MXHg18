/**
 * Room Model — MongoDB Schema
 * Game/Voice rooms: Public (join freely) or Private (password required).
 * Max 8 participants per room. Creator can delete/manage.
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const participantSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    displayName: String,
    avatarUrl: String,
    isMuted: { type: Boolean, default: false },
    isDeafened: { type: Boolean, default: false },
    isSpeaking: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now },
}, { _id: false });

const roomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50,
    },
    description: {
        type: String,
        default: '',
        maxlength: 200,
    },
    type: {
        type: String,
        enum: ['public', 'private'],
        default: 'public',
    },
    passwordHash: {
        type: String,
        default: null,
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    icon: {
        type: String,
        default: '🎮',
    },
    color: {
        type: String,
        default: '#7c5cfc',
    },
    maxParticipants: {
        type: Number,
        default: 8,
        min: 2,
        max: 8,
    },
    participants: [participantSchema],
    isActive: {
        type: Boolean,
        default: true,
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

// Set password for private rooms
roomSchema.methods.setPassword = async function (password) {
    this.passwordHash = await bcrypt.hash(password, 10);
};

// Verify room password
roomSchema.methods.verifyPassword = async function (password) {
    if (!this.passwordHash) return true; // Public room
    return bcrypt.compare(password, this.passwordHash);
};

// Add participant
roomSchema.methods.addParticipant = function (user) {
    if (this.participants.length >= this.maxParticipants) {
        throw new Error('Phòng đã đầy');
    }
    const existing = this.participants.find(p => p.userId.toString() === user._id.toString());
    if (existing) return; // Already in room

    this.participants.push({
        userId: user._id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
    });
};

// Remove participant
roomSchema.methods.removeParticipant = function (userId) {
    this.participants = this.participants.filter(
        p => p.userId.toString() !== userId.toString()
    );
};

export default mongoose.model('Room', roomSchema);
