/**
 * Upgraded OSINT Routes
 * Enhanced API routes with all new OSINT capabilities
 * 
 * @module osintUpgraded
 */

import express from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';

import { telegramAuthMiddleware, requireAdmin } from '../middleware/telegramAuth.js';
import EnhancedScanner from '../services/osint/enhancedScanner.js';
import DarkWebScanner from '../services/osint/darkWebScanner.js';
import CorrelationEngine from '../services/osint/correlationEngine.js';
import OllamaClient from '../services/ai/ollamaClient.js';

const router = express.Router();

// Initialize services
const enhancedScanner = new EnhancedScanner({
    resultsDir: path.join(process.cwd(), 'osint-results'),
    timeout: 300000,
    maxConcurrent: 5
});

const darkWebScanner = new DarkWebScanner({
    torProxy: process.env.TOR_PROXY || 'socks5://127.0.0.1:9050',
    timeout: 30000
});

const correlationEngine = new CorrelationEngine({
    rulesDir: path.join(process.cwd(), 'correlation-rules'),
    cacheExpiry: 300000
});

const ollamaClient = new OllamaClient({
    host: process.env.OLLAMA_HOST || 'localhost',
    port: process.env.OLLAMA_PORT || 11434,
    model: process.env.OLLAMA_MODEL || 'llama3.2'
});

// Load correlation rules on startup
(async () => {
    try {
        const rulesPath = path.join(process.cwd(), 'correlation-rules.yaml');
        await correlationEngine.loadRulesFromYAML(rulesPath);
        console.log(`Loaded ${correlationEngine.rules.size} correlation rules`);
    } catch (error) {
        console.warn('Could not load correlation rules:', error.message);
    }
})();

/**
 * Generate scan ID
 */
function generateScanId() {
    return `scan_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Apply authentication
 */
router.use(telegramAuthMiddleware);

/**
 * GET /api/osint-upgraded/status
 * Get API status
 */
router.get('/status', async (req, res) => {
    try {
        const ollamaStatus = await ollamaClient.checkHealth();

        res.json({
            status: 'online',
            timestamp: new Date().toISOString(),
            services: {
                enhancedScanner: true,
                darkWebScanner: true,
                correlationEngine: correlationEngine.rules.size > 0,
                ollama: ollamaStatus.available
            },
            correlationRules: correlationEngine.getStats()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/osint-upgraded/modules
 * List available OSINT modules
 */
router.get('/modules', async (req, res) => {
    try {
        const { MODULE_CATEGORIES } = await import('../services/osint/enhancedScanner.js');

        res.json({
            categories: MODULE_CATEGORIES,
            total: Object.values(MODULE_CATEGORIES).flat().length,
            correlationRules: correlationEngine.getStats()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/osint-upgraded/scan
 * Run comprehensive OSINT scan
 */
router.post('/scan', requireAdmin, async (req, res) => {
    try {
        const { target, quick, comprehensive, categories } = req.body;

        if (!target) {
            return res.status(400).json({ error: 'target is required' });
        }

        const targetType = enhancedScanner.detectTargetType(target);

        // Determine scan mode
        const options = {
            retry: 1,
            ...(categories && { categories })
        };

        // Run scan
        let result;
        if (quick) {
            // Quick scan - limited modules
            options.categories = ['SOCIAL', 'EMAIL'];
            result = await enhancedScanner.runComprehensiveScan(target, options);
        } else if (comprehensive) {
            // Full comprehensive scan
            result = await enhancedScanner.runComprehensiveScan(target, options);
        } else {
            // Default - standard scan
            result = await enhancedScanner.runComprehensiveScan(target, options);
        }

        // Run correlation analysis
        const indicators = {
            target,
            targetType,
            riskScore: result.summary?.riskScore || 0,
            findings: result.summary?.findings || []
        };

        const correlations = await correlationEngine.evaluate(indicators);
        result.correlations = correlations;

        res.json(result);
    } catch (error) {
        console.error('Scan error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/osint-upgraded/email
 * Email OSINT lookup
 */
router.post('/email', requireAdmin, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'email is required' });
        }

        const results = {
            email,
            timestamp: new Date().toISOString(),
            checks: {}
        };

        // Run multiple email checks in parallel
        const checks = await Promise.allSettled([
            enhancedScanner.runModule('holehe', email),
            enhancedScanner.runModule('hunter', email),
            enhancedScanner.runModule('emailrep', email)
        ]);

        checks.forEach((check, index) => {
            const names = ['holehe', 'hunter', 'emailrep'];
            if (check.status === 'fulfilled') {
                results.checks[names[index]] = check.value;
            }
        });

        // Determine if breached
        results.found = Object.values(results.checks).some(c => c?.found);
        results.count = Object.values(results.checks).reduce((sum, c) => sum + (c?.count || 0), 0);
        results.isBreached = results.checks.holehe?.found || results.checks.emailrep?.isBreached;

        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/osint-upgraded/phone
 * Phone number lookup
 */
router.post('/phone', requireAdmin, async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({ error: 'phone is required' });
        }

        const result = await enhancedScanner.runModule('phoneinfoga', phone);

        res.json({
            phone,
            ...result.data || result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/osint-upgraded/domain
 * Domain research
 */
router.post('/domain', requireAdmin, async (req, res) => {
    try {
        const { domain } = req.body;

        if (!domain) {
            return res.status(400).json({ error: 'domain is required' });
        }

        const results = {
            domain,
            timestamp: new Date().toISOString(),
            checks: {}
        };

        // Run domain checks
        const checks = await Promise.allSettled([
            enhancedScanner.runModule('spiderfoot', domain, { scanType: 'domain' }),
            enhancedScanner.runModule('whois', domain),
            enhancedScanner.runModule('subfinder', domain),
            enhancedScanner.runModule('shodan', domain)
        ]);

        const names = ['spiderfoot', 'whois', 'subfinder', 'shodan'];
        checks.forEach((check, index) => {
            if (check.status === 'fulfilled') {
                results.checks[names[index]] = check.value;
            }
        });

        // Extract key data
        results.subdomains = results.checks.subfinder?.subdomains || 0;
        results.whois = results.checks.whois;

        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/osint-upgraded/username
 * Username search
 */
router.post('/username', requireAdmin, async (req, res) => {
    try {
        const { username } = req.body;

        if (!username) {
            return res.status(400).json({ error: 'username is required' });
        }

        const results = {
            username,
            timestamp: new Date().toISOString(),
            checks: {}
        };

        // Run username searches
        const checks = await Promise.allSettled([
            enhancedScanner.runModule('maigret', username),
            enhancedScanner.runModule('sherlock', username)
        ]);

        const names = ['maigret', 'sherlock'];
        checks.forEach((check, index) => {
            if (check.status === 'fulfilled') {
                results.checks[names[index]] = check.value;
            }
        });

        // Aggregate results
        results.found = results.checks.maigret?.found || results.checks.sherlock?.found;
        results.count = (results.checks.maigret?.count || 0) + (results.checks.sherlock?.count || 0);

        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/osint-upgraded/darkweb/search
 * Dark web search
 */
router.post('/darkweb/search', requireAdmin, async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'query is required' });
        }

        const result = await darkWebScanner.searchDarkWeb(query);

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/osint-upgraded/darkweb/scan
 * Scan onion service
 */
router.post('/darkweb/scan', requireAdmin, async (req, res) => {
    try {
        const { onionUrl } = req.body;

        if (!onionUrl || !onionUrl.includes('.onion')) {
            return res.status(400).json({ error: 'Valid .onion URL is required' });
        }

        const result = await darkWebScanner.scanOnionService(onionUrl);

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/osint-upgraded/threat
 * Check threat intelligence feeds
 */
router.post('/threat', requireAdmin, async (req, res) => {
    try {
        const { indicator } = req.body;

        if (!indicator) {
            return res.status(400).json({ error: 'indicator is required' });
        }

        const result = await darkWebScanner.checkThreatFeeds(indicator);

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/osint-upgraded/correlate
 * Run correlation analysis
 */
router.post('/correlate', requireAdmin, async (req, res) => {
    try {
        const { indicators, context } = req.body;

        if (!indicators) {
            return res.status(400).json({ error: 'indicators are required' });
        }

        const result = await correlationEngine.evaluate(indicators, context);

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/osint-upgraded/correlation/rules
 * Get correlation rules
 */
router.get('/correlation/rules', async (req, res) => {
    try {
        const stats = correlationEngine.getStats();
        const rules = correlationEngine.getEnabledRules().map(r => ({
            id: r.id,
            name: r.name,
            type: r.type,
            severity: r.severity,
            tags: r.tags
        }));

        res.json({ stats, rules });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/osint-upgraded/analyze/:scanId
 * AI analysis of scan results
 */
router.get('/analyze/:scanId', requireAdmin, async (req, res) => {
    try {
        const { scanId } = req.params;

        // Load scan results
        const results = await enhancedScanner.loadResults(scanId);

        if (!results) {
            return res.status(404).json({ error: 'Scan not found' });
        }

        // Get AI summary
        const summary = await ollamaClient.summarizeResults(results);

        res.json({
            scanId,
            summary: summary.summary,
            model: summary.model,
            duration: summary.duration
        });
    } catch (error) {
        console.error('Analyze error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/osint-upgraded/analyze/threat
 * AI threat analysis
 */
router.post('/analyze/threat', requireAdmin, async (req, res) => {
    try {
        const { indicators } = req.body;

        if (!indicators) {
            return res.status(400).json({ error: 'indicators are required' });
        }

        const analysis = await ollamaClient.analyzeThreat(indicators);

        res.json({
            analysis: analysis.analysis,
            model: analysis.model,
            duration: analysis.duration
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/osint-upgraded/analyze/insights
 * AI-powered insights
 */
router.post('/analyze/insights', requireAdmin, async (req, res) => {
    try {
        const { scanResults, correlationResults } = req.body;

        if (!scanResults && !correlationResults) {
            return res.status(400).json({ error: 'scanResults or correlationResults required' });
        }

        let result;
        if (correlationResults) {
            result = await ollamaClient.generateInsights(correlationResults);
        } else {
            result = await ollamaClient.summarizeResults(scanResults);
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/osint-upgraded/analyze/report
 * Generate full report
 */
router.post('/analyze/report', requireAdmin, async (req, res) => {
    try {
        const { scanId } = req.body;

        if (!scanId) {
            return res.status(400).json({ error: 'scanId is required' });
        }

        // Load scan results
        const results = await enhancedScanner.loadResults(scanId);

        if (!results) {
            return res.status(404).json({ error: 'Scan not found' });
        }

        // Generate report
        const report = await ollamaClient.generateReport(results);

        res.json({
            scanId,
            report: report.report,
            model: report.model,
            duration: report.duration,
            tokens: report.tokens
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/osint-upgraded/scan/:scanId
 * Get scan results
 */
router.get('/scan/:scanId', async (req, res) => {
    try {
        const { scanId } = req.params;

        const results = await enhancedScanner.loadResults(scanId);

        if (!results) {
            return res.status(404).json({ error: 'Scan not found' });
        }

        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/osint-upgraded/history
 * Get scan history
 */
router.get('/history', async (req, res) => {
    try {
        const history = enhancedScanner.getHistory(20);
        res.json({ history });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/osint-upgraded/health/ollama
 * Check Ollama status
 */
router.get('/health/ollama', async (req, res) => {
    try {
        const status = await ollamaClient.checkHealth();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/osint-upgraded/extract
 * Extract entities from text
 */
router.post('/extract', requireAdmin, async (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'text is required' });
        }

        const entities = await ollamaClient.extractEntities(text);

        res.json({
            entities,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
