import { Telegraf, Markup } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * Validate Telegram initData using HMAC-SHA256
 * @param {string} initData - The initData string from Telegram Web App
 * @param {string} botToken - The bot token
 * @returns {object|null} - Parsed data if valid, null if invalid
 */
export function validateInitData(initData, botToken) {
    try {
        const params = new URLSearchParams(initData);
        const hash = params.get('hash');
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
        if (now - authDate > 300) {
            return null;
        }

        // Parse user data
        const user = JSON.parse(params.get('user') || '{}');

        return {
            ...Object.fromEntries(params),
            user,
            telegramId: user.id ? BigInt(user.id) : null,
        };
    } catch (error) {
        console.error('initData validation error:', error.message);
        return null;
    }
}

/**
 * Generate Web App button URL
 * @returns {string} - The Web App URL
 */
function getWebAppUrl() {
    return process.env.WEBAPP_URL || process.env.BASE_URL || 'http://localhost:3000';
}

/**
 * Create or update a Telegram user in the database
 * @param {object} userData - User data from Telegram
 * @param {BigInt} referrerId - Optional referrer Telegram ID
 * @returns {object} - The created or updated user
 */
export async function upsertTelegramUser(userData, referrerId = null) {
    const telegramId = BigInt(userData.id);

    // Check if user exists
    const existingUser = await prisma.telegramUser.findUnique({
        where: { telegramId },
    });

    // Handle referral
    if (referrerId && existingUser && !existingUser.referrerId) {
        await prisma.telegramUser.update({
            where: { telegramId },
            data: { referrerId },
        });

        // Increment referrer's referral count
        await prisma.telegramUser.update({
            where: { telegramId: referrerId },
            data: { referralCount: { increment: 1 } },
        });
    }

    // Upsert user
    const user = await prisma.telegramUser.upsert({
        where: { telegramId },
        create: {
            telegramId,
            firstName: userData.first_name,
            lastName: userData.last_name,
            username: userData.username,
            languageCode: userData.language_code,
            isPremium: userData.is_premium || false,
            isBot: userData.is_bot || false,
            referrerId,
        },
        update: {
            firstName: userData.first_name,
            lastName: userData.last_name,
            username: userData.username,
            languageCode: userData.language_code,
            isPremium: userData.is_premium || false,
        },
    });

    return user;
}

/**
 * Check if a Telegram user is an admin
 * @param {BigInt} telegramId - The user's Telegram ID
 * @returns {boolean} - True if user is an admin
 */
export function isAdmin(telegramId) {
    const adminIds = process.env.ADMIN_TELEGRAM_IDS || '';
    if (!adminIds || adminIds.trim() === '') return false;

    const adminIdList = adminIds.split(',').map(id => BigInt(id.trim())).filter(id => !isNaN(id));
    return adminIdList.includes(telegramId);
}

/**
 * Get admin IDs as BigInt array
 * @returns {BigInt[]} - Array of admin IDs
 */
export function getAdminIds() {
    const adminIds = process.env.ADMIN_TELEGRAM_IDS || '';
    if (!adminIds || adminIds.trim() === '') return [];
    return adminIds.split(',').map(id => BigInt(id.trim())).filter(id => !isNaN(id));
}

/**
 * Create and configure the Telegram bot
 * @returns {Telegraf} - Configured bot instance
 */
export function createBot() {
    const botToken = process.env.BOT_TOKEN;

    if (!botToken) {
        console.warn('BOT_TOKEN not set - Telegram bot will not be initialized');
        return null;
    }

    const bot = new Telegraf(botToken);

    // /start command handler
    bot.start(async (ctx) => {
        try {
            const user = ctx.message.from;
            const referrerId = ctx.startPayload ? BigInt(ctx.startPayload) : null;

            // Upsert user in database
            await upsertTelegramUser(user, referrerId);

            const webAppUrl = getWebAppUrl();

            // Send welcome message with Web App button
            await ctx.reply(
                'Welcome to TraceLink! Click the button below to access your personalized dashboard.',
                Markup.inlineKeyboard([
                    [Markup.button.webApp('Open Dashboard', webAppUrl)]
                ])
            );
        } catch (error) {
            console.error('Error in /start command:', error);
            ctx.reply('Sorry, something went wrong. Please try again later.');
        }
    });

    // /admin command handler - only for admins
    bot.command('admin', async (ctx) => {
        try {
            const user = ctx.message.from;
            const telegramId = BigInt(user.id);

            // Check if user is admin
            if (!isAdmin(telegramId)) {
                return ctx.reply('You are not authorized to use this command.');
            }

            // Get user stats
            const userRecord = await prisma.telegramUser.findUnique({
                where: { telegramId },
                include: {
                    _count: {
                        select: { links: true, clickEvents: true },
                    },
                },
            });

            // Get recent links
            const recentLinks = await prisma.link.findMany({
                where: { userId: telegramId },
                orderBy: { createdAt: 'desc' },
                take: 5,
            });

            // Build admin response
            let response = `Admin Dashboard for @${user.username || 'Unknown'}\n\n`;
            response += `Total Links: ${userRecord?._count.links || 0}\n`;
            response += `Total Clicks: ${userRecord?._count.clickEvents || 0}\n`;
            response += `Referrals: ${userRecord?.referralCount || 0}\n\n`;

            if (recentLinks.length > 0) {
                response += 'Recent Links:\n';
                recentLinks.forEach(link => {
                    response += `- ${link.trackingId}: ${link.destinationUrl.substring(0, 30)}...\n`;
                });
            } else {
                response += 'No links created yet.';
            }

            const webAppUrl = getWebAppUrl();

            // Send admin stats with Web App button
            await ctx.reply(response, Markup.inlineKeyboard([
                [Markup.button.webApp('Open Full Dashboard', webAppUrl)]
            ]));
        } catch (error) {
            console.error('Error in /admin command:', error);
            ctx.reply('Sorry, something went wrong. Please try again later.');
        }
    });

    // OSINT Commands - only for admins
    bot.command('scan', async (ctx) => {
        try {
            const user = ctx.message.from;
            const telegramId = BigInt(user.id);

            // Check if user is admin
            if (!isAdmin(telegramId)) {
                return ctx.reply('You are not authorized to use this command.');
            }

            const args = ctx.message.text.split(' ').slice(1);
            if (args.length === 0) {
                return ctx.reply('Usage: /scan <target> [tool]\nExample: /scan example.com spiderfoot');
            }

            const target = args[0];
            const tool = args[1] || 'spiderfoot';

            // Send scanning message
            await ctx.reply(`🔍 Starting ${tool} scan for: ${target}\nThis may take a few minutes...`);

            // Make API call to OSINT endpoint
            const osintEndpoint = `http://localhost:3000/api/osint/${tool}`;
            const response = await fetch(osintEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.BOT_TOKEN}`
                },
                body: JSON.stringify({ 
                    target: tool === 'spiderfoot' ? target : undefined,
                    username: ['maigret', 'sherlock'].includes(tool) ? target : undefined,
                    email: tool === 'holehe' ? target : undefined,
                    phoneNumber: tool === 'phoneinfoga' ? target : undefined,
                    scanType: tool === 'spiderfoot' ? 'all' : undefined
                })
            });

            const result = await response.json();

            if (result.error) {
                await ctx.reply(`❌ Scan failed: ${result.error}`);
            } else {
                await ctx.reply(`✅ Scan completed!\n\nResults: ${JSON.stringify(result, null, 2)}`);
            }

        } catch (error) {
            console.error('Error in /scan command:', error);
            ctx.reply('❌ Scan failed. Please try again later.');
        }
    });

    bot.command('osint', async (ctx) => {
        try {
            const user = ctx.message.from;
            const telegramId = BigInt(user.id);

            // Check if user is admin
            if (!isAdmin(telegramId)) {
                return ctx.reply('You are not authorized to use this command.');
            }

            const webAppUrl = getWebAppUrl();

            await ctx.reply(
                '🔍 OSINT Tools\n\n' +
                'Available tools:\n' +
                '• SpiderFoot - Comprehensive OSINT\n' +
                '• Maigret - Username search\n' +
                '• Sherlock - Social media finder\n' +
                '• Holehe - Email verification\n' +
                '• PhoneInfoga - Phone lookup\n\n' +
                'Commands:\n' +
                '/scan <target> <tool> - Run OSINT scan\n' +
                '/spiderfoot <target> - SpiderFoot scan\n' +
                '/maigret <username> - Username search\n' +
                '/sherlock <username> - Social media search\n' +
                '/holehe <email> - Email check\n' +
                '/phoneinfoga <phone> - Phone lookup\n\n' +
                'Or use the Web App for a better experience:',
                Markup.inlineKeyboard([
                    [Markup.button.webApp('🔍 Open OSINT Tools', webAppUrl)]
                ])
            );

        } catch (error) {
            console.error('Error in /osint command:', error);
            ctx.reply('Sorry, something went wrong. Please try again later.');
        }
    });

    // Individual OSINT tool commands
    bot.command('spiderfoot', async (ctx) => {
        try {
            const user = ctx.message.from;
            const telegramId = BigInt(user.id);

            if (!isAdmin(telegramId)) {
                return ctx.reply('You are not authorized to use this command.');
            }

            const target = ctx.message.text.split(' ').slice(1)[0];
            if (!target) {
                return ctx.reply('Usage: /spiderfoot <domain|ip|email>');
            }

            await ctx.reply(`🕸️ Starting SpiderFoot scan for: ${target}`);
            
            // Call OSINT API
            const response = await fetch('http://localhost:3000/api/osint/spiderfoot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.BOT_TOKEN}`
                },
                body: JSON.stringify({ target, scanType: 'all' })
            });

            const result = await response.json();
            
            if (result.error) {
                await ctx.reply(`❌ Scan failed: ${result.error}`);
            } else {
                await ctx.reply(`✅ SpiderFoot scan completed!\nScan ID: ${result.scanId}`);
            }

        } catch (error) {
            console.error('Error in /spiderfoot command:', error);
            ctx.reply('❌ Scan failed. Please try again later.');
        }
    });

    bot.command('maigret', async (ctx) => {
        try {
            const user = ctx.message.from;
            const telegramId = BigInt(user.id);

            if (!isAdmin(telegramId)) {
                return ctx.reply('You are not authorized to use this command.');
            }

            const username = ctx.message.text.split(' ').slice(1)[0];
            if (!username) {
                return ctx.reply('Usage: /maigret <username>');
            }

            await ctx.reply(`👤 Starting Maigret search for: ${username}`);
            
            const response = await fetch('http://localhost:3000/api/osint/maigret', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.BOT_TOKEN}`
                },
                body: JSON.stringify({ username })
            });

            const result = await response.json();
            
            if (result.error) {
                await ctx.reply(`❌ Search failed: ${result.error}`);
            } else {
                await ctx.reply(`✅ Maigret search completed!\nFound: ${result.found ? 'Yes' : 'No'}\nResults: ${result.count}`);
            }

        } catch (error) {
            console.error('Error in /maigret command:', error);
            ctx.reply('❌ Search failed. Please try again later.');
        }
    });

    bot.command('sherlock', async (ctx) => {
        try {
            const user = ctx.message.from;
            const telegramId = BigInt(user.id);

            if (!isAdmin(telegramId)) {
                return ctx.reply('You are not authorized to use this command.');
            }

            const username = ctx.message.text.split(' ').slice(1)[0];
            if (!username) {
                return ctx.reply('Usage: /sherlock <username>');
            }

            await ctx.reply(`🔎 Starting Sherlock search for: ${username}`);
            
            const response = await fetch('http://localhost:3000/api/osint/sherlock', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.BOT_TOKEN}`
                },
                body: JSON.stringify({ username })
            });

            const result = await response.json();
            
            if (result.error) {
                await ctx.reply(`❌ Search failed: ${result.error}`);
            } else {
                await ctx.reply(`✅ Sherlock search completed!\nFound: ${result.found ? 'Yes' : 'No'}\nResults: ${result.count}`);
            }

        } catch (error) {
            console.error('Error in /sherlock command:', error);
            ctx.reply('❌ Search failed. Please try again later.');
        }
    });

    bot.command('holehe', async (ctx) => {
        try {
            const user = ctx.message.from;
            const telegramId = BigInt(user.id);

            if (!isAdmin(telegramId)) {
                return ctx.reply('You are not authorized to use this command.');
            }

            const email = ctx.message.text.split(' ').slice(1)[0];
            if (!email) {
                return ctx.reply('Usage: /holehe <email>');
            }

            await ctx.reply(`📧 Starting Holehe check for: ${email}`);
            
            const response = await fetch('http://localhost:3000/api/osint/holehe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.BOT_TOKEN}`
                },
                body: JSON.stringify({ email })
            });

            const result = await response.json();
            
            if (result.error) {
                await ctx.reply(`❌ Check failed: ${result.error}`);
            } else {
                await ctx.reply(`✅ Holehe check completed!\nFound: ${result.found ? 'Yes' : 'No'}\nResults: ${result.count}`);
            }

        } catch (error) {
            console.error('Error in /holehe command:', error);
            ctx.reply('❌ Check failed. Please try again later.');
        }
    });

    bot.command('phoneinfoga', async (ctx) => {
        try {
            const user = ctx.message.from;
            const telegramId = BigInt(user.id);

            if (!isAdmin(telegramId)) {
                return ctx.reply('You are not authorized to use this command.');
            }

            const phone = ctx.message.text.split(' ').slice(1)[0];
            if (!phone) {
                return ctx.reply('Usage: /phoneinfoga <phone>');
            }

            await ctx.reply(`📱 Starting PhoneInfoga lookup for: ${phone}`);
            
            const response = await fetch('http://localhost:3000/api/osint/phoneinfoga', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.BOT_TOKEN}`
                },
                body: JSON.stringify({ phoneNumber: phone })
            });

            const result = await response.json();
            
            if (result.error) {
                await ctx.reply(`❌ Lookup failed: ${result.error}`);
            } else {
                await ctx.reply(`✅ PhoneInfoga lookup completed!\nValid: ${result.found ? 'Yes' : 'No'}\nResults: ${JSON.stringify(result.results, null, 2)}`);
            }

        } catch (error) {
            console.error('Error in /phoneinfoga command:', error);
            ctx.reply('❌ Lookup failed. Please try again later.');
        }
    });

    // Help command
    bot.help((ctx) => {
        ctx.reply(
            'TraceLink Bot Commands:\n\n' +
            '/start - Start the bot and access your dashboard\n' +
            '/admin - View admin stats (admins only)\n' +
            '/scan <target> [tool] - Run OSINT scan (admins only)\n' +
            '/osint - Show OSINT tools menu (admins only)\n' +
            '/spiderfoot <target> - SpiderFoot scan (admins only)\n' +
            '/maigret <username> - Username search (admins only)\n' +
            '/sherlock <username> - Social media search (admins only)\n' +
            '/holehe <email> - Email verification (admins only)\n' +
            '/phoneinfoga <phone> - Phone lookup (admins only)\n' +
            '/help - Show this help message'
        );
    });

    // Error handler
    bot.catch((err, ctx) => {
        console.error('Bot error:', err);
        ctx.reply('An error occurred. Please try again later.');
    });

    return bot;
}

/**
 * Start the bot in webhook mode
 * @param {string} webhookUrl - The webhook URL
 */
export async function startBotWebhook(webhookUrl) {
    const botToken = process.env.BOT_TOKEN;

    if (!botToken || !webhookUrl) {
        console.warn('BOT_TOKEN or webhook URL not set - cannot start bot in webhook mode');
        return null;
    }

    const bot = createBot();
    if (!bot) return null;

    try {
        await bot.telegram.setWebhook(`${webhookUrl}/bot/webhook`);
        console.log(`Bot webhook set to ${webhookUrl}/bot/webhook`);
        return bot;
    } catch (error) {
        console.error('Error setting webhook:', error);
        return null;
    }
}

/**
 * Start the bot in long-polling mode (for local development)
 */
export async function startBotLongPolling() {
    const bot = createBot();
    if (!bot) return null;

    try {
        await bot.launch();
        console.log('Bot started in long-polling mode');
        return bot;
    } catch (error) {
        console.error('Error starting bot:', error);
        return null;
    }
}

export default { createBot, validateInitData, upsertTelegramUser, isAdmin, startBotWebhook, startBotLongPolling };
