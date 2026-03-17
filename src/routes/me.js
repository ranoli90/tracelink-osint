import express from 'express';
import { nanoid } from 'nanoid';
import { telegramAuthMiddleware, requireAdmin } from '../middleware/telegramAuth.js';
import { z } from 'zod';

const router = express.Router();

// Input validation schemas
const urlSchema = z.string()
    .url()
    .min(10)
    .max(2048)
    .refine(url => {
        const parsed = new URL(url);
        // Reject localhost and private IPs
        const hostname = parsed.hostname.toLowerCase();
        const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
        if (blockedHosts.includes(hostname)) {
            return false;
        }
        // Check for private IP ranges
        const ip = parsed.hostname;
        if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) {
            return false;
        }
        return true;
    }, 'Cannot use localhost or private IP addresses');

const domainSchema = z.string()
    .min(4)
    .max(255)
    .regex(/^[a-zA-Z0-9.-]+$/, 'Domain can only contain letters, numbers, dots, and hyphens');

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
 * Get user stats with enhanced error handling
 */
router.get('/stats', async (req, res) => {
    const prisma = req.app.get('prisma');
    const telegramId = req.telegramId;

    // Add timeout protection
    const timeout = setTimeout(() => {
        if (!res.headersSent) {
            res.status(504).json({ 
                error: 'Request timeout',
                message: 'Stats calculation took too long. Please try again.'
            });
        }
    }, 30000); // 30 second timeout

    try {
        // Validate telegramId
        if (!telegramId) {
            clearTimeout(timeout);
            return res.status(400).json({ 
                error: 'Invalid authentication',
                message: 'Telegram ID is required'
            });
        }

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
            clearTimeout(timeout);
            return res.status(404).json({ 
                error: 'User not found',
                message: 'Unable to locate user account'
            });
        }

        // Calculate basic stats
        const totalLinks = user.links.length;
        const totalClicks = user._count.clickEvents;

        // Get recent clicks with error handling
        let recentClicks = 0;
        try {
            recentClicks = await prisma.clickEvent.count({
                where: {
                    userId: telegramId,
                    timestamp: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    },
                },
            });
        } catch (dbError) {
            console.warn('Failed to fetch recent clicks:', dbError.message);
            recentClicks = 0; // Fallback value
        }

        // Get unique IPs with error handling
        let uniqueIps = [];
        try {
            const ipGroups = await prisma.clickEvent.groupBy({
                by: ['ipTruncated'],
                where: { userId: telegramId },
            });
            uniqueIps = ipGroups;
        } catch (dbError) {
            console.warn('Failed to fetch unique IPs:', dbError.message);
            uniqueIps = [];
        }

        // Get countries with error handling
        let countries = [];
        try {
            const countryGroups = await prisma.clickEvent.groupBy({
                by: ['country'],
                where: { userId: telegramId, country: { not: null } },
            });
            countries = countryGroups;
        } catch (dbError) {
            console.warn('Failed to fetch countries:', dbError.message);
            countries = [];
        }

        // Get security stats with error handling
        let securityStats = { vpn: 0, proxy: 0, tor: 0, bots: 0 };
        try {
            const [vpnCount, proxyCount, torCount, botCount] = await Promise.allSettled([
                prisma.clickEvent.count({ where: { userId: telegramId, isVpn: true } }),
                prisma.clickEvent.count({ where: { userId: telegramId, isProxy: true } }),
                prisma.clickEvent.count({ where: { userId: telegramId, isTor: true } }),
                prisma.clickEvent.count({ where: { userId: telegramId, isBot: true } })
            ]);

            securityStats = {
                vpn: vpnCount.status === 'fulfilled' ? vpnCount.value : 0,
                proxy: proxyCount.status === 'fulfilled' ? proxyCount.value : 0,
                tor: torCount.status === 'fulfilled' ? torCount.value : 0,
                bots: botCount.status === 'fulfilled' ? botCount.value : 0
            };
        } catch (dbError) {
            console.warn('Failed to fetch security stats:', dbError.message);
            securityStats = { vpn: 0, proxy: 0, tor: 0, bots: 0 };
        }

        // Get timeline with error handling
        const timeline = [];
        try {
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                date.setHours(0, 0, 0, 0);

                const nextDate = new Date(date);
                nextDate.setDate(nextDate.getDate() + 1);

                try {
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
                } catch (dayError) {
                    console.warn(`Failed to fetch timeline data for ${date.toISOString().split('T')[0]}:`, dayError.message);
                    timeline.push({
                        date: date.toISOString().split('T')[0],
                        clicks: 0,
                    });
                }
            }
        } catch (timelineError) {
            console.warn('Failed to generate timeline:', timelineError.message);
            // Create empty timeline as fallback
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                timeline.push({
                    date: date.toISOString().split('T')[0],
                    clicks: 0,
                });
            }
        }

        clearTimeout(timeout);

        res.json({
            totalLinks,
            totalClicks,
            recentClicks,
            avgClicksPerLink: totalLinks > 0 ? Math.round((totalClicks / totalLinks) * 10) / 10 : 0,
            uniqueIps: uniqueIps.length,
            countries: countries.length,
            security: securityStats,
            timeline,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        clearTimeout(timeout);
        
        // Categorize errors for better debugging
        let errorType = 'unknown_error';
        let statusCode = 500;
        let userMessage = 'Failed to fetch stats';

        if (error.name === 'PrismaClientKnownRequestError') {
            errorType = 'database_error';
            statusCode = 503;
            userMessage = 'Database temporarily unavailable';
        } else if (error.name === 'PrismaClientValidationError') {
            errorType = 'validation_error';
            statusCode = 400;
            userMessage = 'Invalid request parameters';
        } else if (error.name === 'TimeoutError') {
            errorType = 'timeout_error';
            statusCode = 504;
            userMessage = 'Request timed out';
        }

        console.error(`Stats endpoint error [${errorType}]:`, {
            error: error.message,
            stack: error.stack,
            telegramId: telegramId?.toString(),
            timestamp: new Date().toISOString()
        });

        if (!res.headersSent) {
            res.status(statusCode).json({ 
                error: userMessage,
                errorType,
                timestamp: new Date().toISOString()
            });
        }
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

    try {
        // Validate destinationUrl with enhanced schema
        const validatedUrl = urlSchema.parse(destinationUrl);
        
        // Validate domain if provided
        let validatedDomain = null;
        if (domain) {
            validatedDomain = domainSchema.parse(domain);
        }

        try {
            const trackingId = nanoid(10);

            const link = await prisma.link.create({
                data: {
                    trackingId,
                    destinationUrl: validatedUrl,
                    userId: telegramId,
                    domain: validatedDomain,
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
    } catch (validationError) {
        if (validationError instanceof z.ZodError) {
            const errorMessages = validationError.errors.map(err => err.message);
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: errorMessages 
            });
        }
        console.error('Validation error:', validationError);
        res.status(400).json({ error: 'Invalid input provided' });
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
 * Get analytics for a specific link with pagination
 */
router.get('/links/:trackingId/analytics', async (req, res) => {
    const prisma = req.app.get('prisma');
    const telegramId = req.telegramId;
    const { trackingId } = req.params;
    
    // Parse pagination parameters
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50)); // Max 100 per page
    const sortBy = req.query.sortBy || 'timestamp';
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';
    
    // Calculate offset
    const offset = (page - 1) * limit;

    try {
        // Validate pagination parameters
        if (page < 1 || limit < 1 || limit > 100) {
            return res.status(400).json({ 
                error: 'Invalid pagination parameters',
                message: 'Page must be >= 1, limit must be between 1 and 100'
            });
        }

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

        // Validate sortBy field
        const allowedSortFields = ['timestamp', 'country', 'deviceType', 'browser', 'os'];
        if (!allowedSortFields.includes(sortBy)) {
            return res.status(400).json({ 
                error: 'Invalid sort field',
                message: `Sort field must be one of: ${allowedSortFields.join(', ')}`
            });
        }

        // Get total count for pagination info
        const totalCount = await prisma.clickEvent.count({
            where: { trackingId },
        });

        // Get paginated click events
        const clickEvents = await prisma.clickEvent.findMany({
            where: { trackingId },
            orderBy: { [sortBy]: sortOrder },
            skip: offset,
            take: limit,
        });

        // Calculate pagination info
        const totalPages = Math.ceil(totalCount / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        // Calculate stats from all events (not just paginated)
        const allClicksStats = await prisma.clickEvent.findMany({
            where: { trackingId },
            select: {
                ipTruncated: true,
                country: true,
                isVpn: true,
                isProxy: true,
                isTor: true,
                isBot: true,
                webrtcLeakDetected: true,
                deviceType: true,
                browser: true,
                timestamp: true,
            },
        });

        const totalClicks = allClicksStats.length;
        const uniqueIps = [...new Set(allClicksStats.map(e => e.ipTruncated).filter(Boolean))];
        const countries = [...new Set(allClicksStats.map(e => e.country).filter(Boolean))];

        const vpnCount = allClicksStats.filter(e => e.isVpn).length;
        const proxyCount = allClicksStats.filter(e => e.isProxy).length;
        const torCount = allClicksStats.filter(e => e.isTor).length;
        const botCount = allClicksStats.filter(e => e.isBot).length;
        const webrtcLeaks = allClicksStats.filter(e => e.webrtcLeakDetected).length;

        // Get last click from all events
        const lastClick = allClicksStats.length > 0 ? 
            new Date(Math.max(...allClicksStats.map(e => new Date(e.timestamp)))) : null;

        // Get device types from all events
        const deviceTypes = allClicksStats.reduce((acc, e) => {
            const type = e.deviceType || 'unknown';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});

        // Get browsers from all events
        const browsers = allClicksStats.reduce((acc, e) => {
            const browser = e.browser || 'unknown';
            acc[browser] = (acc[browser] || 0) + 1;
            return acc;
        }, {});

        res.json({
            trackingId: link.trackingId,
            destinationUrl: link.destinationUrl,
            pagination: {
                currentPage: page,
                totalPages,
                totalCount,
                limit,
                hasNextPage,
                hasPrevPage,
                sortBy,
                sortOrder
            },
            stats: {
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
            },
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
        
        // Better error handling
        let statusCode = 500;
        let errorMessage = 'Failed to fetch analytics';
        
        if (error.name === 'PrismaClientKnownRequestError') {
            statusCode = 503;
            errorMessage = 'Database temporarily unavailable';
        } else if (error.name === 'PrismaClientValidationError') {
            statusCode = 400;
            errorMessage = 'Invalid request parameters';
        }
        
        res.status(statusCode).json({ 
            error: errorMessage,
            timestamp: new Date().toISOString()
        });
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
