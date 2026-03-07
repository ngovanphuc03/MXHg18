/**
 * Gamification Engine — EXP / Level / Rewards
 * RPG-ifies the Động G18 app with XP, levels, and unlockable rewards.
 *
 * EXP Sources:
 *   +5  — Upload a Locket photo
 *   +20 — 1 hour in voice room (~1 EXP per 3 min)
 *   +2  — React to a photo
 *   +1  — Daily login bonus (first action of the day)
 *
 * Level formula: totalExpForLevel(n) = 25 * n * (n - 1)
 *   Level  1:     0 XP
 *   Level  5:   500 XP
 *   Level 10: 2,250 XP
 *   Level 20: 9,500 XP
 *   Level 30: 21,750 XP
 *   Level 50: 61,250 XP
 */
import User from '../models/User.js';

// ─── Level thresholds ────────────────────────────────────
export const MAX_LEVEL = 50;

/** Total cumulative EXP required to reach a given level */
export function expForLevel(level) {
    if (level <= 1) return 0;
    return 25 * level * (level - 1);
}

/** Calculate level from total EXP */
export function levelFromExp(totalExp) {
    // Solve: 25 * L * (L-1) <= totalExp
    // L^2 - L - totalExp/25 <= 0
    // L = (1 + sqrt(1 + 4*totalExp/25)) / 2
    const L = Math.floor((1 + Math.sqrt(1 + (4 * totalExp) / 25)) / 2);
    return Math.min(L, MAX_LEVEL);
}

/** Get progress within current level (0..1) */
export function levelProgress(totalExp) {
    const level = levelFromExp(totalExp);
    if (level >= MAX_LEVEL) return 1;
    const currentLevelExp = expForLevel(level);
    const nextLevelExp = expForLevel(level + 1);
    return (totalExp - currentLevelExp) / (nextLevelExp - currentLevelExp);
}

// ─── Reward definitions ──────────────────────────────────
export const LEVEL_REWARDS = [
    { level: 1, frame: 'none', title: 'Tân Binh', color: null },
    { level: 5, frame: 'bronze', title: 'Chiến Binh Đồng', color: '#cd7f32' },
    { level: 10, frame: 'silver', title: 'Hiệp Sĩ Bạc', color: '#c0c0c0' },
    { level: 15, frame: 'gold', title: 'Dũng Sĩ Vàng', color: '#ffd700' },
    { level: 20, frame: 'platinum', title: 'Bá Vương Bạch Kim', color: '#e5e4e2' },
    { level: 30, frame: 'diamond', title: 'Kim Cương Huyền Thoại', color: '#b9f2ff' },
    { level: 40, frame: 'legendary', title: 'Huyền Thoại Rực Lửa', color: '#ff6b35' },
    { level: 50, frame: 'vip', title: 'Chúa Tể Động G18 ✨', color: '#00ffc8', glow: true },
];

/** Get the highest reward unlocked for a level */
export function getRewardForLevel(level) {
    let reward = LEVEL_REWARDS[0];
    for (const r of LEVEL_REWARDS) {
        if (level >= r.level) reward = r;
    }
    return reward;
}

// ─── Core: Add EXP to a user ─────────────────────────────
/**
 * Award EXP to a user and recalculate their level.
 * Returns { exp, level, leveledUp, reward } or null on error.
 */
export async function addExp(userId, amount, reason = '') {
    if (!userId || !amount || amount <= 0) return null;

    try {
        const user = await User.findById(userId);
        if (!user) return null;

        const oldLevel = user.level || levelFromExp(user.exp || 0);
        user.exp = (user.exp || 0) + amount;
        user.level = levelFromExp(user.exp);

        // Cap at max level
        if (user.level > MAX_LEVEL) user.level = MAX_LEVEL;

        const leveledUp = user.level > oldLevel;

        await user.save();

        const reward = getRewardForLevel(user.level);

        console.log(`⭐ +${amount} EXP → ${user.displayName} (Lv.${user.level}, ${user.exp} XP) [${reason}]`);

        return {
            exp: user.exp,
            level: user.level,
            leveledUp,
            oldLevel,
            reward,
        };
    } catch (err) {
        console.error('addExp error:', err);
        return null;
    }
}

/**
 * Calculate voice EXP based on minutes spent in voice.
 * ~1 EXP per 3 minutes ≈ 20 EXP per hour.
 */
export function voiceExpForMinutes(minutes) {
    return Math.floor(minutes / 3);
}

/**
 * Get full gamification profile for a user.
 */
export async function getGamificationProfile(userId) {
    const user = await User.findById(userId).select('exp level displayName avatarUrl');
    if (!user) return null;

    const exp = user.exp || 0;
    const level = user.level || levelFromExp(exp);
    const reward = getRewardForLevel(level);
    const progress = levelProgress(exp);
    const currentLevelExp = expForLevel(level);
    const nextLevelExp = level >= MAX_LEVEL ? expForLevel(MAX_LEVEL) : expForLevel(level + 1);

    return {
        userId: user._id.toString(),
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        exp,
        level,
        progress,
        expInLevel: exp - currentLevelExp,
        expToNext: nextLevelExp - currentLevelExp,
        reward,
        allRewards: LEVEL_REWARDS,
        maxLevel: MAX_LEVEL,
    };
}
