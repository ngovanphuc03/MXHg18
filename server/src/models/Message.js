/**
 * Message Model — MongoDB Schema
 * Supports 1-1 private conversations.
 * conversationId = sorted pair of user IDs for consistent lookups.
 */
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    conversationId: {
        type: String,
        required: true,
        index: true,
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    content: {
        type: String,
        default: '',
        maxlength: 2000,
    },
    type: {
        type: String,
        enum: ['text', 'image', 'file', 'system', 'voice-call'],
        default: 'text',
    },
    mediaUrl: {
        type: String,
        default: null,
    },
    isWhisper: {
        type: Boolean,
        default: false,
    },
    whisperViewed: {
        type: Boolean,
        default: false,
    },
    whisperViewedAt: {
        type: Date,
        default: null,
    },
    read: {
        type: Boolean,
        default: false,
    },
    readAt: {
        type: Date,
        default: null,
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

// Compound index for efficient conversation queries
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, read: 1 });

// Generate a deterministic conversationId from two user IDs
messageSchema.statics.getConversationId = function (userA, userB) {
    const ids = [userA.toString(), userB.toString()].sort();
    return `${ids[0]}_${ids[1]}`;
};

// Get chat list (latest message per conversation for a user)
messageSchema.statics.getChatList = async function (userId) {
    return this.aggregate([
        {
            $match: {
                $or: [
                    { sender: new mongoose.Types.ObjectId(userId) },
                    { recipient: new mongoose.Types.ObjectId(userId) },
                ],
            },
        },
        { $sort: { createdAt: -1 } },
        {
            $group: {
                _id: '$conversationId',
                lastMessage: { $first: '$$ROOT' },
                unreadCount: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $eq: ['$recipient', new mongoose.Types.ObjectId(userId)] },
                                    { $eq: ['$read', false] },
                                ],
                            },
                            1,
                            0,
                        ],
                    },
                },
            },
        },
        { $sort: { 'lastMessage.createdAt': -1 } },
    ]);
};

export default mongoose.model('Message', messageSchema);
