/**
 * LocketPhoto Model — MongoDB Schema
 * Locket-style instant photos shared with friends.
 */
import mongoose from 'mongoose';

const locketPhotoSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    photoUrl: {
        type: String,
        required: true,
    },
    caption: {
        type: String,
        default: '',
        maxlength: 200,
    },
    reactions: {
        type: Map,
        of: Number,
        default: {},
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

locketPhotoSchema.index({ userId: 1, createdAt: -1 });
locketPhotoSchema.index({ createdAt: -1 });

export default mongoose.model('LocketPhoto', locketPhotoSchema);
