/**
 * Chat Socket Handler — 1-1 Real-time Messaging
 * Uses MongoDB for persistence, Socket.io for real-time delivery.
 */
import Message from '../models/Message.js';
import { pushIfOffline } from '../utils/pushNotify.js';

export default function chatHandler(io, socket) {
    /**
     * Send a text message to another user
     */
    socket.on('chat:send', async (data, callback) => {
        try {
            const { recipientId, content, type = 'text', mediaUrl, isWhisper = false } = data;

            if (!recipientId) {
                return callback?.({ error: 'Người nhận bắt buộc' });
            }
            if (!content && !mediaUrl) {
                return callback?.({ error: 'Nội dung tin nhắn bắt buộc' });
            }

            const conversationId = Message.getConversationId(socket.user.id, recipientId);

            const message = new Message({
                conversationId,
                sender: socket.user.id,
                recipient: recipientId,
                content: content?.slice(0, 2000) || '',
                type,
                mediaUrl: mediaUrl || null,
                isWhisper: !!isWhisper,
            });

            await message.save();
            await message.populate('sender', 'username displayName avatarUrl');

            const formatted = {
                id: message._id.toString(),
                conversationId,
                senderId: message.sender._id.toString(),
                senderName: message.sender.displayName,
                senderAvatar: message.sender.avatarUrl,
                recipientId,
                content: message.content,
                type: message.type,
                mediaUrl: message.mediaUrl,
                isWhisper: message.isWhisper,
                whisperViewed: false,
                read: false,
                createdAt: message.createdAt,
            };

            // Send to both sender and recipient
            io.to(`user:${socket.user.id}`).emit('chat:message', formatted);
            io.to(`user:${recipientId}`).emit('chat:message', formatted);

            // Push notification if recipient is offline
            pushIfOffline(io, recipientId, {
                title: `${socket.user.displayName}`,
                body: isWhisper ? '👻 Tin nhắn bí mật' : (content?.slice(0, 100) || '📎 Đã gửi media'),
                data: { type: 'chat', chatPartnerId: socket.user.id },
            });

            callback?.({ success: true, message: formatted });
        } catch (error) {
            console.error('Chat send error:', error);
            callback?.({ error: 'Gửi tin nhắn thất bại' });
        }
    });

    /**
     * Mark messages as read
     */
    socket.on('chat:markRead', async (data, callback) => {
        try {
            const { conversationId } = data;
            await Message.updateMany(
                { conversationId, recipient: socket.user.id, read: false },
                { $set: { read: true, readAt: new Date() } }
            );

            // Notify sender that messages were read
            const otherId = conversationId.split('_').find(id => id !== socket.user.id);
            if (otherId) {
                io.to(`user:${otherId}`).emit('chat:read', {
                    conversationId,
                    readBy: socket.user.id,
                });
            }

            callback?.({ success: true });
        } catch (error) {
            callback?.({ error: 'Đánh dấu đã đọc thất bại' });
        }
    });

    /**
     * Typing indicator
     */
    socket.on('chat:typing', ({ recipientId }) => {
        io.to(`user:${recipientId}`).emit('chat:typing', {
            userId: socket.user.id,
            displayName: socket.user.displayName,
        });
    });

    socket.on('chat:stopTyping', ({ recipientId }) => {
        io.to(`user:${recipientId}`).emit('chat:stopTyping', {
            userId: socket.user.id,
        });
    });

    /**
     * Delete a message
     */
    socket.on('chat:delete', async (data, callback) => {
        try {
            const { messageId } = data;
            const msg = await Message.findById(messageId);
            if (!msg) return callback?.({ error: 'Tin nhắn không tồn tại' });
            if (msg.sender.toString() !== socket.user.id) {
                return callback?.({ error: 'Chỉ xóa được tin nhắn của mình' });
            }

            await Message.findByIdAndDelete(messageId);

            // Notify both parties
            const otherId = msg.conversationId.split('_').find(id => id !== socket.user.id);
            io.to(`user:${socket.user.id}`).emit('chat:deleted', { messageId });
            if (otherId) {
                io.to(`user:${otherId}`).emit('chat:deleted', { messageId });
            }

            callback?.({ success: true });
        } catch (error) {
            callback?.({ error: 'Xóa tin nhắn thất bại' });
        }
    });

    /**
     * Whisper message viewed — mark as viewed + auto-delete after 10s
     */
    socket.on('whisper:viewed', async (data, callback) => {
        try {
            const { messageId } = data;
            const msg = await Message.findById(messageId);
            if (!msg || !msg.isWhisper) return callback?.({ error: 'Tin nhắn không hợp lệ' });
            if (msg.recipient.toString() !== socket.user.id) {
                return callback?.({ error: 'Không có quyền xem tin này' });
            }

            // Mark as viewed
            msg.whisperViewed = true;
            msg.whisperViewedAt = new Date();
            await msg.save();

            // Notify sender that whisper was viewed
            io.to(`user:${msg.sender.toString()}`).emit('whisper:viewed', {
                messageId,
                viewedAt: msg.whisperViewedAt,
            });

            // Auto-delete whisper after 10 seconds
            setTimeout(async () => {
                try {
                    await Message.findByIdAndDelete(messageId);
                    const otherId = msg.sender.toString();
                    io.to(`user:${socket.user.id}`).emit('chat:deleted', { messageId });
                    io.to(`user:${otherId}`).emit('chat:deleted', { messageId });
                    console.log('👻 Whisper auto-deleted:', messageId);
                } catch (err) {
                    console.error('Whisper auto-delete failed:', err);
                }
            }, 10000);

            callback?.({ success: true });
        } catch (error) {
            console.error('Whisper view error:', error);
            callback?.({ error: 'Xem tin bí mật thất bại' });
        }
    });

    /**
     * Initiate a 1-1 voice call
     */
    socket.on('call:initiate', (data) => {
        const { recipientId } = data;
        io.to(`user:${recipientId}`).emit('call:incoming', {
            callerId: socket.user.id,
            callerName: socket.user.displayName,
        });
    });

    socket.on('call:accept', (data) => {
        io.to(`user:${data.callerId}`).emit('call:accepted', {
            recipientId: socket.user.id,
        });
    });

    socket.on('call:reject', (data) => {
        io.to(`user:${data.callerId}`).emit('call:rejected', {
            recipientId: socket.user.id,
        });
    });

    socket.on('call:end', (data) => {
        io.to(`user:${data.peerId}`).emit('call:ended', {
            userId: socket.user.id,
        });
    });

    // WebRTC signaling for 1-1 calls
    socket.on('call:signal', (data) => {
        io.to(`user:${data.peerId}`).emit('call:signal', {
            userId: socket.user.id,
            signal: data.signal,
        });
    });
}
