import 'dotenv/config';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import path from 'path';
import { telegramAuthMiddleware, requireAdmin } from '../../src/middleware/telegramAuth.js';

const app = express();
const execAsync = promisify(exec);

// Use singleton PrismaClient to prevent connection pool exhaustion
const globalForPrisma = global;
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV === 'production') globalForPrisma.prisma = prisma;

app.set('trust proxy', true);
app.use(express.json());

// Note: OSINT results are returned directly in the response.
// In a production serverless environment, consider storing results in a database
// if you need to retrieve them later by scanId.
function generateScanId() {
    return crypto.randomBytes(8).toString('hex');
}

async function checkToolsInstalled() {
    const tools = {
        spiderfoot: false,
        maigret: false,
        sherlock: false,
        holehe: false,
        phoneinfoga: false
    };

    try {
        await execAsync('which spiderfoot || echo "not found"');
        tools.spiderfoot = true;
    } catch (e) {
        tools.spiderfoot = false;
    }

    try {
        await execAsync('which maigret || echo "not found"');
        tools.maigret = true;
    } catch (e) {
        tools.maigret = false;
    }

    try {
        await execAsync('which sherlock || echo "not found"');
        tools.sherlock = true;
    } catch (e) {
        tools.sherlock = false;
    }

    try {
        await execAsync('which holehe || echo "not found"');
        tools.holehe = true;
    } catch (e) {
        tools.holehe = false;
    }

    try {
        await execAsync('which phoneinfoga || echo "not found"');
        tools.phoneinfoga = true;
    } catch (e) {
        tools.phoneinfoga = false;
    }

    return tools;
}

async function runMaigret(username) {
    try {
        const outputFile = path.join('/tmp', `maigret-${Date.now()}.json`);

        const cmd = `maigret ${username} --json ${outputFile} -v 2>&1`;
        const { stdout, stderr } = await execAsync(cmd).catch(() => ({ stdout: '', stderr: '' }));

        return {
            tool: 'maigret',
            username,
            found: stdout.includes('[+]') || stdout.includes('Found'),
            message: 'Maigret scan completed',
            rawOutput: stdout.substring(0, 5000)
        };
    } catch (error) {
        return {
            tool: 'maigret',
            username,
            found: false,
            error: error.message
        };
    }
}

async function runSherlock(username) {
    try {
        const cmd = `sherlock ${username} --print-all 2>&1`;
        const { stdout } = await execAsync(cmd).catch(() => ({ stdout: '' }));

        return {
            tool: 'sherlock',
            username,
            found: stdout.includes('[+]'),
            message: 'Sherlock scan completed',
            rawOutput: stdout.substring(0, 5000)
        };
    } catch (error) {
        return {
            tool: 'sherlock',
            username,
            found: false,
            error: error.message
        };
    }
}

async function runHolehe(email) {
    try {
        const cmd = `holehe ${email} --only-used 2>&1`;
        const { stdout } = await execAsync(cmd).catch(() => ({ stdout: '' }));

        const found = (stdout.match(/\[+\]/g) || []).length;

        return {
            tool: 'holehe',
            email,
            found: found > 0,
            matches: found,
            message: 'Holehe scan completed',
            rawOutput: stdout.substring(0, 5000)
        };
    } catch (error) {
        return {
            tool: 'holehe',
            email,
            found: false,
            error: error.message
        };
    }
}

async function runPhoneInfoga(phoneNumber) {
    try {
        const cmd = `phoneinfoga -n ${phoneNumber} 2>&1`;
        const { stdout } = await execAsync(cmd).catch(() => ({ stdout: '' }));

        return {
            tool: 'phoneinfoga',
            phone: phoneNumber,
            valid: stdout.includes('valid') || stdout.includes('Valid'),
            message: 'PhoneInfoga scan completed',
            rawOutput: stdout.substring(0, 5000)
        };
    } catch (error) {
        return {
            tool: 'phoneinfoga',
            phone: phoneNumber,
            error: error.message
        };
    }
}

async function runSpiderFoot(target) {
    const scanId = generateScanId();

    try {
        const cmd = `spiderfoot -s ${target} -M sfp_spiderfoot,sfp_hunter,sfp_whois -o json 2>&1`;
        const { stdout } = await execAsync(cmd).catch(() => ({ stdout: '' }));

        return {
            tool: 'spiderfoot',
            scanId,
            target,
            status: 'completed',
            message: 'SpiderFoot scan completed',
            rawOutput: stdout.substring(0, 5000)
        };
    } catch (error) {
        return {
            tool: 'spiderfoot',
            scanId,
            target,
            status: 'error',
            error: error.message
        };
    }
}

// Apply auth middleware
app.use(telegramAuthMiddleware);

/**
 * GET / - Get available OSINT tools
 */
app.get('/', async (req, res) => {
    try {
        const tools = await checkToolsInstalled();

        res.json({
            message: 'OSINT API - Use POST to run scans',
            tools,
            endpoints: {
                spiderfoot: '/',
                maigret: '/maigret',
                sherlock: '/sherlock',
                holehe: '/holehe',
                phoneinfoga: '/phoneinfoga',
                orchestrator: '/scan'
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /maigret - Run Maigret username search
 */
app.post('/maigret', requireAdmin, async (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'username is required' });
    }

    try {
        const result = await runMaigret(username);
        const scanId = generateScanId();
        res.json({ ...result, scanId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /sherlock - Run Sherlock username search
 */
app.post('/sherlock', requireAdmin, async (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'username is required' });
    }

    try {
        const result = await runSherlock(username);
        const scanId = generateScanId();
        res.json({ ...result, scanId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /holehe - Run holehe email check
 */
app.post('/holehe', requireAdmin, async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'email is required' });
    }

    try {
        const result = await runHolehe(email);
        const scanId = generateScanId();
        res.json({ ...result, scanId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /phoneinfoga - Run PhoneInfoga scan
 */
app.post('/phoneinfoga', requireAdmin, async (req, res) => {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
        return res.status(400).json({ error: 'phoneNumber is required' });
    }

    try {
        const result = await runPhoneInfoga(phoneNumber);
        const scanId = generateScanId();
        res.json({ ...result, scanId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /spiderfoot - Run SpiderFoot scan
 */
app.post('/spiderfoot', requireAdmin, async (req, res) => {
    const { target } = req.body;

    if (!target) {
        return res.status(400).json({ error: 'target is required' });
    }

    try {
        const result = await runSpiderFoot(target);
        const scanId = generateScanId();
        res.json({ ...result, scanId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /scan - Orchestrator
 */
app.post('/scan', requireAdmin, async (req, res) => {
    const { target, types, username, email, phone, domain } = req.body;

    if (!target && !username && !email && !phone && !domain) {
        return res.status(400).json({
            error: 'At least one of: target, username, email, phone, domain is required'
        });
    }

    const scanId = generateScanId();
    const results = {
        scanId,
        timestamp: Date.now(),
        target: target || username || email || phone || domain,
        scans: []
    };

    const scanTypes = types || ['maigret', 'sherlock', 'holehe', 'phoneinfoga'];
    const scanTarget = target || username || email || phone || domain;

    const scanPromises = [];

    if (scanTypes.includes('maigret') && (username || target)) {
        scanPromises.push(runMaigret(username || target).then(r => ({ type: 'maigret', ...r })));
    }

    if (scanTypes.includes('sherlock') && (username || target)) {
        scanPromises.push(runSherlock(username || target).then(r => ({ type: 'sherlock', ...r })));
    }

    if (scanTypes.includes('holehe') && (email || target)) {
        scanPromises.push(runHolehe(email || target).then(r => ({ type: 'holehe', ...r })));
    }

    if (scanTypes.includes('phoneinfoga') && (phone || target)) {
        scanPromises.push(runPhoneInfoga(phone || target).then(r => ({ type: 'phoneinfoga', ...r })));
    }

    if (scanTypes.includes('spiderfoot') && (domain || target)) {
        scanPromises.push(runSpiderFoot(domain || target).then(r => ({ type: 'spiderfoot', ...r })));
    }

    try {
        const scanResults = await Promise.allSettled(scanPromises);

        results.scans = scanResults.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message });
        results.summary = {
            total: results.scans.length,
            successful: results.scans.filter(s => !s.error).length,
            failed: results.scans.filter(s => s.error).length
        };

        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Export as serverless handler
export const handler = async (event, context) => {
    const serverless = (await import('serverless-http')).default;
    return serverless(app)(event, context);
};
