/**
 * Ollama AI Client Service
 * Provides LLM integration for OSINT data summarization and analysis
 * 
 * @module ollamaClient
 */

import https from 'https';
import http from 'http';

/**
 * Available models for different tasks
 */
export const MODELS = {
    SUMMARIZE: 'llama3.2',
    ANALYZE: 'llama3.2',
    THREAT_ASSESS: 'llama3.2',
    EXTRACT_ENTITIES: 'llama3.2',
    DEFAULT: 'llama3.2'
};

/**
 * Ollama Client Class
 */
export class OllamaClient {
    constructor(options = {}) {
        this.host = options.host || process.env.OLLAMA_HOST || 'localhost';
        this.port = options.port || process.env.OLLAMA_PORT || 11434;
        this.model = options.model || process.env.OLLAMA_MODEL || MODELS.DEFAULT;
        this.timeout = options.timeout || 60000;
        this.cache = new Map();
    }

    /**
     * Get base URL
     */
    getBaseUrl() {
        return `http://${this.host}:${this.port}`;
    }

    /**
     * Make HTTP request to Ollama
     */
    async request(endpoint, data, options = {}) {
        return new Promise((resolve, reject) => {
            const url = new URL(endpoint, this.getBaseUrl());
            const protocol = url.protocol === 'https:' ? https : http;

            const reqOptions = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: options.method || 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                timeout: this.timeout
            };

            const req = protocol.request(reqOptions, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        if (res.statusCode >= 400) {
                            reject(new Error(`Ollama error: ${res.statusCode} - ${body}`));
                        } else {
                            resolve(JSON.parse(body));
                        }
                    } catch (e) {
                        resolve(body);
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Request timeout')));

            if (data) {
                req.write(JSON.stringify(data));
            }
            req.end();
        });
    }

    /**
     * Check if Ollama is available
     */
    async checkHealth() {
        try {
            const response = await this.request('/api/tags', null, { method: 'GET' });
            return {
                available: true,
                models: response.models || [],
                host: this.getBaseUrl()
            };
        } catch (error) {
            return {
                available: false,
                error: error.message,
                host: this.getBaseUrl()
            };
        }
    }

    /**
     * List available models
     */
    async listModels() {
        try {
            const response = await this.request('/api/tags', null, { method: 'GET' });
            return response.models || [];
        } catch (error) {
            return [];
        }
    }

    /**
     * Generate completion
     */
    async generate(prompt, options = {}) {
        const model = options.model || this.model;

        const payload = {
            model,
            prompt,
            stream: false,
            options: {
                temperature: options.temperature || 0.3,
                top_p: options.top_p || 0.9,
                top_k: options.top_k || 40,
                num_predict: options.maxTokens || 512,
                stop: options.stop || []
            }
        };

        try {
            const response = await this.request('/api/generate', payload);
            return {
                model: response.model,
                response: response.response,
                done: response.done,
                context: response.context,
                totalDuration: response.total_duration,
                loadDuration: response.load_duration,
                promptEvalCount: response.prompt_eval_count,
                evalCount: response.eval_count
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Chat completion
     */
    async chat(messages, options = {}) {
        const model = options.model || this.model;

        const payload = {
            model,
            messages,
            stream: false,
            options: {
                temperature: options.temperature || 0.3,
                top_p: options.top_p || 0.9,
                top_k: options.top_k || 40,
                num_predict: options.maxTokens || 512
            }
        };

        try {
            const response = await this.request('/api/chat', payload);
            return {
                model: response.model,
                message: response.message,
                done: response.done,
                totalDuration: response.total_duration
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Summarize OSINT scan results
     */
    async summarizeResults(scanResults, options = {}) {
        const prompt = this.buildSummaryPrompt(scanResults);

        const systemPrompt = `You are a cybersecurity analyst specializing in OSINT investigations. 
Analyze the provided scan results and provide a concise, actionable summary.
Focus on:
- Key findings and threats
- Risk assessment
- Recommended next steps
- Any critical alerts

Format your response as a structured report.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ];

        const result = await this.chat(messages, {
            temperature: options.temperature || 0.2,
            maxTokens: options.maxTokens || 1024
        });

        return {
            summary: result.message?.content || result.response || result.error,
            model: result.model,
            tokens: result.evalCount,
            duration: result.totalDuration
        };
    }

    /**
     * Build summary prompt from scan results
     */
    buildSummaryPrompt(results) {
        let prompt = `Please analyze the following OSINT scan results and provide a summary:\n\n`;
        prompt += `Scan ID: ${results.scanId}\n`;
        prompt += `Target: ${results.target}\n`;
        prompt += `Target Type: ${results.targetType}\n`;
        prompt += `Timestamp: ${results.timestamp}\n\n`;

        if (results.summary) {
            prompt += `Summary Statistics:\n`;
            prompt += `- Total Modules: ${results.summary.total}\n`;
            prompt += `- Successful: ${results.summary.successful}\n`;
            prompt += `- Failed: ${results.summary.failed}\n`;
            prompt += `- Risk Score: ${results.summary.riskScore}/100\n\n`;
        }

        if (results.modules && results.modules.length > 0) {
            prompt += `Module Results:\n`;
            results.modules.forEach(mod => {
                if (mod.status === 'success') {
                    prompt += `- ${mod.module}: Success`;
                    if (mod.data?.found) prompt += ` (Found: ${mod.data.found})`;
                    if (mod.data?.count) prompt += ` (Count: ${mod.data.count})`;
                    prompt += `\n`;
                } else if (mod.status === 'error') {
                    prompt += `- ${mod.module}: Error - ${mod.error}\n`;
                }
            });
        }

        prompt += `\nPlease provide a detailed analysis and recommendations.`;

        return prompt;
    }

    /**
     * Analyze threat level
     */
    async analyzeThreat(indicators, options = {}) {
        const prompt = this.buildThreatPrompt(indicators);

        const systemPrompt = `You are a threat intelligence analyst. 
Analyze the provided indicators and assess the threat level.
Provide:
- Threat level (Critical/High/Medium/Low/Info)
- Attack vectors
- Indicators of Compromise (IOCs)
- Recommended actions`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ];

        const result = await this.chat(messages, {
            temperature: 0.1,
            maxTokens: 512
        });

        return {
            analysis: result.message?.content || result.response || result.error,
            model: result.model,
            duration: result.totalDuration
        };
    }

    /**
     * Build threat analysis prompt
     */
    buildThreatPrompt(indicators) {
        let prompt = `Analyze the following threat indicators:\n\n`;

        if (indicators.ip) prompt += `IP Address: ${indicators.ip}\n`;
        if (indicators.domain) prompt += `Domain: ${indicators.domain}\n`;
        if (indicators.email) prompt += `Email: ${indicators.email}\n`;
        if (indicators.hash) prompt += `Hash: ${indicators.hash}\n`;
        if (indicators.url) prompt += `URL: ${indicators.url}\n`;

        if (indicators.tags) {
            prompt += `\nTags: ${indicators.tags.join(', ')}\n`;
        }

        if (indicators.metadata) {
            prompt += `\nMetadata: ${JSON.stringify(indicators.metadata, null, 2)}\n`;
        }

        prompt += `\nPlease assess the threat level and provide recommendations.`;

        return prompt;
    }

    /**
     * Extract entities from text
     */
    async extractEntities(text, options = {}) {
        const prompt = `Extract all relevant cybersecurity entities from the following text.
Return as JSON with keys: ips, domains, emails, hashes, urls, phone_numbers, names, organizations.

Text:
${text}`;

        const messages = [
            { role: 'system', content: 'You are a named entity recognition system. Return ONLY valid JSON.' },
            { role: 'user', content: prompt }
        ];

        const result = await this.chat(messages, {
            temperature: 0,
            maxTokens: 512
        });

        try {
            // Try to parse JSON from response
            const content = result.message?.content || result.response;
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return { error: 'Could not parse entities', raw: content };
        } catch (e) {
            return { error: e.message, raw: result.message?.content };
        }
    }

    /**
     * Generate correlation insights
     */
    async generateInsights(correlationResults, options = {}) {
        const prompt = this.buildInsightsPrompt(correlationResults);

        const systemPrompt = `You are a security operations analyst.
Analyze the correlation results and provide actionable insights.
Focus on:
- Patterns and relationships
- Priority alerts
- Investigation recommendations`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ];

        const result = await this.chat(messages, {
            temperature: 0.2,
            maxTokens: 768
        });

        return {
            insights: result.message?.content || result.response,
            alerts: correlationResults.alerts || [],
            model: result.model,
            duration: result.totalDuration
        };
    }

    /**
     * Build insights prompt
     */
    buildInsightsPrompt(results) {
        let prompt = `Analyze the following correlation results:\n\n`;

        prompt += `Total Alerts: ${results.alerts?.length || 0}\n\n`;

        if (results.alerts && results.alerts.length > 0) {
            prompt += `Alerts by Severity:\n`;
            const bySeverity = {};
            results.alerts.forEach(alert => {
                bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
            });
            Object.entries(bySeverity).forEach(([sev, count]) => {
                prompt += `- ${sev}: ${count}\n`;
            });

            prompt += `\nTop Alerts:\n`;
            results.alerts.slice(0, 5).forEach((alert, i) => {
                prompt += `${i + 1}. [${alert.severity.toUpperCase()}] ${alert.ruleName}\n`;
            });
        }

        prompt += `\nProvide detailed insights and recommendations for investigation.`;

        return prompt;
    }

    /**
     * Stream generation (for real-time output)
     */
    async *streamGenerate(prompt, options = {}) {
        const model = options.model || this.model;

        const payload = {
            model,
            prompt,
            stream: true,
            options: {
                temperature: options.temperature || 0.3,
                top_p: options.top_p || 0.9,
                num_predict: options.maxTokens || 512
            }
        };

        const response = await this.request('/api/generate', payload);

        // Simple generator for non-streaming (Ollama streams by default)
        yield { response: response.response, done: response.done };
    }

    /**
     * Get embedding for a text
     */
    async getEmbedding(text, model = 'nomic-embed-text') {
        try {
            const payload = {
                model,
                prompt: text
            };

            const response = await this.request('/api/embeddings', payload);
            return {
                embedding: response.embedding,
                model: response.model
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Generate report from multiple data sources
     */
    async generateReport(data, options = {}) {
        const prompt = this.buildReportPrompt(data);

        const systemPrompt = `You are a senior OSINT analyst.
Generate a comprehensive, professional report from the provided data.
Include:
1. Executive Summary
2. Key Findings
3. Technical Details
4. Risk Assessment
5. Recommendations
6. Appendix (if needed)

Use clear headings and professional tone.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ];

        const result = await this.chat(messages, {
            temperature: 0.2,
            maxTokens: options.maxTokens || 2048
        });

        return {
            report: result.message?.content || result.response,
            model: result.model,
            duration: result.totalDuration,
            tokens: result.evalCount
        };
    }

    /**
     * Build report prompt
     */
    buildReportPrompt(data) {
        let prompt = `Generate a comprehensive OSINT report from the following data:\n\n`;
        prompt += `=== DATA ===\n`;
        prompt += JSON.stringify(data, null, 2);
        prompt += `\n\nPlease generate a professional report.`;

        return prompt;
    }
}

export default OllamaClient;
