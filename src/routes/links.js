import express from 'express';
import { nanoid } from 'nanoid';
import { basicAuth } from '../middleware/auth.js';
import { telegramAuthMiddleware } from '../middleware/telegramAuth.js';

const router = express.Router();

// Create a link - Telegram auth for users, basicAuth for admin
router.post('/', telegramAuthMiddleware, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { destinationUrl } = req.body;
  const telegramId = req.telegramId;

  if (!destinationUrl) {
    return res.status(400).json({ error: 'destinationUrl is required' });
  }

  if (typeof destinationUrl !== 'string' || destinationUrl.length < 10 || destinationUrl.length > 2048) {
    return res.status(400).json({ error: 'URL must be at least 10 characters and no more than 2048 characters' });
  }

  try {
    new URL(destinationUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  if (!destinationUrl.startsWith('http://') && !destinationUrl.startsWith('https://')) {
    return res.status(400).json({ error: 'URL must start with http:// or https://' });
  }

  const trackingId = nanoid(10);

  const link = await prisma.link.create({
    data: {
      trackingId,
      destinationUrl,
      userId: telegramId,
    },
  });

  const baseUrl = process.env.BASE_URL || process.env.WEBAPP_URL || `http://localhost:${process.env.PORT || 3000}`;
  const shortUrl = `${baseUrl}/click?id=${link.trackingId}`;

  res.status(201).json({
    trackingId: link.trackingId,
    destinationUrl: link.destinationUrl,
    shortUrl,
    clickUrl: shortUrl,
    createdAt: link.createdAt,
  });
});

// Get all links for user (Telegram auth)
router.get('/', telegramAuthMiddleware, async (req, res) => {
  const prisma = req.app.get('prisma');
  const telegramId = req.telegramId;

  const links = await prisma.link.findMany({
    where: { userId: telegramId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { clickEvents: true },
      },
    },
  });

  const baseUrl = process.env.BASE_URL || process.env.WEBAPP_URL || `http://localhost:${process.env.PORT || 3000}`;

  res.json(links.map(link => ({
    trackingId: link.trackingId,
    destinationUrl: link.destinationUrl,
    shortUrl: `${baseUrl}/click?id=${link.trackingId}`,
    clickCount: link._count.clickEvents,
    createdAt: link.createdAt,
  })));
});

// Get single link - supports both auth methods
router.get('/:trackingId', async (req, res) => {
  const prisma = req.app.get('prisma');
  const { trackingId } = req.params;

  const link = await prisma.link.findUnique({
    where: { trackingId },
    include: {
      _count: {
        select: { clickEvents: true },
      },
    },
  });

  if (!link) {
    return res.status(404).json({ error: 'Link not found' });
  }

  const baseUrl = process.env.BASE_URL || process.env.WEBAPP_URL || `http://localhost:${process.env.PORT || 3000}`;

  res.json({
    trackingId: link.trackingId,
    destinationUrl: link.destinationUrl,
    shortUrl: `${baseUrl}/click?id=${link.trackingId}`,
    clickCount: link._count.clickEvents,
    createdAt: link.createdAt,
  });
});

// Delete link - Telegram auth
router.delete('/:trackingId', telegramAuthMiddleware, async (req, res) => {
  const prisma = req.app.get('prisma');
  const { trackingId } = req.params;
  const telegramId = req.telegramId;

  try {
    await prisma.link.delete({
      where: { trackingId, userId: telegramId },
    });
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Link not found' });
    }
    throw error;
  }
});

export default router;