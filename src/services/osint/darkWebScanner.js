/**
 * Dark Web Scanner Service
 * Provides Tor/dark-web scanning capabilities for OSINT investigations
 * 
 * @module darkWebScanner
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import https from 'https';
import http from 'http';
import { URL } from 'url';

const execAsync = promisify(exec);

/**
 * Dark Web Scanner Class
 */
export class DarkWebScanner {
    constructor(options = {}) {
        this.torProxy = options.torProxy || process.env.TOR_PROXY || 'socks5://127.0.0.1:9050';
        this.timeout = options.timeout || 30000;
        this.maxRetries = options.maxRetries || 3;
    }

    /**
     * HTTP Request with Tor proxy support
     */
    async torRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const isHttps = url.startsWith('https');
            const protocol = isHttps ? https : http;

            const opts = {
                hostname: '127.0.0.1',
                port: 9050,
                path: url,
                method: options.method || 'GET',
                headers: options.headers || {},
                timeout: this.timeout,
                agent: new (isHttps ? https : http).Agent({
                    rejectUnauthorized: false
                })
            };

            const req = protocol.request(opts, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({ status: res.statusCode, data, headers: res.headers });
                });
            });

            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Request timeout')));
            req.end();
        });
    }

    /**
     * Regular HTTP request
     */
    async httpRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const isHttps = url.startsWith('https');
            const protocol = isHttps ? https : http;

            const opts = {
                hostname: new URL(url).hostname,
                port: isHttps ? 443 : 80,
                path: new URL(url).pathname + new URL(url).search,
                method: options.method || 'GET',
                headers: options.headers || {},
                timeout: this.timeout
            };

            const req = protocol.request(opts, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({ status: res.statusCode, data, headers: res.headers });
                });
            });

            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Request timeout')));
            req.end();
        });
    }

    /**
     * Search dark web using multiple engines
     */
    async searchDarkWeb(query, options = {}) {
        const results = {
            query,
            timestamp: new Date().toISOString(),
            engines: [],
            totalResults: 0
        };

        // Try multiple dark web search engines
        const engines = [
            this.searchAhmia(query),
            this.searchDarksearch(query),
            this.searchTorch(query),
            this.searchNotEvil(query),
            this.searchHaystak(query)
        ];

        const engineResults = await Promise.allSettled(engines);

        engineResults.forEach((result, index) => {
            const engineNames = ['ahmia', 'darksearch', 'torch', 'notevil', 'haystak'];
            if (result.status === 'fulfilled') {
                results.engines.push({ name: engineNames[index], ...result.value });
                results.totalResults += result.value.count || 0;
            } else {
                results.engines.push({ name: engineNames[index], error: result.reason.message });
            }
        });

        return results;
    }

    /**
     * Search Ahmia dark web search engine
     */
    async searchAhmia(query) {
        try {
            const url = `https://ahmia.fi/search/?q=${encodeURIComponent(query)}&page=1`;
            const response = await this.httpRequest(url);

            // Parse HTML results (simplified)
            const results = this.parseAhmiaResults(response.data);

            return {
                engine: 'ahmia',
                url,
                count: results.length,
                results,
                onionServices: results.filter(r => r.url.includes('.onion')).length
            };
        } catch (error) {
            return { engine: 'ahmia', error: error.message, count: 0 };
        }
    }

    /**
     * Parse Ahmia HTML results
     */
    parseAhmiaResults(html) {
        const results = [];
        const titleRegex = /<a class="result-title"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
        let match;

        while ((match = titleRegex.exec(html)) !== null && results.length < 20) {
            results.push({
                url: match[1],
                title: match[2].trim(),
                isOnion: match[1].includes('.onion')
            });
        }

        return results;
    }

    /**
     * Search DarkSearch API
     */
    async searchDarksearch(query) {
        try {
            const url = `https://darksearch.io/api/search?query=${encodeURIComponent(query)}&page=1`;
            const response = await this.httpRequest(url);
            const data = JSON.parse(response.data);

            return {
                engine: 'darksearch',
                url,
                count: data.total || 0,
                results: data.data || [],
                onionServices: (data.data || []).filter(r => r.link?.includes('.onion')).length
            };
        } catch (error) {
            return { engine: 'darksearch', error: error.message, count: 0 };
        }
    }

    /**
     * Search Torch dark web engine
     */
    async searchTorch(query) {
        try {
            const url = `http://xmh57jrzrnw6insl.onion/search?q=${encodeURIComponent(query)}&btnG=Search`;
            const response = await this.torRequest(url);

            const results = this.parseTorchResults(response.data);

            return {
                engine: 'torch',
                url,
                count: results.length,
                results,
                onionServices: results.length
            };
        } catch (error) {
            return { engine: 'torch', error: error.message, count: 0 };
        }
    }

    /**
     * Parse Torch results
     */
    parseTorchResults(html) {
        const results = [];
        const linkRegex = /<a href="(http[^"]+)">([^<]+)<\/a>/gi;
        let match;

        while ((match = linkRegex.exec(html)) !== null && results.length < 20) {
            if (match[1].includes('.onion')) {
                results.push({
                    url: match[1],
                    title: match[2].trim()
                });
            }
        }

        return results;
    }

    /**
     * Search NotEvil dark web engine
     */
    async searchNotEvil(query) {
        try {
            const url = `http://hss3uro2hsxfogfq.onion/?q=${encodeURIComponent(query)}&btnG=Search`;
            const response = await this.torRequest(url);

            return {
                engine: 'notevil',
                url,
                count: 0,
                results: [],
                note: 'Requires Tor browser to access'
            };
        } catch (error) {
            return { engine: 'notevil', error: error.message, count: 0 };
        }
    }

    /**
     * Search Haystak dark web engine
     */
    async searchHaystak(query) {
        try {
            const url = `http://haystakvxj7xjbk3.onion/search?q=${encodeURIComponent(query)}`;
            const response = await this.torRequest(url);

            return {
                engine: 'haystak',
                url,
                count: 0,
                results: [],
                note: 'Requires Tor network'
            };
        } catch (error) {
            return { engine: 'haystak', error: error.message, count: 0 };
        }
    }

    /**
     * Check if IP is a Tor exit node
     */
    async checkTorExitNode(ip) {
        try {
            const url = `https://check.torproject.org/cgi-bin/TorBulkExitList.py?ip=${ip}`;
            const response = await this.httpRequest(url);

            const isExit = response.data.includes(ip);

            return {
                ip,
                isTorExitNode: isExit,
                checkedAt: new Date().toISOString(),
                source: 'torproject.org'
            };
        } catch (error) {
            return { ip, isTorExitNode: null, error: error.message };
        }
    }

    /**
     * Get current Tor circuit information
     */
    async getTorCircuitInfo() {
        try {
            const cmd = `echo "GETINFO circuit-status" | nc localhost 9051`;
            const { stdout } = await execAsync(cmd, { timeout: 10000 });

            return {
                status: 'connected',
                circuits: stdout.split('\n').filter(l => l.trim()),
                checkedAt: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'not_connected',
                error: error.message,
                message: 'Make sure Tor is running (socks proxy on 127.0.0.1:9050)'
            };
        }
    }

    /**
     * Scan onion service for basic info
     */
    async scanOnionService(onionUrl, options = {}) {
        if (!onionUrl.includes('.onion')) {
            return { error: 'Not a valid .onion URL' };
        }

        const results = {
            url: onionUrl,
            timestamp: new Date().toISOString(),
            checks: {}
        };

        // Basic connectivity check
        try {
            const response = await this.torRequest(onionUrl, { timeout: options.timeout || 15000 });
            results.checks.connectivity = {
                status: response.status,
                reachable: response.status === 200,
                headers: response.headers,
                contentLength: response.data?.length || 0
            };

            // Extract title if HTML
            if (response.headers['content-type']?.includes('text/html')) {
                const titleMatch = response.data.match(/<title>([^<]+)<\/title>/i);
                results.checks.title = titleMatch ? titleMatch[1].trim() : null;

                // Count links
                const linkCount = (response.data.match(/<a /gi) || []).length;
                results.checks.links = linkCount;
            }
        } catch (error) {
            results.checks.connectivity = {
                reachable: false,
                error: error.message
            };
        }

        // SSL/TLS check (for HSv3)
        if (onionUrl.startsWith('https://')) {
            results.checks.tls = {
                note: 'Onion services use self-signed certificates'
            };
        }

        return results;
    }

    /**
     * Breach database search
     */
    async searchBreachDatabases(email) {
        const results = {
            email,
            timestamp: new Date().toISOString(),
            databases: []
        };

        // Check multiple breach databases
        const checks = [
            this.checkDehashed(email),
            this.checkBreachDirectory(email),
            this.checkHudsonRock(email)
        ];

        const checkResults = await Promise.allSettled(checks);

        checkResults.forEach((result, index) => {
            const dbNames = ['dehashed', 'breachdirectory', 'hudsonrock'];
            if (result.status === 'fulfilled') {
                results.databases.push({ name: dbNames[index], ...result.value });
            } else {
                results.databases.push({ name: dbNames[index], error: result.reason.message });
            }
        });

        results.totalBreaches = results.databases.reduce((sum, db) => sum + (db.count || 0), 0);

        return results;
    }

    /**
     * Check Dehashed
     */
    async checkDehashed(email) {
        const apiKey = process.env.DEHASHED_API_KEY;
        if (!apiKey) return { found: false, error: 'No API key' };

        return { found: false, note: 'Dehashed requires subscription' };
    }

    /**
     * Check BreachDirectory
     */
    async checkBreachDirectory(email) {
        const apiKey = process.env.BREACHDIRECTORY_API_KEY;
        if (!apiKey) return { found: false, error: 'No API key' };

        return { found: false, note: 'BreachDirectory requires API key' };
    }

    /**
     * Check HudsonRock
     */
    async checkHudsonRock(email) {
        try {
            const url = `https://api.hudsonrock.com/api/v4/gp/search?search=${encodeURIComponent(email)}`;
            const response = await this.httpRequest(url);
            const data = JSON.parse(response.data);

            return {
                found: data.total > 0,
                count: data.total || 0,
                results: data.compromised_accounts || []
            };
        } catch (error) {
            return { found: false, error: error.message };
        }
    }

    /**
     * Check if domain/IP is flagged in threat intelligence feeds
     */
    async checkThreatFeeds(indicator) {
        const results = {
            indicator,
            timestamp: new Date().toISOString(),
            feeds: []
        };

        const feeds = [
            this.checkAlienVault(indicator),
            this.checkAbuseIPDB(indicator),
            this.checkURLhaus(indicator),
            this.checkThreatFox(indicator)
        ];

        const feedResults = await Promise.allSettled(feeds);

        feedResults.forEach((result, index) => {
            const feedNames = ['alienvault', 'abuseipdb', 'urlhaus', 'threatfox'];
            if (result.status === 'fulfilled') {
                results.feeds.push({ name: feedNames[index], ...result.value });
            } else {
                results.feeds.push({ name: feedNames[index], error: result.reason.message });
            }
        });

        results.maliciousCount = results.feeds.reduce((sum, feed) => sum + (feed.malicious || 0), 0);

        return results;
    }

    /**
     * Check Alien Vault OTX
     */
    async checkAlienVault(indicator) {
        const apiKey = process.env.ALIENVAULT_API_KEY;
        if (!apiKey) return { found: false, error: 'No API key' };

        try {
            const url = `https://otx.alienvault.com/api/v1/indicators/domain/${indicator}/general`;
            const response = await this.httpRequest(url, { headers: { 'X-OTX-API-KEY': apiKey } });
            const data = JSON.parse(response.data);

            return {
                pulseCount: data.pulse_count || 0,
                malicious: data.pulse_count > 0,
                malware: data.alerts || [],
                tags: data.tags || []
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Check AbuseIPDB
     */
    async checkAbuseIPDB(ip) {
        const apiKey = process.env.ABUSEIPDB_API_KEY;
        if (!apiKey) return { found: false, error: 'No API key' };

        try {
            const url = `https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90&verbose=`;
            const response = await this.httpRequest(url, {
                headers: { 'Key': apiKey, 'Accept': 'application/json' }
            });
            const data = JSON.parse(response.data);

            return {
                malicious: data.data?.abuseConfidenceScore > 50,
                confidenceScore: data.data?.abuseConfidenceScore || 0,
                reports: data.data?.totalReports || 0,
                ip: data.data?.ipAddress
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Check URLhaus
     */
    async checkURLhaus(url) {
        try {
            const checkUrl = `https://urlhaus-api.abuse.ch/v1/host/${encodeURIComponent(url)}`;
            const response = await this.httpRequest(checkUrl);
            const data = JSON.parse(response.data);

            return {
                malicious: data.query_status === 'malicious',
                threat: data.threat || null,
                urls: data.urls || [],
                count: data.urls?.length || 0
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Check ThreatFox
     */
    async checkThreatFox(indicator) {
        try {
            const url = `https://threatfox-api.abuse.ch/api/v1/`;
            const postData = JSON.stringify({ query: 'search_ioc', search_term: indicator });

            const response = await this.httpRequest(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                data: postData
            });
            const data = JSON.parse(response.data);

            return {
                malicious: data.query_status === 'ok' && data.results?.length > 0,
                count: data.results?.length || 0,
                malware: data.results?.[0]?.malware || null
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Monitor dark web for keywords
     */
    async monitorKeywords(keywords, options = {}) {
        const results = {
            keywords,
            timestamp: new Date().toISOString(),
            matches: []
        };

        for (const keyword of keywords) {
            try {
                const searchResults = await this.searchDarkWeb(keyword, options);
                results.matches.push({
                    keyword,
                    totalResults: searchResults.totalResults,
                    sources: searchResults.engines.length
                });
            } catch (error) {
                results.matches.push({ keyword, error: error.message });
            }
        }

        return results;
    }
}

export default DarkWebScanner;
