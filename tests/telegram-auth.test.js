/**
 * Unit tests for Telegram initData HMAC validation
 */

import crypto from 'crypto';
import { validateTelegramInitData } from '../src/middleware/telegramAuth.js';

// Generate a test bot token (this is just for testing, not a real bot)
const TEST_BOT_TOKEN = '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz';

/**
 * Generate valid initData for testing
 */
function generateValidInitData(userId, authDate = Math.floor(Date.now() / 1000)) {
    const user = {
        id: userId,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
        language_code: 'en',
    };

    const params = new URLSearchParams();
    params.append('auth_date', authDate.toString());
    params.append('hash', '');
    params.append('user', JSON.stringify(user));

    const dataCheckString = Array.from(params.entries())
        .filter(([key]) => key !== 'hash')
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

    const secretKey = crypto
        .createHash('sha256')
        .update(TEST_BOT_TOKEN)
        .digest();

    const hash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

    params.set('hash', hash);

    return params.toString();
}

/**
 * Helper to tamper with initData - modifies the user data
 */
function tamperWithValidInitData(initData) {
    const params = new URLSearchParams(initData);
    const user = JSON.parse(params.get('user'));
    user.id = 999999999; // Change user ID
    user.first_name = 'Hacked';
    params.set('user', JSON.stringify(user));

    // Note: This will produce an invalid hash since we changed the data
    return params.toString();
}

/**
 * Tamper with initData to test tampering detection
 */
function tamperWithInitData(initData) {
    const params = new URLSearchParams(initData);
    params.set('user', '{"id": 999999999, "first_name": "Hacker"}');
    return params.toString();
}

describe('Telegram initData Validation', () => {
    const validUserId = 123456789;

    test('should validate correct initData', () => {
        const initData = generateValidInitData(validUserId);
        const result = validateTelegramInitData(initData, TEST_BOT_TOKEN);

        expect(result).not.toBeNull();
        expect(result.telegramId).toBe(BigInt(validUserId));
        expect(result.firstName).toBe('Test');
        expect(result.username).toBe('testuser');
    });

    test('should reject tampered initData', () => {
        const validInitData = generateValidInitData(validUserId);
        const tamperedInitData = tamperWithValidInitData(validInitData);

        const result = validateTelegramInitData(tamperedInitData, TEST_BOT_TOKEN);
        expect(result).toBeNull();
    });

    test('should reject expired auth_date (older than 5 minutes)', () => {
        const expiredAuthDate = Math.floor(Date.now() / 1000) - 400; // 6+ minutes ago
        const initData = generateValidInitData(validUserId, expiredAuthDate);

        const result = validateTelegramInitData(initData, TEST_BOT_TOKEN);
        expect(result).toBeNull();
    });

    test('should accept auth_date exactly at 5 minutes', () => {
        const oldAuthDate = Math.floor(Date.now() / 1000) - 299; // Just under 5 minutes
        const initData = generateValidInitData(validUserId, oldAuthDate);

        const result = validateTelegramInitData(initData, TEST_BOT_TOKEN);
        expect(result).not.toBeNull();
    });

    test('should reject initData without hash', () => {
        const params = new URLSearchParams();
        params.append('auth_date', Math.floor(Date.now() / 1000).toString());
        params.append('user', JSON.stringify({ id: validUserId }));

        const result = validateTelegramInitData(params.toString(), TEST_BOT_TOKEN);
        expect(result).toBeNull();
    });

    test('should reject initData with invalid JSON user', () => {
        const params = new URLSearchParams();
        params.append('auth_date', Math.floor(Date.now() / 1000).toString());
        params.append('user', 'invalid json');
        params.append('hash', 'somehash');

        const result = validateTelegramInitData(params.toString(), TEST_BOT_TOKEN);
        expect(result).toBeNull();
    });

    test('should reject empty initData', () => {
        const result = validateTelegramInitData('', TEST_BOT_TOKEN);
        expect(result).toBeNull();
    });

    test('should reject null initData', () => {
        const result = validateTelegramInitData(null, TEST_BOT_TOKEN);
        expect(result).toBeNull();
    });

    test('should reject wrong bot token', () => {
        const initData = generateValidInitData(validUserId);
        const wrongToken = 'wrong_token_1234567890:ABCdefGHIjklMNOpqrsTUVwxyz';

        const result = validateTelegramInitData(initData, wrongToken);
        expect(result).toBeNull();
    });
});


