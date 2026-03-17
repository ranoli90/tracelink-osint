/**
 * Structured Logging for OSINT Operations
 * 
 * This module provides structured logging with different log levels,
 * context information, and performance metrics for OSINT operations.
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

// Log levels with priority
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Current log level (can be set via environment variable)
const CURRENT_LOG_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] || LOG_LEVELS.INFO;

// Log categories for OSINT operations
const LOG_CATEGORIES = {
  OSINT_SCAN: 'osint_scan',
  OSINT_TOOL: 'osint_tool',
  OSINT_RESULT: 'osint_result',
  OSINT_ERROR: 'osint_error',
  OSINT_PERFORMANCE: 'osint_performance',
  OSINT_SECURITY: 'osint_security',
  OSINT_VALIDATION: 'osint_validation',
  OSINT_DATABASE: 'osint_database',
  OSINT_CACHE: 'osint_cache'
};

// Log file paths
const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILES = {
  error: path.join(LOG_DIR, 'osint-error.log'),
  warn: path.join(LOG_DIR, 'osint-warn.log'),
  info: path.join(LOG_DIR, 'osint-info.log'),
  debug: path.join(LOG_DIR, 'osint-debug.log'),
  performance: path.join(LOG_DIR, 'osint-performance.log'),
  security: path.join(LOG_DIR, 'osint-security.log')
};

/**
 * Ensure log directory exists
 */
async function ensureLogDir() {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
  } catch (error) {
    // Directory already exists or permission issue
    if (error.code !== 'EEXIST') {
      console.error('Failed to create log directory:', error);
    }
  }
}

/**
 * Generate a unique log entry ID
 */
function generateLogId() {
  return crypto.randomBytes(8).toString('hex').toUpperCase();
}

/**
 * Create a structured log entry
 */
function createLogEntry(level, category, message, context = {}, metadata = {}) {
  const logEntry = {
    id: generateLogId(),
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    context: {
      userId: context.userId,
      telegramId: context.telegramId,
      scanId: context.scanId,
      tool: context.tool,
      target: context.target,
      endpoint: context.endpoint,
      method: context.method,
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId
    },
    metadata: {
      duration: metadata.duration,
      resultCount: metadata.resultCount,
      success: metadata.success,
      error: metadata.error,
      stack: metadata.stack,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      platform: process.platform,
      nodeVersion: process.version,
      pid: process.pid
    },
    tags: metadata.tags || []
  };

  // Remove undefined values to keep logs clean
  return removeUndefinedValues(logEntry);
}

/**
 * Remove undefined values from object
 */
function removeUndefinedValues(obj) {
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        cleaned[key] = removeUndefinedValues(value);
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned;
}

/**
 * Write log entry to file
 */
async function writeLogToFile(logEntry, level) {
  try {
    const logLine = JSON.stringify(logEntry) + '\n';
    const logFile = LOG_FILES[level];
    
    await fs.appendFile(logFile, logLine, 'utf-8');
  } catch (error) {
    console.error('Failed to write log to file:', error);
  }
}

/**
 * Check if log level should be processed
 */
function shouldLog(level) {
  return LOG_LEVELS[level] <= CURRENT_LOG_LEVEL;
}

/**
 * Core logging function
 */
async function log(level, category, message, context = {}, metadata = {}) {
  if (!shouldLog(level)) {
    return;
  }

  const logEntry = createLogEntry(level, category, message, context, metadata);

  // Always log to console with appropriate formatting
  const consoleMessage = `[${level}] [${category}] ${message}`;
  const consoleData = {
    ...logEntry.context,
    ...logEntry.metadata
  };

  switch (level) {
    case 'ERROR':
      console.error(consoleMessage, consoleData);
      break;
    case 'WARN':
      console.warn(consoleMessage, consoleData);
      break;
    case 'INFO':
      console.info(consoleMessage, consoleData);
      break;
    case 'DEBUG':
      console.debug(consoleMessage, consoleData);
      break;
  }

  // Write to file
  await writeLogToFile(logEntry, level);

  // Write to specialized log files
  if (category === LOG_CATEGORIES.OSINT_PERFORMANCE) {
    await writeLogToFile(logEntry, 'performance');
  }
  if (category === LOG_CATEGORIES.OSINT_SECURITY) {
    await writeLogToFile(logEntry, 'security');
  }
}

/**
 * OSINT-specific logging functions
 */
export const osintLogger = {
  /**
   * Log OSINT scan start
   */
  scanStart: (tool, target, userId, scanId) => {
    return log('INFO', LOG_CATEGORIES.OSINT_SCAN, `OSINT scan started`, {
      tool,
      target,
      userId,
      scanId
    });
  },

  /**
   * Log OSINT scan success
   */
  scanSuccess: (tool, target, userId, scanId, resultCount, duration) => {
    return log('INFO', LOG_CATEGORIES.OSINT_RESULT, `OSINT scan completed successfully`, {
      tool,
      target,
      userId,
      scanId
    }, {
      duration,
      resultCount,
      success: true,
      tags: ['success', 'completed']
    });
  },

  /**
   * Log OSINT scan failure
   */
  scanError: (tool, target, userId, scanId, error, duration) => {
    return log('ERROR', LOG_CATEGORIES.OSINT_ERROR, `OSINT scan failed`, {
      tool,
      target,
      userId,
      scanId
    }, {
      duration,
      success: false,
      error: error.message,
      stack: error.stack,
      tags: ['error', 'failed']
    });
  },

  /**
   * Log tool availability check
   */
  toolCheck: (tool, available, duration) => {
    return log('INFO', LOG_CATEGORIES.OSINT_TOOL, `Tool availability check: ${tool}`, {
      tool
    }, {
      duration,
      success: available,
      tags: ['tool-check', available ? 'available' : 'unavailable']
    });
  },

  /**
   * Log validation errors
   */
  validationError: (field, value, error, context = {}) => {
    return log('WARN', LOG_CATEGORIES.OSINT_VALIDATION, `Validation failed for ${field}`, {
      field,
      value: typeof value === 'string' ? value.substring(0, 100) : value,
      ...context
    }, {
      error: error.message,
      tags: ['validation', 'error']
    });
  },

  /**
   * Log security events
   */
  securityEvent: (event, details, severity = 'INFO') => {
    const level = severity === 'HIGH' ? 'ERROR' : 'WARN';
    return log(level, LOG_CATEGORIES.OSINT_SECURITY, `Security event: ${event}`, details, {
      tags: ['security', event.toLowerCase()]
    });
  },

  /**
   * Log performance metrics
   */
  performance: (operation, duration, details = {}) => {
    return log('INFO', LOG_CATEGORIES.OSINT_PERFORMANCE, `Performance: ${operation}`, details, {
      duration,
      tags: ['performance', operation.toLowerCase()]
    });
  },

  /**
   * Log database operations
   */
  database: (operation, details, success = true, error = null) => {
    const level = success ? 'INFO' : 'ERROR';
    return log(level, LOG_CATEGORIES.OSINT_DATABASE, `Database ${operation}`, details, {
      success,
      error: error?.message,
      tags: ['database', operation.toLowerCase()]
    });
  },

  /**
   * Log cache operations
   */
  cache: (operation, key, hit = null, duration = null) => {
    return log('DEBUG', LOG_CATEGORIES.OSINT_CACHE, `Cache ${operation}: ${key}`, {}, {
      hit: hit !== null ? hit : undefined,
      duration,
      tags: ['cache', operation.toLowerCase()]
    });
  },

  /**
   * Log rate limiting events
   */
  rateLimit: (ip, endpoint, limit, current) => {
    return log('WARN', LOG_CATEGORIES.OSINT_SECURITY, `Rate limit exceeded`, {
      ip,
      endpoint
    }, {
      tags: ['rate-limit', 'security']
    });
  },

  /**
   * Log API requests
   */
  apiRequest: (method, endpoint, userId, duration, statusCode) => {
    const level = statusCode >= 400 ? 'WARN' : 'INFO';
    return log(level, LOG_CATEGORIES.OSINT_SCAN, `${method} ${endpoint}`, {
      method,
      endpoint,
      userId
    }, {
      duration,
      statusCode,
      tags: ['api', method.toLowerCase()]
    });
  },

  /**
   * Debug logging
   */
  debug: (message, context = {}, metadata = {}) => {
    return log('DEBUG', LOG_CATEGORIES.OSINT_SCAN, message, context, {
      ...metadata,
      tags: ['debug']
    });
  }
};

/**
 * Initialize logging system
 */
export async function initializeLogging() {
  await ensureLogDir();
  
  // Log system startup
  await log('INFO', LOG_CATEGORIES.OSINT_SCAN, 'OSINT logging system initialized', {}, {
    tags: ['startup', 'system']
  });
}

/**
 * Get log statistics
 */
export async function getLogStats() {
  const stats = {};
  
  try {
    for (const [level, filePath] of Object.entries(LOG_FILES)) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.trim().split('\n');
        stats[level] = lines.length;
      } catch (error) {
        stats[level] = 0;
      }
    }
    
    return stats;
  } catch (error) {
    console.error('Failed to get log statistics:', error);
    return {};
  }
}

/**
 * Clean old log files
 */
export async function cleanOldLogs(daysToKeep = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  try {
    const files = await fs.readdir(LOG_DIR);
    
    for (const file of files) {
      if (file.endsWith('.log')) {
        const filePath = path.join(LOG_DIR, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          console.log(`Cleaned old log file: ${file}`);
        }
      }
    }
  } catch (error) {
    console.error('Failed to clean old logs:', error);
  }
}

/**
 * Express middleware for request logging
 */
export function requestLogger(req, res, next) {
  const startTime = Date.now();
  const requestId = generateLogId();
  
  // Add request ID to request object
  req.requestId = requestId;
  
  res.on('finish', async () => {
    const duration = Date.now() - startTime;
    
    await osintLogger.apiRequest(
      req.method,
      req.path,
      req.telegramId,
      duration,
      res.statusCode
    );
  });
  
  next();
}

export default osintLogger;
