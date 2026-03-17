import crypto from 'crypto';

/**
 * Parse and validate Telegram initData from request headers
 * @param {string} initData - The initData string from Telegram Web App
 * @param {string} botToken - The bot token
 * @returns {object|null} - Parsed data if valid, null if invalid
 */
export function validateTelegramInitData(initData, botToken) {
    try {
        if (!initData) {
            return null;
        }

        const params = new URLSearchParams(initData);
        const hash = params.get('hash');

        if (!hash) {
            return null;
        }

        params.delete('hash');

        // Sort parameters alphabetically
        const dataCheckString = Array.from(params.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        // Create secret key from bot token
        const secretKey = crypto
            .createHash('sha256')
            .update(botToken)
            .digest();

        // Calculate expected hash
        const expectedHash = crypto
            .createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');

        // Compare hashes (constant-time comparison)
        const hashBuffer = Buffer.from(hash, 'hex');
        const expectedBuffer = Buffer.from(expectedHash, 'hex');

        if (hashBuffer.length !== expectedBuffer.length ||
            !crypto.timingSafeEqual(hashBuffer, expectedBuffer)) {
            return null;
        }

        // Check auth_date is not older than 5 minutes (300 seconds)
        const authDate = parseInt(params.get('auth_date'), 10);
        const now = Math.floor(Date.now() / 1000);
        if (isNaN(authDate) || now - authDate > 300) {
            return null;
        }

        // Parse user data
        const userJson = params.get('user');
        const user = userJson ? JSON.parse(userJson) : null;

        if (!user || !user.id) {
            return null;
        }

        return {
            telegramId: BigInt(user.id),
            firstName: user.first_name,
            lastName: user.last_name,
            username: user.username,
            languageCode: user.language_code,
            isPremium: user.is_premium || false,
            isBot: user.is_bot || false,
            authDate,
        };
    } catch (error) {
        console.error('initData validation error:', error.message);
        return null;
    }
}

/**
 * Express middleware to authenticate requests using Telegram initData
 * Looks for initData in:
 * 1. Authorization header: "tma <initData>"
 * 2. X-Telegram-InitData header
 * 3. body.initData
 */
export function telegramAuthMiddleware(req, res, next) {
    const botToken = process.env.BOT_TOKEN;

    if (!botToken) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    // Extract initData from various sources
    let initData = null;

    // 1. Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('tma ')) {
        initData = authHeader.substring(4);
    }

    // 2. Check X-Telegram-InitData header
    if (!initData && req.headers['x-telegram-initdata']) {
        initData = req.headers['x-telegram-initdata'];
    }

    // 3. Check body
    if (!initData && req.body && req.body.initData) {
        initData = req.body.initData;
    }

    if (!initData) {
        return res.status(401).json({ error: 'Authentication required. Please open the app from Telegram.' });
    }

    // Validate initData
    const userData = validateTelegramInitData(initData, botToken);

    if (!userData) {
        return res.status(401).json({ error: 'Invalid or expired authentication data. Please refresh the page.' });
    }

    // Attach user data to request for use in routes
    req.telegramUser = userData;
    req.telegramId = userData.telegramId;

    next();
}

/**
 * Check if user is admin
 */
export function requireAdmin(req, res, next) {
    const adminIds = process.env.ADMIN_TELEGRAM_IDS || '';

    if (!adminIds || adminIds.trim() === '') {
        return res.status(403).json({ error: 'Admin access not configured' });
    }

    const adminIdList = adminIds.split(',').map(id => BigInt(id.trim())).filter(id => !isNaN(id));

    if (!adminIdList.includes(req.telegramId)) {
        return res.status(403).json({ error: 'Admin access required' });
    }

    next();
}

export default { validateTelegramInitData, telegramAuthMiddleware, requireAdmin };
