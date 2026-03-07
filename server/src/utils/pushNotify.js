/**
 * pushNotify.js — Server-side Push Notification Sender
 * Sends FCM push notifications to users who are offline / app backgrounded.
 *
 * Uses FCM HTTP v1 API via firebase-admin SDK (if available)
 * or legacy FCM HTTP API as fallback.
 *
 * ENV: FCM_SERVER_KEY — legacy server key from Firebase Console → Cloud Messaging
 */
import User from '../models/User.js';
import config from '../config/index.js';

/**
 * Send push notification to a specific user
 * @param {string} userId - Target user's MongoDB _id
 * @param {object} notification - { title, body, data? }
 */
export async function sendPushToUser(userId, { title, body, data = {} }) {
    try {
        const user = await User.findById(userId).select('fcmTokens');
        if (!user?.fcmTokens?.length) return;

        const serverKey = config.fcm?.serverKey;
        if (!serverKey) {
            console.warn('⚠️ FCM_SERVER_KEY not set — push notifications disabled');
            return;
        }

        const staleTokens = [];

        // Send to all registered devices
        for (const { token, platform } of user.fcmTokens) {
            try {
                const payload = {
                    to: token,
                    notification: {
                        title,
                        body,
                        sound: 'default',
                        ...(platform === 'android' && {
                            android_channel_id: 'dong_g18_chat',
                            icon: 'ic_notification',
                        }),
                    },
                    data: {
                        ...data,
                        click_action: 'FLUTTER_NOTIFICATION_CLICK', // Capacitor handles this
                    },
                    // High priority for immediate delivery
                    priority: 'high',
                    content_available: true, // iOS background
                };

                const resp = await fetch('https://fcm.googleapis.com/fcm/send', {
                    method: 'POST',
                    headers: {
                        'Authorization': `key=${serverKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                });

                const result = await resp.json();

                // Mark stale tokens for cleanup
                if (result.results?.[0]?.error === 'NotRegistered' ||
                    result.results?.[0]?.error === 'InvalidRegistration') {
                    staleTokens.push(token);
                }
            } catch (err) {
                console.warn(`Push send failed for token ${token.slice(0, 10)}...:`, err.message);
            }
        }

        // Cleanup stale tokens
        if (staleTokens.length > 0) {
            await User.findByIdAndUpdate(userId, {
                $pull: { fcmTokens: { token: { $in: staleTokens } } },
            });
            console.log(`🧹 Cleaned ${staleTokens.length} stale FCM tokens for user ${userId}`);
        }
    } catch (err) {
        console.error('sendPushToUser error:', err);
    }
}

/**
 * Check if a user is currently connected via Socket.io
 * (If connected, no need to send push — they'll get the socket event)
 * @param {object} io - Socket.io server instance
 * @param {string} userId - Target user's ID
 * @returns {boolean}
 */
export function isUserOnline(io, userId) {
    const room = io.sockets.adapter.rooms.get(`user:${userId}`);
    return room && room.size > 0;
}

/**
 * Send push only if user is offline (not connected to socket)
 */
export async function pushIfOffline(io, userId, notification) {
    if (isUserOnline(io, userId)) return;
    await sendPushToUser(userId, notification);
}
