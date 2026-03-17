import express from 'express';
import { nanoid } from 'nanoid';
import { telegramAuthMiddleware, requireAdmin } from '../middleware/telegramAuth.js';

const router = express.Router();

// Apply telegram auth middleware to all routes
router.use(telegramAuthMiddleware);

/**
 * GET /api/me
 * Get current user info
 */
router.get('/', async (req, res) => {
    const prisma = req.app.get('prisma');
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
 * GET /api/me/stats
 * Get user stats (mirrors /admin functionality)
 */
router.get('/stats', async (req, res) => {
    const prisma = req.app.get('prisma');
    const telegramId = req.telegramId;

    try {
        // Get user with links and clicks
        const user = await prisma.telegramUser.findUnique({
            where: { telegramId },
            include: {
                links: {
                    include: {
                        _count: {
                            select: { clickEvents: true },
                        },
                    },
                },
                _count: {
                    select: { clickEvents: true },
                },
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Calculate stats
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

        // Get unique IPs
        const uniqueIps = await prisma.clickEvent.groupBy({
            by: ['ipTruncated'],
            where: { userId: telegramId },
        });

        // Get countries
        const countries = await prisma.clickEvent.groupBy({
            by: ['country'],
            where: { userId: telegramId, country: { not: null } },
        });

        // Get VPN/Proxy stats
        const vpnCount = await prisma.clickEvent.count({
            where: { userId: telegramId, isVpn: true },
        });
        const proxyCount = await prisma.clickEvent.count({
            where: { userId: telegramId, isProxy: true },
        });
        const torCount = await prisma.clickEvent.count({
            where: { userId: telegramId, isTor: true },
        });

        // Get bot count
        const botCount = await prisma.clickEvent.count({
            where: { userId: telegramId, isBot: true },
        });

        // Get timeline (last 7 days)
        const timeline = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);

            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);

            const count = await prisma.clickEvent.count({
                where: {
                    userId: telegramId,
                    timestamp: {
                        gte: date,
                        lt: nextDate,
                    },
                },
            });

            timeline.push({
                date: date.toISOString().split('T')[0],
                clicks: count,
            });
        }

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
            timeline,
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

/**
 * GET /api/me/links
 * Get all links for current user
 */
router.get('/links', async (req, res) => {
    const prisma = req.app.get('prisma');
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

        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

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
 * POST /api/me/links
 * Create a new link for current user
 */
router.post('/links', async (req, res) => {
    const prisma = req.app.get('prisma');
    const telegramId = req.telegramId;
    const { destinationUrl, domain } = req.body;

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

        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

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

/**
 * DELETE /api/me/links/:trackingId
 * Delete a link for current user
 */
router.delete('/links/:trackingId', async (req, res) => {
    const prisma = req.app.get('prisma');
    const telegramId = req.telegramId;
    const { trackingId } = req.params;

    try {
        // Use atomic delete with ownership check in where clause
        await prisma.link.deleteMany({
            where: {
                trackingId,
                userId: telegramId,
            },
        });

        res.status(204).send();
    } catch (error) {
        console.error('Error deleting link:', error);
        res.status(500).json({ error: 'Failed to delete link' });
    }
});

/**
 * GET /api/me/links/:trackingId/analytics
 * Get analytics for a specific link
 */
router.get('/links/:trackingId/analytics', async (req, res) => {
    const prisma = req.app.get('prisma');
    const telegramId = req.telegramId;
    const { trackingId } = req.params;

    try {
        // Check ownership
        const link = await prisma.link.findFirst({
            where: {
                trackingId,
                userId: telegramId,
            },
        });

        if (!link) {
            return res.status(404).json({ error: 'Link not found or not owned by you' });
        }

        // Get click events
        const clickEvents = await prisma.clickEvent.findMany({
            where: { trackingId },
            orderBy: { timestamp: 'desc' },
            take: 100,
        });

        // Calculate stats
        const totalClicks = clickEvents.length;
        const uniqueIps = [...new Set(clickEvents.map(e => e.ipTruncated).filter(Boolean))];
        const countries = [...new Set(clickEvents.map(e => e.country).filter(Boolean))];

        const vpnCount = clickEvents.filter(e => e.isVpn).length;
        const proxyCount = clickEvents.filter(e => e.isProxy).length;
        const torCount = clickEvents.filter(e => e.isTor).length;
        const botCount = clickEvents.filter(e => e.isBot).length;
        const webrtcLeaks = clickEvents.filter(e => e.webrtcLeakDetected).length;

        // Get last click
        const lastClick = clickEvents.length > 0 ? clickEvents[0].timestamp : null;

        // Get device types
        const deviceTypes = clickEvents.reduce((acc, e) => {
            const type = e.deviceType || 'unknown';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});

        // Get browsers
        const browsers = clickEvents.reduce((acc, e) => {
            const browser = e.browser || 'unknown';
            acc[browser] = (acc[browser] || 0) + 1;
            return acc;
        }, {});

        res.json({
            trackingId: link.trackingId,
            destinationUrl: link.destinationUrl,
            totalClicks,
            uniqueIps: uniqueIps.length,
            countries: countries.length,
            security: {
                vpn: vpnCount,
                proxy: proxyCount,
                tor: torCount,
                bots: botCount,
                webrtcLeaks,
            },
            lastClick,
            deviceTypes,
            browsers,
            clicks: clickEvents.map(e => ({
                id: e.id,
                timestamp: e.timestamp,
                country: e.country,
                city: e.city,
                deviceType: e.deviceType,
                browser: e.browser,
                os: e.os,
                ipTruncated: e.ipTruncated,
                isVpn: e.isVpn,
                isProxy: e.isProxy,
                isTor: e.isTor,
                isBot: e.isBot,
            })),
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

/**
 * GET /api/me/events
 * Get recent click events for current user
 */
router.get('/events', async (req, res) => {
    const prisma = req.app.get('prisma');
    const telegramId = req.telegramId;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;

    try {
        const events = await prisma.clickEvent.findMany({
            where: { userId: telegramId },
            orderBy: { timestamp: 'desc' },
            take: limit,
            skip: offset,
            select: {
                id: true,
                timestamp: true,
                trackingId: true,
                country: true,
                city: true,
                deviceType: true,
                browser: true,
                os: true,
                ipTruncated: true,
                isVpn: true,
                isProxy: true,
                isBot: true,
            },
        });

        const total = await prisma.clickEvent.count({
            where: { userId: telegramId },
        });

        res.json({
            events,
            total,
            limit,
            offset,
        });
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

/**
 * GET /api/me/notifications
 * Get notifications for user (placeholder for future implementation)
 */
router.get('/notifications', async (req, res) => {
    // For now, return empty notifications
    // This can be extended to store and return notifications
    res.json({ notifications: [] });
});

export default router;
