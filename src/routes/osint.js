import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { telegramAuthMiddleware, requireAdmin } from '../middleware/telegramAuth.js';

const router = express.Router();
const execAsync = promisify(exec);

// Note: OSINT results are returned directly in the response.
// In a production serverless environment, consider storing results in a database
// if you need to retrieve them later by scanId.

/**
 * Generate a unique ID for OSINT scans
 */
function generateScanId() {
    return crypto.randomBytes(8).toString('hex');
}

/**
 * Check if required OSINT tools are installed
 */
async function checkToolsInstalled() {
    const tools = {
        spiderfoot: false,
        maigret: false,
        sherlock: false,
        holehe: false,
        phoneinfoga: false
    };

    // Check for spiderfoot
    try {
        await execAsync('which spiderfoot || which sf || echo "not found"');
        tools.spiderfoot = true;
    } catch (e) {
        tools.spiderfoot = false;
    }

    // Check for maigret
    try {
        await execAsync('which maigret || echo "not found"');
        tools.maigret = true;
    } catch (e) {
        tools.maigret = false;
    }

    // Check for sherlock
    try {
        await execAsync('which sherlock || echo "not found"');
        tools.sherlock = true;
    } catch (e) {
        tools.sherlock = false;
    }

    // Check for holehe
    try {
        await execAsync('which holehe || echo "not found"');
        tools.holehe = true;
    } catch (e) {
        tools.holehe = false;
    }

    // Check for phoneinfoga
    try {
        await execAsync('which phoneinfoga || echo "not found"');
        tools.phoneinfoga = true;
    } catch (e) {
        tools.phoneinfoga = false;
    }

    return tools;
}

/**
 * Run SpiderFoot scan
 */
async function runSpiderFoot(target, scanType = 'all') {
    const scanId = generateScanId();
    const outputDir = path.join(process.cwd(), 'osint-results', scanId);

    try {
        await fs.mkdir(outputDir, { recursive: true });

        const modules = {
            'all': 'sfp_spiderfoot,sfp_手_hunter,sfp_emailformat,sfp_whois,sfp_dnszonexfer,sfp_bingsearch,sfp_googlesearch,sfp_twitter',
            'email': 'sfp_emailformat,sfp_hunter,sfp_breachdirectory,sfp_dehashed,sfp_emailrep',
            'domain': 'sfp_spiderfoot,sfp_whois,sfp_dnszonexfer,sfp_dnsresolving,sfp_手_hunter',
            'username': 'sfp_sherlock,sfp_maigret,sfp_instagram,sfp_twitter,sfp_facebook',
            'phone': 'sfp_phonenumber,sfp_calleridemonitor,sfp_phonesearch'
        };

        const moduleList = modules[scanType] || modules['all'];

        const cmd = `spiderfoot -s ${target} -M ${moduleList} -o json - > ${outputDir}/results.json 2>&1`;

        // Run in background, don't wait
        execAsync(cmd).catch(err => console.error('SpiderFoot error:', err));

        return {
            scanId,
            status: 'started',
            message: 'SpiderFoot scan initiated',
            target,
            scanType
        };
    } catch (error) {
        return {
            scanId,
            status: 'error',
            message: error.message,
            target
        };
    }
}

/**
 * Run Maigret username search
 */
async function runMaigret(username) {
    try {
        const outputFile = path.join(process.cwd(), 'osint-results', `maigret-${Date.now()}.json`);
        await fs.mkdir(path.dirname(outputFile), { recursive: true });

        const cmd = `maigret ${username} --json ${outputFile} -v 2>&1`;
        const { stdout, stderr } = await execAsync(cmd, { timeout: 300000 });

        let results = [];
        try {
            const content = await fs.readFile(outputFile, 'utf-8');
            results = JSON.parse(content);
        } catch (e) {
            // Parse from stdout if JSON file not available
            results = parseMaigretOutput(stdout);
        }

        return {
            tool: 'maigret',
            username,
            found: results.length > 0,
            sites: results.map(r => ({
                name: r.site || r.name,
                url: r.url,
                status: r.status,
                username: r.username
            })),
            count: results.length
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

/**
 * Parse Maigret output
 */
function parseMaigretOutput(output) {
    const results = [];
    const lines = output.split('\n');

    for (const line of lines) {
        if (line.includes('[+]') || line.includes('Found')) {
            const match = line.match(/\[(.*?)\]/);
            if (match) {
                results.push({
                    site: match[1],
                    status: 'found',
                    url: line.replace(/.*?\]\s*/, '').trim()
                });
            }
        }
    }

    return results;
}

/**
 * Run Sherlock username search
 */
async function runSherlock(username) {
    try {
        const outputFile = path.join(process.cwd(), 'osint-results', `sherlock-${Date.now()}.txt`);
        await fs.mkdir(path.dirname(outputFile), { recursive: true });

        const cmd = `sherlock ${username} --output ${outputFile} --print-all 2>&1`;
        const { stdout } = await execAsync(cmd, { timeout: 300000 });

        const results = parseSherlockOutput(stdout);

        return {
            tool: 'sherlock',
            username,
            found: results.length > 0,
            sites: results,
            count: results.length
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

/**
 * Parse Sherlock output
 */
function parseSherlockOutput(output) {
    const results = [];
    const lines = output.split('\n');

    for (const line of lines) {
        if (line.includes('[+]') && line.includes('http')) {
            const url = line.replace(/.*?\[+\]\s*/, '').trim();
            if (url.startsWith('http')) {
                results.push({
                    name: new URL(url).hostname,
                    url
                });
            }
        }
    }

    return results;
}

/**
 * Run holehe email check
 */
async function runHolehe(email) {
    try {
        const cmd = `holehe ${email} --only-used --json 2>&1`;
        const { stdout } = await execAsync(cmd, { timeout: 300000 });

        let results = [];
        try {
            results = JSON.parse(stdout);
        } catch (e) {
            results = parseHoleheOutput(stdout);
        }

        const found = results.filter(r => r.exist).length;

        return {
            tool: 'holehe',
            email,
            found: found > 0,
            sites: results.map(r => ({
                name: r.name,
                exists: r.exist,
                delay: r.delay
            })),
            count: found
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

/**
 * Parse holehe output
 */
function parseHoleheOutput(output) {
    const results = [];
    const lines = output.split('\n');

    for (const line of lines) {
        if (line.includes('[+]') || line.includes('[x]')) {
            const isFound = line.includes('[+]');
            const name = line.replace(/.*?\[+\]\s*/, '').replace(/\[x\].*/, '').trim();
            if (name) {
                results.push({
                    name,
                    exist: isFound
                });
            }
        }
    }

    return results;
}

/**
 * Run PhoneInfoga scan
 */
async function runPhoneInfoga(phoneNumber) {
    try {
        const outputFile = path.join(process.cwd(), 'osint-results', `phone-${Date.now()}.json`);
        await fs.mkdir(path.dirname(outputFile), { recursive: true });

        const cmd = `phoneinfoga -n ${phoneNumber} -o json > ${outputFile} 2>&1`;
        await execAsync(cmd, { timeout: 300000 });

        let results = {};
        try {
            const content = await fs.readFile(outputFile, 'utf-8');
            results = JSON.parse(content);
        } catch (e) {
            results = { raw: outputFile };
        }

        return {
            tool: 'phoneinfoga',
            phone: phoneNumber,
            valid: results.valid || false,
            format: results.format,
            country: results.country,
            carrier: results.carrier,
            region: results.region,
            timezone: results.timezone,
            coordinates: results.coordinates,
            additionalInfo: results.additionalInfo
        };
    } catch (error) {
        return {
            tool: 'phoneinfoga',
            phone: phoneNumber,
            error: error.message
        };
    }
}

/**
 * Get scan results
 */
function getScanResults(scanId) {
    const result = osintResults.get(scanId);

    if (!result) {
        return null;
    }

    // Check if results file exists for SpiderFoot
    if (result.tool === 'spiderfoot') {
        const resultsFile = path.join(process.cwd(), 'osint-results', scanId, 'results.json');
        try {
            const content = require('fs').readFileSync(resultsFile, 'utf-8');
            result.results = JSON.parse(content);
        } catch (e) {
            // Results not ready yet
        }
    }

    return result;
}

// Apply authentication middleware to all routes
router.use(telegramAuthMiddleware);

/**
 * GET /api/osint
 * Get available OSINT tools and their status
 */
router.get('/', async (req, res) => {
    try {
        const tools = await checkToolsInstalled();

        res.json({
            message: 'OSINT API - Use POST to run scans',
            tools,
            endpoints: {
                spiderfoot: '/api/osint/spiderfoot',
                maigret: '/api/osint/maigret',
                sherlock: '/api/osint/sherlock',
                holehe: '/api/osint/holehe',
                phoneinfoga: '/api/osint/phoneinfoga',
                orchestrator: '/api/osint/scan',
                status: '/api/osint/status/:scanId'
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/osint/spiderfoot
 * Run SpiderFoot scan
 */
router.post('/spiderfoot', requireAdmin, async (req, res) => {
    const { target, scanType } = req.body;

    if (!target) {
        return res.status(400).json({ error: 'target is required' });
    }

    try {
        const result = await runSpiderFoot(target, scanType);

        if (result.scanId) {
            osintResults.set(result.scanId, {
                ...result,
                timestamp: Date.now()
            });
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/osint/maigret
 * Run Maigret username search
 */
router.post('/maigret', requireAdmin, async (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'username is required' });
    }

    try {
        const result = await runMaigret(username);

        const scanId = generateScanId();
        osintResults.set(scanId, {
            ...result,
            scanId,
            timestamp: Date.now()
        });

        res.json({ ...result, scanId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/osint/sherlock
 * Run Sherlock username search
 */
router.post('/sherlock', requireAdmin, async (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'username is required' });
    }

    try {
        const result = await runSherlock(username);

        const scanId = generateScanId();
        osintResults.set(scanId, {
            ...result,
            scanId,
            timestamp: Date.now()
        });

        res.json({ ...result, scanId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/osint/holehe
 * Run holehe email check
 */
router.post('/holehe', requireAdmin, async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'email is required' });
    }

    try {
        const result = await runHolehe(email);

        const scanId = generateScanId();
        osintResults.set(scanId, {
            ...result,
            scanId,
            timestamp: Date.now()
        });

        res.json({ ...result, scanId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/osint/phoneinfoga
 * Run PhoneInfoga scan
 */
router.post('/phoneinfoga', async (req, res) => {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
        return res.status(400).json({ error: 'phoneNumber is required' });
    }

    try {
        const result = await runPhoneInfoga(phoneNumber);

        const scanId = generateScanId();
        osintResults.set(scanId, {
            ...result,
            scanId,
            timestamp: Date.now()
        });

        res.json({ ...result, scanId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/osint/scan
 * Orchestrator - run multiple OSINT tools
 */
router.post('/scan', async (req, res) => {
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

    // Determine what to scan
    const scanTypes = types || ['maigret', 'sherlock', 'holehe', 'phoneinfoga'];
    const scanTarget = target || username || email || phone || domain;

    // Run scans in parallel
    const scanPromises = [];

    if (scanTypes.includes('maigret') && (username || target)) {
        scanPromises.push(
            runMaigret(username || target).then(r => ({ type: 'maigret', ...r }))
        );
    }

    if (scanTypes.includes('sherlock') && (username || target)) {
        scanPromises.push(
            runSherlock(username || target).then(r => ({ type: 'sherlock', ...r }))
        );
    }

    if (scanTypes.includes('holehe') && (email || target)) {
        scanPromises.push(
            runHolehe(email || target).then(r => ({ type: 'holehe', ...r }))
        );
    }

    if (scanTypes.includes('phoneinfoga') && (phone || target)) {
        scanPromises.push(
            runPhoneInfoga(phone || target).then(r => ({ type: 'phoneinfoga', ...r }))
        );
    }

    if (scanTypes.includes('spiderfoot') && (domain || target)) {
        scanPromises.push(
            runSpiderFoot(domain || target).then(r => ({ type: 'spiderfoot', ...r }))
        );
    }

    try {
        const scanResults = await Promise.allSettled(scanPromises);

        results.scans = scanResults.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason.message });
        results.summary = {
            total: results.scans.length,
            successful: results.scans.filter(s => !s.error).length,
            failed: results.scans.filter(s => s.error).length
        };

        osintResults.set(scanId, results);

        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/osint/status/:scanId
 * Get scan results
 */
router.get('/status/:scanId', async (req, res) => {
    const { scanId } = req.params;

    const result = getScanResults(scanId);

    if (!result) {
        return res.status(404).json({ error: 'Scan not found or expired' });
    }

    res.json(result);
});

/**
 * GET /api/osint/history
 * Get scan history for current user
 */
router.get('/history', async (req, res) => {
    const history = [];

    for (const [id, result] of osintResults) {
        if (result.telegramId === req.telegramId.toString()) {
            history.push({
                scanId: id,
                target: result.target,
                tool: result.tool || result.scans?.[0]?.type || 'orchestrator',
                timestamp: result.timestamp,
                status: result.status || (result.results ? 'completed' : 'processing')
            });
        }
    }

    res.json(history.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50));
});

export default router;
