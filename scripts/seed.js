import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

const sampleLinks = [
  { trackingId: 'demo123abc', destinationUrl: 'https://example.com' },
  { trackingId: 'test456def', destinationUrl: 'https://github.com' },
  { trackingId: 'link789ghi', destinationUrl: 'https://google.com' },
];

const sampleEvents = [
  {
    country: 'United States', region: 'California', city: 'San Francisco',
    deviceType: 'Desktop', browser: 'Chrome', browserVersion: '120.0',
    os: 'Windows', osVersion: '11', language: 'en-US',
  },
  {
    country: 'United Kingdom', region: 'England', city: 'London',
    deviceType: 'Mobile', browser: 'Safari', browserVersion: '17.0',
    os: 'iOS', osVersion: '17.2', language: 'en-GB',
  },
  {
    country: 'Germany', region: 'Bavaria', city: 'Munich',
    deviceType: 'Desktop', browser: 'Firefox', browserVersion: '121.0',
    os: 'Linux', osVersion: 'Ubuntu 22.04', language: 'de-DE',
  },
  {
    country: 'Japan', region: 'Tokyo', city: 'Tokyo',
    deviceType: 'Tablet', browser: 'Safari', browserVersion: '17.0',
    os: 'iPadOS', osVersion: '17.2', language: 'ja-JP',
  },
  {
    country: 'Australia', region: 'New South Wales', city: 'Sydney',
    deviceType: 'Mobile', browser: 'Chrome', browserVersion: '120.0',
    os: 'Android', osVersion: '14', language: 'en-AU',
  },
];

async function main() {
  console.log('Seeding database...');

  await prisma.clickEvent.deleteMany();
  await prisma.link.deleteMany();

  for (const link of sampleLinks) {
    await prisma.link.create({ data: link });
  }
  console.log('Created sample links');

  for (const link of sampleLinks) {
    const eventCount = Math.floor(Math.random() * 5) + 1;
    
    for (let i = 0; i < eventCount; i++) {
      const event = sampleEvents[Math.floor(Math.random() * sampleEvents.length)];
      const daysAgo = Math.floor(Math.random() * 7);
      const timestamp = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      await prisma.clickEvent.create({
        data: {
          trackingId: link.trackingId,
          ipTruncated: `${Math.floor(Math.random() * 255)}.0.0.0`,
          ...event,
          userAgent: 'Mozilla/5.0 (seeded)',
          fingerprintHash: nanoid(16),
          timestamp,
        },
      });
    }
  }
  console.log('Created sample click events');

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });