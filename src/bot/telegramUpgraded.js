/**
 * Upgraded Telegram Bot for TraceLink OSINT
 * Provides scan commands and enhanced functionality
 * 
 * @module telegramUpgraded
 */

import { Telegraf, Markup } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

/**
 * Validate Telegram initData
 */
export function validateInitData(initData, botToken) {
    try {
        const params = new URLSearchParams(initData);
        const hash = params.get('hash');
        params.delete('hash');

        const dataCheckString = Array.from(params.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        const secretKey = crypto
            .createHash('sha256')
            .update(botToken)
            .digest();

        const expectedHash = crypto
            .createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');

        const hashBuffer = Buffer.from(hash, 'hex');
        const expectedBuffer = Buffer.from(expectedHash, 'hex');

        if (hashBuffer.length !== expectedBuffer.length ||
            !crypto.timingSafeEqual(hashBuffer, expectedBuffer)) {
            return null;
        }

        const authDate = parseInt(params.get('auth_date'), 10);
        const now = Math.floor(Date.now() / 1000);
        if (now - authDate > 300) {
            return null;
        }

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
 * Check if user is admin
 */
export function isAdmin(telegramId) {
    const adminIds = process.env.ADMIN_TELEGRAM_IDS || '';
    if (!adminIds || adminIds.trim() === '') return false;

    const adminIdList = adminIds.split(',').map(id => BigInt(id.trim())).filter(id => !isNaN(id));
    return adminIdList.includes(telegramId);
}

/**
 * Get Web App URL
 */
function getWebAppUrl() {
    return process.env.WEBAPP_URL || process.env.BASE_URL || 'http://localhost:3000';
}

/**
 * Get API URL
 */
function getApiUrl() {
    return process.env.API_URL || getWebAppUrl();
}

/**
 * Create upgraded bot
 */
export function createUpgradedBot() {
    const botToken = process.env.BOT_TOKEN;

    if (!botToken) {
        console.warn('BOT_TOKEN not set - Telegram bot will not be initialized');
        return null;
    }

    const bot = new Telegraf(botToken);

    // ===== COMMAND HANDLERS =====

    // /start command
    bot.start(async (ctx) => {
        try {
            const user = ctx.message.from;
            const referrerId = ctx.startPayload ? BigInt(ctx.startPayload) : null;

            await upsertTelegramUser(user, referrerId);

            const webAppUrl = getWebAppUrl();

            await ctx.reply(
                `👋 Welcome to TraceLink OSINT!\n\n` +
                `Your advanced threat intelligence platform.\n\n` +
                `Use the button below to access your dashboard or use commands below to run scans.`,
                Markup.inlineKeyboard([
                    [Markup.button.webApp('📊 Open Dashboard', webAppUrl)],
                    [Markup.button.callback('🔍 Quick Scan', 'quick_scan')]
                ])
            );
        } catch (error) {
            console.error('Error in /start command:', error);
            ctx.reply('Sorry, something went wrong. Please try again later.');
        }
    });

    // /help command
    bot.help((ctx) => {
        const helpText = `
🔍 *TraceLink OSINT Commands*

*Scan Commands:*
/scan \<target\> - Run quick OSINT scan
/scanfull \<target\> - Run comprehensive scan
/email \<email\> - Check email for breaches
/phone \<phone\> - Lookup phone number
/domain \<domain\> - Domain research
/username \<name\> - Social media search
/darkweb \<query\> - Search dark web

*Dark Web:*
/torcheck \<ip\> - Check Tor exit nodes
/threat \<indicator\> - Check threat feeds

*AI Analysis:*
/analyze \<scan_id\> - AI summary of scan
/insights - AI-powered insights

*Tools:*
/tools - List available OSINT tools
/status - Bot and API status
/history - Recent scans

*Admin:*
/admin - Admin dashboard
/stats - View statistics

*Navigation:*
/dashboard - Open web dashboard
        `;
        ctx.reply(helpText, { parse_mode: 'Markdown' });
    });

    // /scan command - Quick OSINT scan
    bot.command('scan', async (ctx) => {
        try {
            const args = ctx.message.text.split(' ').slice(1);
            const target = args.join(' ');

            if (!target) {
                return ctx.reply('Usage: /scan <target>\nExample: /scan user@email.com');
            }

            await ctx.reply(`🔍 Starting quick scan on: *${target}*`, { parse_mode: 'Markdown' });

            const apiUrl = `${getApiUrl()}/api/osint-upgraded/scan`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-ID': String(ctx.message.from.id)
                },
                body: JSON.stringify({ target, quick: true })
            });

            const result = await response.json();

            if (result.scanId) {
                await ctx.reply(
                    `✅ Scan Started!\n\n` +
                    `📋 Scan ID: \`${result.scanId}\`\n` +
                    `🎯 Target: ${result.target}\n` +
                    `📊 Type: ${result.targetType}\n\n` +
                    `Use /analyze ${result.scanId} to get AI summary`,
                    { parse_mode: 'Markdown' }
                );
            } else {
                await ctx.reply(`❌ Scan failed: ${result.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Scan error:', error);
            ctx.reply('Error running scan. Please try again.');
        }
    });

    // /scanfull command - Full OSINT scan
    bot.command('scanfull', async (ctx) => {
        try {
            const args = ctx.message.text.split(' ').slice(1);
            const target = args.join(' ');

            if (!target) {
                return ctx.reply('Usage: /scanfull <target>\nExample: /scanfull example.com');
            }

            await ctx.reply(`🔍 Starting comprehensive scan on: *${target}*`, { parse_mode: 'Markdown' });

            const apiUrl = `${getApiUrl()}/api/osint-upgraded/scan`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-ID': String(ctx.message.from.id)
                },
                body: JSON.stringify({ target, comprehensive: true })
            });

            const result = await response.json();

            if (result.scanId) {
                await ctx.reply(
                    `🚀 Comprehensive Scan Started!\n\n` +
                    `📋 Scan ID: \`${result.scanId}\`\n` +
                    `🎯 Target: ${result.target}\n` +
                    `📊 Type: ${result.targetType}\n\n` +
                    `This may take a while. Use /analyze ${result.scanId} for AI summary`,
                    { parse_mode: 'Markdown' }
                );
            } else {
                await ctx.reply(`❌ Scan failed: ${result.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Scan full error:', error);
            ctx.reply('Error running scan. Please try again.');
        }
    });

    // /email command
    bot.command('email', async (ctx) => {
        try {
            const args = ctx.message.text.split(' ').slice(1);
            const email = args.join(' ');

            if (!email || !email.includes('@')) {
                return ctx.reply('Usage: /email <email>\nExample: /email user@example.com');
            }

            await ctx.reply(`📧 Checking email: *${email}*`, { parse_mode: 'Markdown' });

            const apiUrl = `${getApiUrl()}/api/osint-upgraded/email`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-ID': String(ctx.message.from.id)
                },
                body: JSON.stringify({ email })
            });

            const result = await response.json();

            let message = `📧 *Email Report*\n\n`;
            message += `Email: ${email}\n`;
            message += `Found: ${result.found ? '✅ Yes' : '❌ No'}\n`;
            if (result.count) {
                message += `Sites Found: ${result.count}\n`;
            }
            if (result.isBreached) {
                message += `\n⚠️ *Breached! Check password!*`;
            }

            await ctx.reply(message, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error('Email check error:', error);
            ctx.reply('Error checking email. Please try again.');
        }
    });

    // /domain command
    bot.command('domain', async (ctx) => {
        try {
            const args = ctx.message.text.split(' ').slice(1);
            const domain = args.join(' ');

            if (!domain) {
                return ctx.reply('Usage: /domain <domain>\nExample: /domain example.com');
            }

            await ctx.reply(`🌐 Researching domain: *${domain}*`, { parse_mode: 'Markdown' });

            const apiUrl = `${getApiUrl()}/api/osint-upgraded/domain`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-ID': String(ctx.message.from.id)
                },
                body: JSON.stringify({ domain })
            });

            const result = await response.json();

            let message = `🌐 *Domain Report*\n\n`;
            message += `Domain: ${domain}\n`;
            if (result.subdomains) {
                message += `Subdomains: ${result.subdomains}\n`;
            }
            if (result.whois) {
                message += `Registrar: ${result.whois.registrar || 'N/A'}\n`;
            }

            await ctx.reply(message, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error('Domain check error:', error);
            ctx.reply('Error researching domain. Please try again.');
        }
    });

    // /username command
    bot.command('username', async (ctx) => {
        try {
            const args = ctx.message.text.split(' ').slice(1);
            const username = args.join(' ');

            if (!username) {
                return ctx.reply('Usage: /username <username>\nExample: /username johndoe');
            }

            await ctx.reply(`👤 Searching username: *${username}*`, { parse_mode: 'Markdown' });

            const apiUrl = `${getApiUrl()}/api/osint-upgraded/username`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-ID': String(ctx.message.from.id)
                },
                body: JSON.stringify({ username })
            });

            const result = await response.json();

            let message = `👤 *Username Report*\n\n`;
            message += `Username: ${username}\n`;
            message += `Found: ${result.found ? '✅ Yes' : '❌ No'}\n`;
            if (result.count) {
                message += `Sites Found: ${result.count}\n`;
            }

            await ctx.reply(message, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error('Username search error:', error);
            ctx.reply('Error searching username. Please try again.');
        }
    });

    // /phone command
    bot.command('phone', async (ctx) => {
        try {
            const args = ctx.message.text.split(' ').slice(1);
            const phone = args.join(' ');

            if (!phone) {
                return ctx.reply('Usage: /phone <number>\nExample: /phone +1234567890');
            }

            await ctx.reply(`📱 Looking up phone: *${phone}*`, { parse_mode: 'Markdown' });

            const apiUrl = `${getApiUrl()}/api/osint-upgraded/phone`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-ID': String(ctx.message.from.id)
                },
                body: JSON.stringify({ phone })
            });

            const result = await response.json();

            let message = `📱 *Phone Report*\n\n`;
            message += `Phone: ${phone}\n`;
            message += `Valid: ${result.valid ? '✅ Yes' : '❌ No'}\n`;
            if (result.carrier) message += `Carrier: ${result.carrier}\n`;
            if (result.country) message += `Country: ${result.country}\n`;
            if (result.region) message += `Region: ${result.region}\n`;

            await ctx.reply(message, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error('Phone lookup error:', error);
            ctx.reply('Error looking up phone. Please try again.');
        }
    });

    // /darkweb command
    bot.command('darkweb', async (ctx) => {
        try {
            const args = ctx.message.text.split(' ').slice(1);
            const query = args.join(' ');

            if (!query) {
                return ctx.reply('Usage: /darkweb <query>\nExample: /darkweb stolen credentials');
            }

            await ctx.reply(`🌑 Searching dark web: *${query}*`, { parse_mode: 'Markdown' });

            const apiUrl = `${getApiUrl()}/api/osint-upgraded/darkweb/search`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-ID': String(ctx.message.from.id)
                },
                body: JSON.stringify({ query })
            });

            const result = await response.json();

            let message = `🌑 *Dark Web Search*\n\n`;
            message += `Query: ${query}\n`;
            message += `Results: ${result.totalResults || 0}\n`;

            if (result.engines && result.engines.length > 0) {
                result.engines.forEach(engine => {
                    if (engine.count > 0) {
                        message += `\n${engine.name}: ${engine.count} results`;
                    }
                });
            }

            await ctx.reply(message, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error('Dark web search error:', error);
            ctx.reply('Error searching dark web. Please try again.');
        }
    });

    // /threat command
    bot.command('threat', async (ctx) => {
        try {
            const args = ctx.message.text.split(' ').slice(1);
            const indicator = args.join(' ');

            if (!indicator) {
                return ctx.reply('Usage: /threat <indicator>\nExample: /threat 8.8.8.8');
            }

            await ctx.reply(`⚠️ Checking threat feeds: *${indicator}*`, { parse_mode: 'Markdown' });

            const apiUrl = `${getApiUrl()}/api/osint-upgraded/threat`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-ID': String(ctx.message.from.id)
                },
                body: JSON.stringify({ indicator })
            });

            const result = await response.json();

            let message = `⚠️ *Threat Intelligence*\n\n`;
            message += `Indicator: ${indicator}\n`;
            message += `Malicious: ${result.maliciousCount > 0 ? '❌ YES' : '✅ No'}\n`;
            message += `Sources Checked: ${result.feeds?.length || 0}\n`;

            await ctx.reply(message, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error('Threat check error:', error);
            ctx.reply('Error checking threat feeds. Please try again.');
        }
    });

    // /analyze command - AI analysis
    bot.command('analyze', async (ctx) => {
        try {
            const args = ctx.message.text.split(' ').slice(1);
            const scanId = args.join(' ');

            if (!scanId) {
                return ctx.reply('Usage: /analyze <scan_id>\nExample: /analyze abc123');
            }

            await ctx.reply(`🤖 Running AI analysis on scan *${scanId}*...`, { parse_mode: 'Markdown' });

            const apiUrl = `${getApiUrl()}/api/osint-upgraded/analyze/${scanId}`;
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'X-Telegram-ID': String(ctx.message.from.id)
                }
            });

            const result = await response.json();

            if (result.summary) {
                await ctx.reply(
                    `🤖 *AI Analysis*\n\n${result.summary}`,
                    { parse_mode: 'Markdown' }
                );
            } else {
                await ctx.reply(`Could not analyze scan: ${result.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Analyze error:', error);
            ctx.reply('Error running analysis. Please try again.');
        }
    });

    // /tools command
    bot.command('tools', async (ctx) => {
        const message = `
🛠 *Available OSINT Tools*

*Username Search:*
• Maigret - Deep username search
• Sherlock - Social media lookup

*Email OSINT:*
• Holehe - Email breach check
• Hunter - Email verifier
• EmailRep - Reputation check

*Phone OSINT:*
• PhoneInfoga - Phone number lookup

*Domain Research:*
• SpiderFoot - Full OSINT
• Amass - Subdomain enumeration
• Subfinder - Subdomain finder

*Dark Web:*
• DarkSearch - Dark web search
• Threat feeds - Intel checking

*AI Features:*
• Summarization
• Threat analysis
• Entity extraction
        `;
        ctx.reply(message, { parse_mode: 'Markdown' });
    });

    // /status command
    bot.command('status', async (ctx) => {
        const webAppUrl = getWebAppUrl();
        const apiUrl = getApiUrl();

        let apiStatus = '❌ Offline';
        try {
            const response = await fetch(`${apiUrl}/api/osint-upgraded/status`);
            if (response.ok) apiStatus = '✅ Online';
        } catch (e) {
            apiStatus = '❌ Offline';
        }

        const message = `
📊 *TraceLink Status*

API: ${apiStatus}
Web: ${webAppUrl}
        `;
        ctx.reply(message, { parse_mode: 'Markdown' });
    });

    // /history command
    bot.command('history', async (ctx) => {
        const telegramId = BigInt(ctx.message.from.id);

        try {
            const scans = await prisma.osintScan.findMany({
                where: { userId: telegramId },
                orderBy: { createdAt: 'desc' },
                take: 10
            });

            if (scans.length === 0) {
                return ctx.reply('No scan history found.');
            }

            let message = `📜 *Recent Scans*\n\n`;
            scans.forEach((scan, i) => {
                message += `${i + 1}. \`${scan.scanId}\` - ${scan.target}\n`;
            });

            ctx.reply(message, { parse_mode: 'Markdown' });
        } catch (error) {
            ctx.reply('Error fetching history.');
        }
    });

    // /dashboard command
    bot.command('dashboard', async (ctx) => {
        const webAppUrl = getWebAppUrl();
        await ctx.reply(
            '📊 Open your TraceLink Dashboard',
            Markup.inlineKeyboard([
                [Markup.button.webApp('Dashboard', webAppUrl)]
            ])
        );
    });

    // /admin command - Admin only
    bot.command('admin', async (ctx) => {
        const telegramId = BigInt(ctx.message.from.id);

        if (!isAdmin(telegramId)) {
            return ctx.reply('❌ You are not authorized to use this command.');
        }

        try {
            const userRecord = await prisma.telegramUser.findUnique({
                where: { telegramId },
                include: {
                    _count: { select: { links: true, clickEvents: true } }
                }
            });

            const recentScans = await prisma.osintScan.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' }
            });

            let message = `⚙️ *Admin Dashboard*\n\n`;
            message += `Your Stats:\n`;
            message += `Links: ${userRecord?._count.links || 0}\n`;
            message += `Clicks: ${userRecord?._count.clickEvents || 0}\n`;
            message += `\nRecent Scans: ${recentScans.length}\n`;

            await ctx.reply(message, { parse_mode: 'Markdown' });
        } catch (error) {
            ctx.reply('Error loading admin data.');
        }
    });

    // Callback query handlers
    bot.action('quick_scan', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.reply('Please use /scan <target> to start a quick scan');
    });

    // Error handler
    bot.catch((err, ctx) => {
        console.error('Bot error:', err);
        ctx.reply('An error occurred. Please try again later.');
    });

    return bot;
}

/**
 * Upsert Telegram user
 */
async function upsertTelegramUser(userData, referrerId = null) {
    const telegramId = BigInt(userData.id);

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
 * Start bot in webhook mode
 */
export async function startBotWebhook(webhookUrl) {
    const botToken = process.env.BOT_TOKEN;

    if (!botToken || !webhookUrl) {
        console.warn('BOT_TOKEN or webhook URL not set');
        return null;
    }

    const bot = createUpgradedBot();
    if (!bot) return null;

    try {
        await bot.telegram.setWebhook(`${webhookUrl}/bot/webhook`);
        console.log(`Upgraded bot webhook set to ${webhookUrl}/bot/webhook`);
        return bot;
    } catch (error) {
        console.error('Error setting webhook:', error);
        return null;
    }
}

/**
 * Start bot in long-polling mode
 */
export async function startBotLongPolling() {
    const bot = createUpgradedBot();
    if (!bot) return null;

    try {
        await bot.launch();
        console.log('Upgraded bot started in long-polling mode');
        return bot;
    } catch (error) {
        console.error('Error starting bot:', error);
        return null;
    }
}

export default {
    createUpgradedBot,
    validateInitData,
    isAdmin,
    startBotWebhook,
    startBotLongPolling
};
