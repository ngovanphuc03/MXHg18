/**
 * Friendship Model — MongoDB Schema
 * Manages friend relationships: Add / Accept / Reject / Remove / Block
 */
import mongoose from 'mongoose';

const friendshipSchema = new mongoose.Schema({
    requester: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'blocked'],
        default: 'pending',
    },
}, {
    timestamps: true,
    toJSON: {
        transform(doc, ret) {
            ret.id = ret._id.toString();
            delete ret._id;
            delete ret.__v;
            return ret;
        },
    },
});

// Prevent duplicate friendships
friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });

// Query helpers for finding friend status between two users
friendshipSchema.statics.findBetween = function (userA, userB) {
    return this.findOne({
        $or: [
            { requester: userA, recipient: userB },
            { requester: userB, recipient: userA },
        ],
    });
};

// Get all accepted friends for a user
friendshipSchema.statics.getFriends = function (userId) {
    return this.find({
        $or: [
            { requester: userId, status: 'accepted' },
            { recipient: userId, status: 'accepted' },
        ],
    }).populate('requester recipient', 'username displayName avatarUrl status gameStatus lastSeen');
};

// Get pending requests received by a user
friendshipSchema.statics.getPendingRequests = function (userId) {
    return this.find({
        recipient: userId,
        status: 'pending',
    }).populate('requester', 'username displayName avatarUrl');
};

// Get sent requests by a user
friendshipSchema.statics.getSentRequests = function (userId) {
    return this.find({
        requester: userId,
        status: 'pending',
    }).populate('recipient', 'username displayName avatarUrl');
};

export default mongoose.model('Friendship', friendshipSchema);
