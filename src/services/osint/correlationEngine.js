/**
 * Correlation Engine Service
 * Provides YAML-based correlation rules engine for threat intelligence
 * 
 * @module correlationEngine
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

/**
 * Correlation Rule Types
 */
export const RULE_TYPES = {
    INDICATOR_MATCH: 'indicator_match',
    THRESHOLD: 'threshold',
    SEQUENCE: 'sequence',
    ANOMALY: 'anomaly',
    ENRICHMENT: 'enrichment'
};

/**
 * Severity Levels
 */
export const SEVERITY = {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
    INFO: 'info'
};

/**
 * Correlation Engine Class
 */
export class CorrelationEngine {
    constructor(options = {}) {
        this.rulesDir = options.rulesDir || path.join(process.cwd(), 'correlation-rules');
        this.rules = new Map();
        this.cache = new Map();
        this.cacheExpiry = options.cacheExpiry || 300000; // 5 minutes
    }

    /**
     * Load rules from YAML file
     */
    async loadRulesFromYAML(filePath) {
        try {
            const yaml = await import('yaml').catch(() => null);
            if (!yaml) {
                console.warn('YAML parser not available, loading as JSON');
                return this.loadRulesFromJSON(filePath);
            }

            const content = await fs.readFile(filePath, 'utf-8');
            const parsed = yaml.parse(content);

            if (parsed?.rules) {
                for (const rule of parsed.rules) {
                    this.addRule(rule);
                }
            }

            return { loaded: parsed?.rules?.length || 0, rules: this.rules.size };
        } catch (error) {
            console.error('Error loading YAML rules:', error.message);
            return { error: error.message };
        }
    }

    /**
     * Load rules from JSON file
     */
    async loadRulesFromJSON(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const parsed = JSON.parse(content);

            if (parsed?.rules) {
                for (const rule of parsed.rules) {
                    this.addRule(rule);
                }
            }

            return { loaded: parsed?.rules?.length || 0, rules: this.rules.size };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Add a correlation rule
     */
    addRule(rule) {
        if (!rule.id) {
            rule.id = crypto.randomBytes(8).toString('hex');
        }

        // Normalize rule structure
        const normalizedRule = {
            id: rule.id,
            name: rule.name || 'Unnamed Rule',
            description: rule.description || '',
            type: rule.type || RULE_TYPES.INDICATOR_MATCH,
            severity: rule.severity || SEVERITY.MEDIUM,
            enabled: rule.enabled !== false,
            tags: rule.tags || [],
            conditions: this.normalizeConditions(rule.conditions || rule.condition),
            actions: rule.actions || [],
            confidence: rule.confidence || 0.5,
            ttl: rule.ttl || 3600,
            metadata: rule.metadata || {}
        };

        this.rules.set(normalizedRule.id, normalizedRule);
        return normalizedRule.id;
    }

    /**
     * Normalize conditions to array format
     */
    normalizeConditions(conditions) {
        if (!conditions) return [];
        if (Array.isArray(conditions)) return conditions;
        if (typeof conditions === 'string') return [{ expression: conditions }];
        if (typeof conditions === 'object') return [conditions];
        return [];
    }

    /**
     * Remove a rule
     */
    removeRule(ruleId) {
        return this.rules.delete(ruleId);
    }

    /**
     * Get rule by ID
     */
    getRule(ruleId) {
        return this.rules.get(ruleId);
    }

    /**
     * Get all enabled rules
     */
    getEnabledRules() {
        return Array.from(this.rules.values()).filter(r => r.enabled);
    }

    /**
     * Get rules by tag
     */
    getRulesByTag(tag) {
        return Array.from(this.rules.values()).filter(r => r.tags.includes(tag));
    }

    /**
     * Get rules by type
     */
    getRulesByType(type) {
        return Array.from(this.rules.values()).filter(r => r.type === type);
    }

    /**
     * Evaluate indicators against rules
     */
    async evaluate(indicators, context = {}) {
        const results = {
            timestamp: new Date().toISOString(),
            indicators,
            matchedRules: [],
            alerts: [],
            enrichedData: {}
        };

        const enabledRules = this.getEnabledRules();

        for (const rule of enabledRules) {
            const match = await this.evaluateRule(rule, indicators, context);

            if (match.matched) {
                const alert = this.createAlert(rule, match, indicators);
                results.matchedRules.push({ rule: rule.id, ...match });
                results.alerts.push(alert);

                // Collect enrichment data
                if (rule.type === RULE_TYPES.ENRICHMENT) {
                    results.enrichedData[rule.id] = match.enrichment;
                }
            }
        }

        // Sort alerts by severity
        results.alerts.sort((a, b) => {
            const severityOrder = { [SEVERITY.CRITICAL]: 0, [SEVERITY.HIGH]: 1, [SEVERITY.MEDIUM]: 2, [SEVERITY.LOW]: 3, [SEVERITY.INFO]: 4 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });

        return results;
    }

    /**
     * Evaluate a single rule
     */
    async evaluateRule(rule, indicators, context) {
        const cacheKey = this.getCacheKey(rule.id, indicators);

        // Check cache
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.result;
        }

        let result = { matched: false, confidence: 0, details: null };

        try {
            switch (rule.type) {
                case RULE_TYPES.INDICATOR_MATCH:
                    result = await this.evaluateIndicatorMatch(rule, indicators);
                    break;
                case RULE_TYPES.THRESHOLD:
                    result = await this.evaluateThreshold(rule, indicators, context);
                    break;
                case RULE_TYPES.SEQUENCE:
                    result = await this.evaluateSequence(rule, indicators, context);
                    break;
                case RULE_TYPES.ANOMALY:
                    result = await this.evaluateAnomaly(rule, indicators, context);
                    break;
                case RULE_TYPES.ENRICHMENT:
                    result = await this.evaluateEnrichment(rule, indicators, context);
                    break;
                default:
                    result = { matched: false, error: 'Unknown rule type' };
            }
        } catch (error) {
            result = { matched: false, error: error.message };
        }

        // Cache result
        this.cache.set(cacheKey, { timestamp: Date.now(), result });

        return result;
    }

    /**
     * Evaluate indicator match rules
     */
    async evaluateIndicatorMatch(rule, indicators) {
        const conditions = rule.conditions;

        for (const condition of conditions) {
            const { field, operator, value, pattern } = condition;

            // Get indicator value
            let indicatorValue = this.getNestedValue(indicators, field);

            if (!indicatorValue && field.includes('.')) {
                // Try without prefix
                const parts = field.split('.');
                indicatorValue = this.getNestedValue(indicators, parts[parts.length - 1]);
            }

            if (indicatorValue === undefined || indicatorValue === null) {
                continue;
            }

            let matched = false;

            switch (operator) {
                case 'equals':
                    matched = indicatorValue === value;
                    break;
                case 'contains':
                    matched = String(indicatorValue).includes(value);
                    break;
                case 'regex':
                    matched = new RegExp(pattern || value, 'i').test(String(indicatorValue));
                    break;
                case 'startsWith':
                    matched = String(indicatorValue).startsWith(value);
                    break;
                case 'endsWith':
                    matched = String(indicatorValue).endsWith(value);
                    break;
                case 'in':
                    matched = Array.isArray(value) && value.includes(indicatorValue);
                    break;
                case 'gt':
                case 'gte':
                case 'lt':
                case 'lte':
                    const num = Number(indicatorValue);
                    const target = Number(value);
                    if (!isNaN(num) && !isNaN(target)) {
                        matched = operator === 'gt' ? num > target :
                            operator === 'gte' ? num >= target :
                                operator === 'lt' ? num < target :
                                    num <= target;
                    }
                    break;
                default:
                    matched = false;
            }

            if (matched) {
                return {
                    matched: true,
                    confidence: rule.confidence,
                    details: { field, operator, value, matched: indicatorValue },
                    condition: condition
                };
            }
        }

        return { matched: false, confidence: 0 };
    }

    /**
     * Evaluate threshold rules
     */
    async evaluateThreshold(rule, indicators, context) {
        const conditions = rule.conditions;

        for (const condition of conditions) {
            const { field, threshold, operator } = condition;

            const value = this.getNestedValue(indicators, field) ||
                this.getNestedValue(context, field);

            if (value === undefined || value === null) continue;

            const numValue = Number(value);
            const numThreshold = Number(threshold);

            if (isNaN(numValue) || isNaN(numThreshold)) continue;

            let matched = false;
            switch (operator) {
                case 'gt': matched = numValue > numThreshold; break;
                case 'gte': matched = numValue >= numThreshold; break;
                case 'lt': matched = numValue < numThreshold; break;
                case 'lte': matched = numValue <= numThreshold; break;
                case 'eq': matched = numValue === numThreshold; break;
            }

            if (matched) {
                return {
                    matched: true,
                    confidence: rule.confidence,
                    details: { field, value: numValue, threshold: numThreshold, operator },
                    enrichment: { threshold: { field, value: numValue, threshold: numThreshold } }
                };
            }
        }

        return { matched: false, confidence: 0 };
    }

    /**
     * Evaluate sequence rules
     */
    async evaluateSequence(rule, indicators, context) {
        const conditions = rule.conditions;
        let matchCount = 0;
        const matches = [];

        for (const condition of conditions) {
            const { field, value, optional } = condition;
            const indicatorValue = this.getNestedValue(indicators, field);

            if (indicatorValue !== undefined && indicatorValue !== null) {
                const strValue = String(indicatorValue).toLowerCase();
                const strTarget = String(value).toLowerCase();

                if (strValue.includes(strTarget) || strValue === strTarget) {
                    matchCount++;
                    matches.push({ field, value: indicatorValue });
                }
            } else if (!optional) {
                return { matched: false, confidence: 0 };
            }
        }

        const requiredCount = conditions.filter(c => !c.optional).length;
        const matched = matchCount >= requiredCount;

        return {
            matched,
            confidence: matched ? rule.confidence * (matchCount / conditions.length) : 0,
            details: { matches, matchCount, requiredCount },
            enrichment: matched ? { sequence: matches } : null
        };
    }

    /**
     * Evaluate anomaly rules
     */
    async evaluateAnomaly(rule, indicators, context) {
        const conditions = rule.conditions;

        for (const condition of condition) {
            const { field, baseline, deviation } = condition;

            const value = this.getNestedValue(indicators, field);
            const baselineValue = baseline || this.getNestedValue(context, `baseline.${field}`);

            if (value === undefined || baselineValue === undefined) continue;

            const deviationThreshold = deviation || 2; // Standard deviations
            const diff = Math.abs(Number(value) - Number(baselineValue));

            // Simple deviation check
            if (diff > deviationThreshold * 10) { // Assuming baseline is 10 for simplicity
                return {
                    matched: true,
                    confidence: rule.confidence,
                    details: { field, value, baseline: baselineValue, deviation: diff },
                    enrichment: { anomaly: { field, value, baseline: baselineValue } }
                };
            }
        }

        return { matched: false, confidence: 0 };
    }

    /**
     * Evaluate enrichment rules
     */
    async evaluateEnrichment(rule, indicators, context) {
        const conditions = rule.conditions;

        // For enrichment, we always return matched but with enrichment data
        const enrichment = {};

        for (const condition of conditions) {
            const { field, enrichWith } = condition;
            const value = this.getNestedValue(indicators, field);

            if (value) {
                enrichment[field] = {
                    original: value,
                    enriched: true,
                    metadata: enrichWith
                };
            }
        }

        return {
            matched: Object.keys(enrichment).length > 0,
            confidence: rule.confidence,
            details: { enriched: Object.keys(enrichment) },
            enrichment
        };
    }

    /**
     * Get nested value from object
     */
    getNestedValue(obj, path) {
        if (!obj || !path) return undefined;

        const parts = path.split('.');
        let current = obj;

        for (const part of parts) {
            if (current === undefined || current === null) return undefined;
            current = current[part];
        }

        return current;
    }

    /**
     * Get cache key
     */
    getCacheKey(ruleId, indicators) {
        const hash = crypto.createHash('md5')
            .update(JSON.stringify(indicators))
            .digest('hex');
        return `${ruleId}:${hash}`;
    }

    /**
     * Create alert from matched rule
     */
    createAlert(rule, match, indicators) {
        return {
            id: crypto.randomBytes(8).toString('hex'),
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            timestamp: new Date().toISOString(),
            confidence: match.confidence,
            details: match.details,
            indicators,
            tags: rule.tags,
            actions: rule.actions,
            metadata: rule.metadata
        };
    }

    /**
     * Execute actions for alerts
     */
    async executeActions(alert, options = {}) {
        const results = [];

        for (const action of alert.actions || []) {
            try {
                let result;

                switch (action.type) {
                    case 'log':
                        console.log(`[ALERT] ${alert.ruleName}:`, action.message || alert.details);
                        result = { type: 'log', success: true };
                        break;
                    case 'webhook':
                        result = await this.executeWebhook(action.url, alert);
                        break;
                    case 'notify':
                        result = await this.executeNotification(action, alert);
                        break;
                    case 'block':
                        result = { type: 'block', success: true, message: 'Block action recorded' };
                        break;
                    case 'enrich':
                        result = { type: 'enrich', success: true };
                        break;
                    default:
                        result = { type: action.type, success: false, error: 'Unknown action type' };
                }

                results.push(result);
            } catch (error) {
                results.push({ type: action.type, success: false, error: error.message });
            }
        }

        return results;
    }

    /**
     * Execute webhook action
     */
    async executeWebhook(url, data) {
        const https = await import('https');

        return new Promise((resolve, reject) => {
            const req = https.request(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => resolve({ status: res.statusCode, body }));
            });

            req.on('error', reject);
            req.write(JSON.stringify(data));
            req.end();
        });
    }

    /**
     * Execute notification action
     */
    async executeNotification(action, alert) {
        // Placeholder for notification integrations
        return {
            type: 'notification',
            success: true,
            method: action.method || 'console',
            message: `Alert: ${alert.ruleName} - ${alert.severity}`
        };
    }

    /**
     * Get engine statistics
     */
    getStats() {
        const rules = Array.from(this.rules.values());

        return {
            totalRules: rules.length,
            enabledRules: rules.filter(r => r.enabled).length,
            byType: {
                indicator_match: rules.filter(r => r.type === RULE_TYPES.INDICATOR_MATCH).length,
                threshold: rules.filter(r => r.type === RULE_TYPES.THRESHOLD).length,
                sequence: rules.filter(r => r.type === RULE_TYPES.SEQUENCE).length,
                anomaly: rules.filter(r => r.type === RULE_TYPES.ANOMALY).length,
                enrichment: rules.filter(r => r.type === RULE_TYPES.ENRICHMENT).length
            },
            bySeverity: {
                critical: rules.filter(r => r.severity === SEVERITY.CRITICAL).length,
                high: rules.filter(r => r.severity === SEVERITY.HIGH).length,
                medium: rules.filter(r => r.severity === SEVERITY.MEDIUM).length,
                low: rules.filter(r => r.severity === SEVERITY.LOW).length,
                info: rules.filter(r => r.severity === SEVERITY.INFO).length
            },
            cacheSize: this.cache.size
        };
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Export rules to JSON
     */
    async exportRules(filePath) {
        const rules = Array.from(this.rules.values());
        await fs.writeFile(filePath, JSON.stringify({ rules }, null, 2));
        return { exported: rules.length };
    }
}

export default CorrelationEngine;
