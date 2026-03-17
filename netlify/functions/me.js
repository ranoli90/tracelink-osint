import 'dotenv/config';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { telegramAuthMiddleware } from '../../src/middleware/telegramAuth.js';

const app = express();

// Use singleton PrismaClient to prevent connection pool exhaustion
const globalForPrisma = global;
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV === 'production') globalForPrisma.prisma = prisma;

app.set('trust proxy', true);
app.set('prisma', prisma);

app.use(express.json());

// Apply auth middleware
app.use(telegramAuthMiddleware);

/**
 * GET / - Get current user info
 */
app.get('/', async (req, res) => {
    const telegramId = req.telegramId;

    try {
        const user = await prisma.telegramUser.findUnique({
            where: { telegramId },
            select: {
                telegramId: true,
                firstName: true,
                lastName: true,
                username: true,
                languageCode: true,
                isPremium: true,
                referralCount: true,
                createdAt: true,
                _count: {
                    select: {
                        links: true,
                        clickEvents: true,
                    },
                },
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            telegramId: user.telegramId.toString(),
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            languageCode: user.languageCode,
            isPremium: user.isPremium,
            referralCount: user.referralCount,
            createdAt: user.createdAt,
            totalLinks: user._count.links,
            totalClicks: user._count.clickEvents,
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user data' });
    }
});

/**
 * GET /stats - Get user stats
 */
app.get('/stats', async (req, res) => {
    const telegramId = req.telegramId;

    try {
        const user = await prisma.telegramUser.findUnique({
            where: { telegramId },
            include: {
                links: true,
                _count: {
                    select: { clickEvents: true },
                },
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const totalLinks = user.links.length;
        const totalClicks = user._count.clickEvents;
        const recentClicks = await prisma.clickEvent.count({
            where: {
                userId: telegramId,
                timestamp: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                },
            },
        });

        const uniqueIps = await prisma.clickEvent.groupBy({
            by: ['ipTruncated'],
            where: { userId: telegramId },
        });

        const countries = await prisma.clickEvent.groupBy({
            by: ['country'],
            where: { userId: telegramId, country: { not: null } },
        });

        const vpnCount = await prisma.clickEvent.count({
            where: { userId: telegramId, isVpn: true },
        });
        const proxyCount = await prisma.clickEvent.count({
            where: { userId: telegramId, isProxy: true },
        });
        const torCount = await prisma.clickEvent.count({
            where: { userId: telegramId, isTor: true },
        });
        const botCount = await prisma.clickEvent.count({
            where: { userId: telegramId, isBot: true },
        });

        res.json({
            totalLinks,
            totalClicks,
            recentClicks,
            avgClicksPerLink: totalLinks > 0 ? Math.round((totalClicks / totalLinks) * 10) / 10 : 0,
            uniqueIps: uniqueIps.length,
            countries: countries.length,
            security: {
                vpn: vpnCount,
                proxy: proxyCount,
                tor: torCount,
                bots: botCount,
            },
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

/**
 * GET /links - Get user links
 */
app.get('/links', async (req, res) => {
    const telegramId = req.telegramId;

    try {
        const links = await prisma.link.findMany({
            where: { userId: telegramId },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { clickEvents: true },
                },
            },
        });

        const baseUrl = process.env.BASE_URL || process.env.WEBAPP_URL || '';

        res.json(links.map(link => ({
            id: link.id,
            trackingId: link.trackingId,
            destinationUrl: link.destinationUrl,
            shortUrl: `${baseUrl}/click?id=${link.trackingId}`,
            clickCount: link._count.clickEvents,
            createdAt: link.createdAt,
        })));
    } catch (error) {
        console.error('Error fetching links:', error);
        res.status(500).json({ error: 'Failed to fetch links' });
    }
});

/**
 * POST /links - Create new link
 */
import { nanoid } from 'nanoid';

app.post('/links', async (req, res) => {
    const telegramId = req.telegramId;
    const { destinationUrl } = req.body;

    if (!destinationUrl) {
        return res.status(400).json({ error: 'destinationUrl is required' });
    }

    if (typeof destinationUrl !== 'string' || destinationUrl.length < 10 || destinationUrl.length > 2048) {
        return res.status(400).json({ error: 'destinationUrl must be at least 10 characters and no more than 2048 characters' });
    }

    try {
        new URL(destinationUrl);
    } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
    }

    if (!destinationUrl.startsWith('http://') && !destinationUrl.startsWith('https://')) {
        return res.status(400).json({ error: 'URL must start with http:// or https://' });
    }

    try {
        const trackingId = nanoid(10);

        const link = await prisma.link.create({
            data: {
                trackingId,
                destinationUrl,
                userId: telegramId,
            },
        });

        const baseUrl = process.env.BASE_URL || process.env.WEBAPP_URL || '';

        res.status(201).json({
            id: link.id,
            trackingId: link.trackingId,
            destinationUrl: link.destinationUrl,
            shortUrl: `${baseUrl}/click?id=${link.trackingId}`,
            createdAt: link.createdAt,
        });
    } catch (error) {
        console.error('Error creating link:', error);
        res.status(500).json({ error: 'Failed to create link' });
    }
});

// Export as serverless handler
export const handler = async (event, context) => {
    // Import and use the serverless wrapper
    const serverless = (await import('serverless-http')).default;
    return serverless(app)(event, context);
};
