import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { createFriendlyError, friendlyErrorHandler, createSuccessResponse } from '../utils/errorHandler.js';
import { osintLogger, initializeLogging } from '../utils/logger.js';
import { getToolCache, initializeToolCache } from '../utils/toolCache.js';
import { telegramAuthMiddleware, requireAdmin } from '../middleware/telegramAuth.js';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const execAsync = promisify(exec);
const prisma = new PrismaClient();

// Store OSINT scan results in memory
const osintResults = new Map();

// Cleanup old scan results every 30 minutes
const CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes
const MAX_SCAN_AGE = 24 * 60 * 60 * 1000; // 24 hours

// Cleanup function to remove old scan results
function cleanupOldScanResults() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [scanId, result] of osintResults.entries()) {
        if (now - result.timestamp > MAX_SCAN_AGE) {
            osintResults.delete(scanId);
            cleanedCount++;
        }
    }

    if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} old OSINT scan results`);
    }
}

// Start cleanup interval
setInterval(cleanupOldScanResults, CLEANUP_INTERVAL);

// Input validation schemas to prevent command injection
const targetSchema = z.string()
    .min(3)
    .max(255)
    .regex(/^[a-zA-Z0-9.@-]+$/, 'Target can only contain letters, numbers, dots, hyphens, and @');

const usernameSchema = z.string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain letters, numbers, underscores, dots, and hyphens');

const emailSchema = z.string()
    .email()
    .max(255);

const phoneSchema = z.string()
    .min(10)
    .max(20)
    .regex(/^[+0-9-() ]+$/, 'Phone number can only contain digits, plus, and common phone symbols');

const scanTypeSchema = z.enum(['all', 'email', 'domain', 'username', 'phone'], {
    errorMap: (issue, ctx) => {
        return { message: 'Invalid scan type. Must be one of: all, email, domain, username, phone' };
    }
});

// Rate limiting to prevent abuse
const osintLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 requests per minute per IP
    message: 'Too many OSINT scans, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

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
 * Save OSINT scan results to database
 */
async function saveScanResult(scanId, userId, tool, target, results, status = 'completed', error = null) {
    try {
        await prisma.osintScan.create({
            data: {
                scanId,
                userId,
                tool,
                target,
                results: JSON.stringify(results),
                status,
                error
            }
        });
    } catch (dbError) {
        console.error('Failed to save scan result:', dbError);
        // Continue without failing the request
    }
}

/**
 * Create standardized OSINT response format
 */
function createStandardResponse(scanId, tool, target, status, found = false, count = 0, results = [], error = null) {
    return {
        scanId,
        tool,
        target,
        status: status || 'completed',
        found,
        count,
        results,
        error,
        timestamp: Date.now()
    };
}

/**
 * Check if required OSINT tools are installed with caching
 */
async function checkToolsInstalled() {
    const cache = getToolCache();
    const tools = {
        spiderfoot: false,
        maigret: false,
        sherlock: false,
        holehe: false,
        phoneinfoga: false
    };

    const startTime = Date.now();
    let cacheHits = 0;
    let cacheMisses = 0;

    // Check each tool with caching
    for (const tool of Object.keys(tools)) {
        // Try to get from cache first
        const cached = cache.get(tool);

        if (cached !== null) {
            tools[tool] = cached.available;
            cacheHits++;
            await osintLogger.cache('tool_check', tool, cached.available, Date.now() - startTime);
        } else {
            cacheMisses++;

            // Check if tool is installed using cross-platform detection
            try {
                const toolCommand = process.platform === 'win32' ? `where ${tool}` : `which ${tool}`;
                await execAsync(`${toolCommand} || echo "not found"`);
                tools[tool] = true;
                await cache.set(tool, { available: true, lastChecked: Date.now() });
                await osintLogger.toolCheck(tool, true, Date.now() - startTime);
            } catch (e) {
                tools[tool] = false;
                await cache.set(tool, { available: false, lastChecked: Date.now() });
                await osintLogger.toolCheck(tool, false, Date.now() - startTime);
            }
        }
    }

    await osintLogger.performance('tool_check_cached', Date.now() - startTime, {
        availableTools: Object.values(tools).filter(Boolean).length,
        totalTools: Object.keys(tools).length,
        cacheHits,
        cacheMisses
    });

    return tools;
}

/**
 * Get list of all available SpiderFoot modules
 */
async function getSpiderFootModules() {
    const spiderFootUrl = process.env.SPIDERFOOT_URL || 'http://localhost:5001';
    try {
        const response = await fetch(`${spiderFootUrl}/api/modules`);
        if (!response.ok) throw new Error('Failed to fetch modules');
        const data = await response.json();
        return Object.keys(data);
    } catch (error) {
        console.error('Failed to get SpiderFoot modules:', error.message);
        return [];
    }
}

/**
 * Run SpiderFoot scan via API
 */
async function runSpiderFoot(target, scanType = 'all') {
    const validatedTarget = targetSchema.parse(target);
    const scanId = generateScanId();
    const spiderFootUrl = process.env.SPIDERFOOT_URL || 'http://localhost:5001';

    const moduleConfigs = {
        'all': {
            useAll: true,
            type: 'ALL'
        },
        'email': {
            modules: ['sfp_emailformat', 'sfp_hunter', 'sfp_breachdirectory', 'sfp_dehashed', 'sfp_emailrep', 'sfp_holehe'],
            type: 'EMAILADDR'
        },
        'domain': {
            modules: ['sfp_whois', 'sfp_dnszonexfer', 'sfp_dnsresolving', 'sfp_hunter', 'sfp_dnsbrute', 'sfp_googiesearch', 'sfp_bingsearch'],
            type: 'INTERNET_NAME'
        },
        'username': {
            modules: ['sfp_sherlock', 'sfp_maigret', 'sfp_instagram', 'sfp_twitter', 'sfp_facebook', 'sfp_linkedin', 'sfp_github'],
            type: 'USERNAME'
        },
        'phone': {
            modules: ['sfp_phonenumber', 'sfp_calleridemonitor', 'sfp_phonesearch'],
            type: 'PHONE_NUMBER'
        }
    };

    try {
        const config = moduleConfigs[scanType] || moduleConfigs['all'];

        let moduleList = [];
        if (config.useAll) {
            moduleList = await getSpiderFootModules();
            if (moduleList.length === 0) {
                moduleList = moduleConfigs['all'].modules;
            }
        } else {
            moduleList = config.modules;
        }

        const targetType = config.type;

        const scanRequest = {
            scanName: `TraceLink Scan ${scanId}`,
            target: {
                [targetType]: [validatedTarget]
            },
            moduleList: moduleList,
            doNotModules: [],
            unqrytypes: []
        };

        const response = await fetch(`${spiderFootUrl}/api/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scanRequest)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SpiderFoot API error: ${errorText}`);
        }

        const scanResult = await response.json();

        osintResults.set(scanId, {
            scanId,
            tool: 'spiderfoot',
            target: validatedTarget,
            scanType,
            sfScanId: scanResult.scanId || scanResult.id,
            status: 'started',
            timestamp: Date.now()
        });

        return {
            scanId,
            status: 'started',
            message: 'SpiderFoot scan initiated via API',
            target: validatedTarget,
            scanType,
            modulesUsed: moduleList.length,
            sfScanId: scanResult.scanId || scanResult.id
        };
    } catch (error) {
        return {
            scanId,
            status: 'error',
            message: error.message,
            target: validatedTarget
        };
    }
}

/**
 * Run Maigret username search
 */
async function runMaigret(username) {
    // Validate input to prevent command injection
    const validatedUsername = usernameSchema.parse(username);

    try {
        const outputFile = path.join(process.cwd(), 'osint-results', `maigret-${Date.now()}.json`);
        await fs.mkdir(path.dirname(outputFile), { recursive: true });

        const cmd = `maigret ${validatedUsername} --json ${outputFile} -v 2>&1`;
        const { stdout, stderr } = await execAsync(cmd, { timeout: 300000 });

        let results = [];
        try {
            const content = await fs.readFile(outputFile, 'utf-8');
            results = JSON.parse(content);
        } catch (e) {
            // Parse from stdout if JSON file not available
            results = parseMaigretOutput(stdout);
        }

        return createStandardResponse(
            null, // scanId will be generated by endpoint
            'maigret',
            username,
            'completed',
            results.length > 0,
            results.length,
            results.map(r => ({
                name: r.site || r.name,
                url: r.url,
                status: r.status,
                username: r.username
            }))
        );
    } catch (error) {
        return createStandardResponse(
            null,
            'maigret',
            username,
            'error',
            false,
            0,
            [],
            error.message
        );
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
    // Validate input to prevent command injection
    const validatedUsername = usernameSchema.parse(username);

    try {
        const outputFile = path.join(process.cwd(), 'osint-results', `sherlock-${Date.now()}.txt`);
        await fs.mkdir(path.dirname(outputFile), { recursive: true });

        const cmd = `sherlock ${validatedUsername} --output ${outputFile} --print-all 2>&1`;
        const { stdout } = await execAsync(cmd, { timeout: 300000 });

        const results = parseSherlockOutput(stdout);

        return createStandardResponse(
            null,
            'sherlock',
            username,
            'completed',
            results.length > 0,
            results.length,
            results
        );
    } catch (error) {
        return createStandardResponse(
            null,
            'sherlock',
            username,
            'error',
            false,
            0,
            [],
            error.message
        );
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
    // Validate input to prevent command injection
    const validatedEmail = emailSchema.parse(email);

    try {
        const cmd = `holehe ${validatedEmail} --only-used --json 2>&1`;
        const { stdout } = await execAsync(cmd, { timeout: 300000 });

        let results = [];
        try {
            results = JSON.parse(stdout);
        } catch (e) {
            results = parseHoleheOutput(stdout);
        }

        const found = results.filter(r => r.exist).length;

        return createStandardResponse(
            null,
            'holehe',
            email,
            'completed',
            found > 0,
            found,
            results.map(r => ({
                name: r.name,
                exists: r.exist,
                delay: r.delay
            }))
        );
    } catch (error) {
        return createStandardResponse(
            null,
            'holehe',
            email,
            'error',
            false,
            0,
            [],
            error.message
        );
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
    // Validate input to prevent command injection
    const validatedPhoneNumber = phoneSchema.parse(phoneNumber);

    try {
        const outputFile = path.join(process.cwd(), 'osint-results', `phone-${Date.now()}.json`);
        await fs.mkdir(path.dirname(outputFile), { recursive: true });

        const cmd = `phoneinfoga -n ${validatedPhoneNumber} -o json > ${outputFile} 2>&1`;
        await execAsync(cmd, { timeout: 300000 });

        let results = {};
        try {
            const content = await fs.readFile(outputFile, 'utf-8');
            results = JSON.parse(content);
        } catch (e) {
            results = { raw: outputFile };
        }

        return createStandardResponse(
            null,
            'phoneinfoga',
            phoneNumber,
            'completed',
            results.valid || false,
            1, // phoneinfoga returns single result
            {
                valid: results.valid || false,
                format: results.format,
                country: results.country,
                carrier: results.carrier,
                region: results.region,
                timezone: results.timezone,
                coordinates: results.coordinates,
                additionalInfo: results.additionalInfo
            }
        );
    } catch (error) {
        return createStandardResponse(
            null,
            'phoneinfoga',
            phoneNumber,
            'error',
            false,
            0,
            [],
            error.message
        );
    }
}

/**
 * Get scan results from SpiderFoot API
 */
async function getScanResults(scanId) {
    const result = osintResults.get(scanId);

    if (!result) {
        return null;
    }

    if (result.tool === 'spiderfoot' && result.sfScanId) {
        const spiderFootUrl = process.env.SPIDERFOOT_URL || 'http://localhost:5001';

        try {
            const response = await fetch(`${spiderFootUrl}/api/scan/${result.sfScanId}/results`);
            if (response.ok) {
                const data = await response.json();
                result.results = data;
                result.status = 'completed';
            }
        } catch (e) {
            result.status = 'processing';
        }
    }

    return result;
}

/**
 * GET /api/osint/health
 * Comprehensive health check for OSINT tools and system
 */
router.get('/health', telegramAuthMiddleware, async (req, res) => {
    try {
        const healthCheck = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            tools: {},
            system: {},
            database: {},
            performance: {},
            security: {}
        };

        // Check OSINT tools
        const tools = await checkToolsInstalled();
        healthCheck.tools = {
            available: Object.values(tools).filter(Boolean).length,
            total: Object.keys(tools).length,
            details: tools
        };

        // System information
        healthCheck.system = {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            pid: process.pid,
            cpuUsage: process.cpuUsage(),
            memoryUsage: process.memoryUsage(),
            loadAverage: process.loadavg?.() || null
        };

        // Database health check
        try {
            const dbStartTime = Date.now();
            await prisma.$queryRaw`SELECT 1 as health_check`;
            const dbLatency = Date.now() - dbStartTime;

            healthCheck.database = {
                status: 'connected',
                latency: `${dbLatency}ms`,
                lastCheck: new Date().toISOString()
            };

            await osintLogger.database('health_check', { latency: dbLatency }, true);
        } catch (dbError) {
            healthCheck.database = {
                status: 'disconnected',
                error: dbError.message,
                lastCheck: new Date().toISOString()
            };

            await osintLogger.database('health_check', { error: dbError.message }, false, dbError);
        }

        // Performance metrics
        const perfStartTime = Date.now();
        const testScan = await checkToolsInstalled();
        const toolCheckLatency = Date.now() - perfStartTime;

        healthCheck.performance = {
            toolCheckLatency: `${toolCheckLatency}ms`,
            responseTime: `${Date.now() - perfStartTime}ms`
        };

        // Security checks
        const securityChecks = {
            rateLimiting: osintLimiter ? 'active' : 'disabled',
            authentication: telegramAuthMiddleware ? 'enabled' : 'disabled',
            adminProtection: requireAdmin ? 'enabled' : 'disabled',
            inputValidation: 'enabled'
        };

        healthCheck.security = securityChecks;

        // Determine overall health status
        const issues = [];

        if (healthCheck.tools.available === 0) {
            issues.push('No OSINT tools available');
        }

        if (healthCheck.database.status === 'disconnected') {
            issues.push('Database disconnected');
        }

        if (healthCheck.performance.toolCheckLatency > 5000) {
            issues.push('Slow tool check performance');
        }

        if (issues.length > 0) {
            healthCheck.status = 'degraded';
            healthCheck.issues = issues;
        }

        res.json(healthCheck);

        await osintLogger.performance('health_check', Date.now() - perfStartTime, {
            status: healthCheck.status,
            issues: issues.length,
            toolsAvailable: healthCheck.tools.available
        });

    } catch (error) {
        const errorResponse = {
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        };

        res.status(503).json(errorResponse);

        await osintLogger.scanError('health_check', 'system', null, null, error, Date.now());
    }
});

/**
 * GET /api/osint/health/tools
 * Detailed health check for individual OSINT tools
 */
router.get('/health/tools', telegramAuthMiddleware, async (req, res) => {
    try {
        const toolHealth = {};
        const tools = ['spiderfoot', 'maigret', 'sherlock', 'holehe', 'phoneinfoga'];

        for (const tool of tools) {
            const startTime = Date.now();

            try {
                // Check if tool is installed using cross-platform detection
                const toolCommand = process.platform === 'win32' ? `where ${tool}` : `which ${tool}`;
                await execAsync(`${toolCommand} || echo "not found"`, { timeout: 5000 });
                const isInstalled = true;
                const latency = Date.now() - startTime;

                // Test basic functionality (if possible)
                let functional = false;
                let version = 'unknown';

                try {
                    if (tool === 'spiderfoot') {
                        const { stdout } = await execAsync('spiderfoot --version', { timeout: 10000 });
                        version = stdout.trim();
                        functional = true;
                    } else if (tool === 'maigret') {
                        const { stdout } = await execAsync('maigret --version', { timeout: 10000 });
                        version = stdout.trim();
                        functional = true;
                    } else if (tool === 'sherlock') {
                        const { stdout } = await execAsync('sherlock --version', { timeout: 10000 });
                        version = stdout.trim();
                        functional = true;
                    }
                } catch (versionError) {
                    functional = false;
                }

                toolHealth[tool] = {
                    status: 'healthy',
                    installed: isInstalled,
                    functional,
                    version,
                    latency: `${latency}ms`,
                    lastCheck: new Date().toISOString()
                };

                await osintLogger.toolCheck(tool, true, latency);

            } catch (error) {
                toolHealth[tool] = {
                    status: 'unhealthy',
                    installed: false,
                    functional: false,
                    version: 'unknown',
                    error: error.message,
                    latency: `${Date.now() - startTime}ms`,
                    lastCheck: new Date().toISOString()
                };

                await osintLogger.toolCheck(tool, false, Date.now() - startTime);
            }
        }

        const response = {
            timestamp: new Date().toISOString(),
            tools: toolHealth,
            summary: {
                total: tools.length,
                installed: Object.values(toolHealth).filter(t => t.installed).length,
                functional: Object.values(toolHealth).filter(t => t.functional).length,
                unhealthy: Object.values(toolHealth).filter(t => t.status === 'unhealthy').length
            }
        };

        res.json(response);

    } catch (error) {
        res.status(500).json({
            error: 'Failed to check tool health',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/osint/health/database
 * Database health check
 */
router.get('/health/database', telegramAuthMiddleware, async (req, res) => {
    try {
        const dbHealth = {
            timestamp: new Date().toISOString(),
            status: 'unknown',
            latency: null,
            connectionPool: {},
            lastCheck: null
        };

        const startTime = Date.now();

        try {
            // Basic connectivity test
            await prisma.$queryRaw`SELECT 1 as health_check`;
            dbHealth.status = 'connected';
            dbHealth.latency = `${Date.now() - startTime}ms`;
            dbHealth.lastCheck = new Date().toISOString();

            // Connection pool info (if available)
            try {
                const poolInfo = await prisma.$queryRaw`
                    SELECT 
                        count(*) as total_connections,
                        count(*) FILTER (WHERE state = 'active') as active,
                        count(*) FILTER (WHERE state = 'idle') as idle
                    FROM pg_stat_activity 
                    WHERE datname = current_database()
                `;

                dbHealth.connectionPool = poolInfo[0] || {};
            } catch (poolError) {
                dbHealth.connectionPool = { error: poolError.message };
            }

            res.json(dbHealth);

            await osintLogger.database('health_check', {
                latency: Date.now() - startTime,
                connections: dbHealth.connectionPool.total_connections || 0
            }, true);

        } catch (error) {
            dbHealth.status = 'disconnected';
            dbHealth.error = error.message;
            dbHealth.lastCheck = new Date().toISOString();

            res.status(503).json(dbHealth);

            await osintLogger.database('health_check', { error: error.message }, false, error);
        }
    } catch (error) {
        res.status(500).json({
            error: 'Database health check failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

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
router.post('/spiderfoot', osintLimiter, async (req, res) => {
    const telegramId = req.telegramId;
    const { target, scanType = 'all' } = req.body;

    try {
        // Validate input
        const validatedTarget = targetSchema.parse(target);
        const validatedScanType = scanTypeSchema.parse(scanType);

        // Run SpiderFoot scan
        const result = await runSpiderFoot(validatedTarget, validatedScanType);

        // Save scan result to database
        await saveScanResult(result.scanId, telegramId, 'spiderfoot', validatedTarget, result, result.status);

        // Return standardized response
        const response = createStandardResponse(
            result.scanId,
            'spiderfoot',
            validatedTarget,
            result.status,
            false,
            0,
            [],
            result.message
        );

        res.json(response);

    } catch (error) {
        const friendlyError = createFriendlyError(error, {
            endpoint: '/osint/spiderfoot',
            method: 'POST',
            userId: telegramId
        });

        // Save error to database
        const scanId = generateScanId();
        await saveScanResult(scanId, telegramId, 'spiderfoot', target, null, 'error', error.message);

        res.status(400).json(friendlyError);
    }
});

/**
 * POST /api/osint/maigret
 * Run Maigret username search
 */
router.post('/maigret', osintLimiter, requireAdmin, async (req, res) => {
    try {
        const { username } = req.body;

        // Validate input to prevent command injection
        const validatedUsername = usernameSchema.parse(username);

        if (!validatedUsername) {
            return res.status(400).json({ error: 'username is required' });
        }

        const result = await runMaigret(validatedUsername);
        const scanId = generateScanId();

        // Add scanId to standardized response
        const responseWithId = { ...result, scanId };

        osintResults.set(scanId, {
            ...responseWithId,
            timestamp: Date.now()
        });

        // Save to database for persistence
        await saveScanResult(
            scanId,
            req.telegramId,
            'maigret',
            validatedUsername,
            responseWithId,
            result.status,
            result.error
        );

        res.json(responseWithId);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/osint/sherlock
 * Run Sherlock username search
 */
router.post('/sherlock', osintLimiter, requireAdmin, async (req, res) => {
    try {
        const { username } = req.body;

        // Validate input to prevent command injection
        const validatedUsername = usernameSchema.parse(username);

        if (!validatedUsername) {
            return res.status(400).json({ error: 'username is required' });
        }

        const result = await runSherlock(validatedUsername);
        const scanId = generateScanId();

        // Add scanId to standardized response
        const responseWithId = { ...result, scanId };

        osintResults.set(scanId, {
            ...responseWithId,
            timestamp: Date.now()
        });

        // Save to database for persistence
        await saveScanResult(
            scanId,
            req.telegramId,
            'sherlock',
            validatedUsername,
            responseWithId,
            result.status,
            result.error
        );

        res.json(responseWithId);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/osint/holehe
 * Run holehe email check
 */
router.post('/holehe', osintLimiter, requireAdmin, async (req, res) => {
    try {
        const { email } = req.body;

        // Validate input to prevent command injection
        const validatedEmail = emailSchema.parse(email);

        if (!validatedEmail) {
            return res.status(400).json({ error: 'email is required' });
        }

        const result = await runHolehe(validatedEmail);
        const scanId = generateScanId();

        // Add scanId to standardized response
        const responseWithId = { ...result, scanId };

        osintResults.set(scanId, {
            ...responseWithId,
            timestamp: Date.now()
        });

        // Save to database for persistence
        await saveScanResult(
            scanId,
            req.telegramId,
            'holehe',
            validatedEmail,
            responseWithId,
            result.status,
            result.error
        );

        res.json(responseWithId);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/osint/phoneinfoga
 * Run PhoneInfoga scan
 */
router.post('/phoneinfoga', osintLimiter, requireAdmin, async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        // Validate input to prevent command injection
        const validatedPhoneNumber = phoneSchema.parse(phoneNumber);

        if (!validatedPhoneNumber) {
            return res.status(400).json({ error: 'phoneNumber is required' });
        }

        const result = await runPhoneInfoga(validatedPhoneNumber);
        const scanId = generateScanId();

        // Add scanId to standardized response
        const responseWithId = { ...result, scanId };

        osintResults.set(scanId, {
            ...responseWithId,
            timestamp: Date.now()
        });

        // Save to database for persistence
        await saveScanResult(
            scanId,
            req.telegramId,
            'phoneinfoga',
            validatedPhoneNumber,
            responseWithId,
            result.status,
            result.error
        );

        res.json(responseWithId);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/osint/scan
 * Orchestrator - run multiple OSINT tools
 */
router.post('/scan', requireAdmin, async (req, res) => {
    const { target, types, username, email, phone, domain } = req.body;

    // Validate at least one target parameter is provided
    if (!target && !username && !email && !phone && !domain) {
        return res.status(400).json(createFriendlyError(new Error('At least one target parameter is required'), {
            endpoint: '/osint/scan',
            method: 'POST'
        }));
    }

    // Validate individual parameters using existing schemas
    if (target && !targetSchema.safeParse(target).success) {
        return res.status(400).json(createFriendlyError(new Error('Invalid target format'), {
            endpoint: '/osint/scan',
            method: 'POST'
        }));
    }

    if (username && !usernameSchema.safeParse(username).success) {
        return res.status(400).json(createFriendlyError(new Error('Invalid username format'), {
            endpoint: '/osint/scan',
            method: 'POST'
        }));
    }

    if (email && !emailSchema.safeParse(email).success) {
        return res.status(400).json(createFriendlyError(new Error('Invalid email format'), {
            endpoint: '/osint/scan',
            method: 'POST'
        }));
    }

    if (phone && !phoneSchema.safeParse(phone).success) {
        return res.status(400).json(createFriendlyError(new Error('Invalid phone number format'), {
            endpoint: '/osint/scan',
            method: 'POST'
        }));
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
