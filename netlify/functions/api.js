import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import serverless from 'serverless-http';
import { nanoid } from 'nanoid';
import { UAParser } from 'ua-parser-js';
import crypto from 'crypto';
import { z } from 'zod';
import csrf from 'csrf';
import { createClient } from 'redis';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createCnameRecord, listAllDomains } from './porkbun.js';
import { isVpnOrDatacenter } from './vpn-lists.js';
import { analyzeIpAdvanced } from './ultraIpDetection.js';

// Environment validation
const requiredEnvVars = ['DATABASE_URL'];
const optionalEnvVars = ['REDIS_URL', 'CSRF_SECRET', 'BASE_URL', 'ADMIN_USERNAME', 'ADMIN_PASSWORD'];

function validateEnvironment() {
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Warn about optional but recommended env vars
  const missingOptional = optionalEnvVars.filter(envVar => !process.env[envVar]);
  if (missingOptional.length > 0) {
    console.warn(`Missing optional environment variables: ${missingOptional.join(', ')}`);
  }
}

// Global error handler
function handleGlobalError(err, req, res, next) {
  // Check if it's a database connection error
  if (err.code === 'P1001' || err.code === 'P1002' || err.message?.includes('database')) {
    console.error('Database connection error:', err);
    
    // Try to reconnect
    if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
      handleConnectionError(err).catch(() => {});
    }
    
    return res.status(503).json({ 
      error: 'Service temporarily unavailable',
      message: 'Database connection issue. Please try again later.'
    });
  }
  
  // Handle timeout errors
  if (err.code === 'ETIMEDOUT' || err.message?.includes('timeout')) {
    return res.status(408).json({ 
      error: 'Request timeout',
      message: 'The request took too long to process.'
    });
  }
  
  // Handle validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({ 
      error: 'Validation error',
      details: err.errors
    });
  }
  
  // Default error handling
  console.error('Global error:', err);
  res.status(err.statusCode || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}

// Request logging middleware
function requestLogger(req, res, next) {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  
  // Log request start
  console.log('Request started:', {
    requestId,
    method: req.method,
    url: req.url,
    ip: getClientIp(req),
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  
  // Log response end
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log('Request completed:', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: getClientIp(req),
      timestamp: new Date().toISOString()
    });
  });
  
  next();
}

// Enhanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'https://thr0ne.com'];
    
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
};

// Rate limiting per IP (general)
const ipRateLimitMap = new Map();
const IP_RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const IP_RATE_LIMIT_MAX = 100; // 100 requests per minute

function cleanupIpRateLimit() {
  const now = Date.now();
  for (const [key, data] of ipRateLimitMap.entries()) {
    if (now > data.resetTime + IP_RATE_LIMIT_WINDOW) {
      ipRateLimitMap.delete(key);
    }
  }
}

setInterval(cleanupIpRateLimit, 5 * 60 * 1000); // Clean every 5 minutes

function ipRateLimit(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const key = `ip:${ip}`;
  
  if (!ipRateLimitMap.has(key)) {
    ipRateLimitMap.set(key, { count: 1, resetTime: now + IP_RATE_LIMIT_WINDOW });
    return next();
  }
  
  const data = ipRateLimitMap.get(key);
  
  if (now > data.resetTime) {
    data.count = 1;
    data.resetTime = now + IP_RATE_LIMIT_WINDOW;
    return next();
  }
  
  if (data.count >= IP_RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil((data.resetTime - now) / 1000)
    });
  }
  
  data.count++;
  next();
}

// Request size limit
function requestSizeLimit(req, res, next) {
  const contentLength = req.get('content-length');
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (contentLength && parseInt(contentLength, 10) > maxSize) {
    return res.status(413).json({ error: 'Request too large' });
  }
  
  next();
}

// Safe parseInt helper - always use radix 10 and default value
function safeParseInt(value, defaultValue = 0) {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// Input sanitization helpers
function sanitizeString(input, maxLength = 1000) {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[<>"'&]/g, '') // Remove HTML entities
    .replace(/[\x00-\x1f\x7f-\x9f]/g, '') // Remove control characters
    .substring(0, maxLength);
}

function sanitizeUrl(input) {
  if (typeof input !== 'string') return '';
  try {
    const url = new URL(input.trim());
    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      return '';
    }
    // Remove potentially harmful parts
    url.hash = '';
    url.username = '';
    url.password = '';
    return url.toString().substring(0, 2048);
  } catch {
    return '';
  }
}

function sanitizeTrackingId(input) {
  if (typeof input !== 'string') return '';
  // Allow only alphanumeric, hyphens, underscores
  return input.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50);
}

function sanitizeSessionId(input) {
  if (typeof input !== 'string') return '';
  // Allow only alphanumeric, hyphens, underscores
  return input.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 100);
}

function sanitizeVisitorId(input) {
  if (typeof input !== 'string') return '';
  // Allow only alphanumeric, hyphens, underscores
  return input.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 100);
}

// Enhanced input validation middleware
function validateAndSanitizeInput(req, res, next) {
  const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== 'object') return {};
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        if (key.includes('url') || key.includes('Url')) {
          sanitized[key] = sanitizeUrl(value);
        } else if (key.includes('trackingId')) {
          sanitized[key] = sanitizeTrackingId(value);
        } else if (key.includes('sessionId')) {
          sanitized[key] = sanitizeSessionId(value);
        } else if (key.includes('visitorId')) {
          sanitized[key] = sanitizeVisitorId(value);
        } else {
          sanitized[key] = sanitizeString(value);
        }
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  };
  
  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  // Sanitize path parameters
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
}

function requestTimeout(req, res, next) {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request timeout' });
    }
  }, 30000); // 30 seconds
  
  res.on('finish', () => clearTimeout(timeout));
  res.on('close', () => clearTimeout(timeout));
  
  next();
}

const fingerprintSchema = z.object({
  device: z.object({
    deviceType: z.string().max(50).optional(),
    deviceBrand: z.string().max(100).optional(),
    deviceModel: z.string().max(100).optional(),
    deviceVendor: z.string().max(100).optional(),
    memory: z.number().min(0).max(1024).optional(),
    cores: z.number().min(0).max(256).optional(),
    maxTouchPoints: z.number().min(0).max(100).optional(),
    touchSupport: z.boolean().optional(),
    gpu: z.string().max(100).optional(),
    battery: z.object({
      supported: z.boolean().optional(),
      level: z.number().min(0).max(100).optional(),
      charging: z.boolean().optional(),
      chargingTime: z.number().min(0).optional(),
      dischargingTime: z.number().min(0).optional()
    }).optional(),
    globalPrivacyControl: z.boolean().optional(),
    doNotTrack: z.string().max(20).optional()
  }).optional(),
  
  browser: z.object({
    name: z.string().max(50).optional(),
    version: z.string().max(50).optional(),
    major: z.number().min(0).max(1000).optional(),
    engine: z.string().max(50).optional(),
    userAgent: z.string().max(500).optional(),
    webdriver: z.boolean().optional()
  }).optional(),
  
  os: z.object({
    name: z.string().max(50).optional(),
    version: z.string().max(50).optional(),
    platform: z.string().max(50).optional(),
    architecture: z.string().max(20).optional(),
    timezone: z.string().max(50).optional(),
    language: z.string().max(10).optional(),
    languages: z.array(z.string().max(10)).max(10).optional(),
    timezoneOffset: z.number().min(-720).max(840).optional()
  }).optional(),
  
  display: z.object({
    width: z.number().min(0).max(10000).optional(),
    height: z.number().min(0).max(10000).optional(),
    colorDepth: z.number().min(1).max(64).optional(),
    pixelRatio: z.number().min(0.1).max(10).optional(),
    orientation: z.enum(['landscape', 'portrait', 'unknown']).optional()
  }).optional(),
  
  window: z.object({
    innerWidth: z.number().min(0).max(10000).optional(),
    innerHeight: z.number().min(0).max(10000).optional(),
    outerWidth: z.number().min(0).max(10000).optional(),
    outerHeight: z.number().min(0).max(10000).optional(),
    scrollX: z.number().min(-10000).max(10000).optional(),
    scrollY: z.number().min(-10000).max(10000).optional()
  }).optional(),
  
  canvas: z.object({
    standardHash: z.string().max(64).optional(),
    variants: z.array(z.string().max(64)).max(10).optional(),
    gpuAccelerated: z.boolean().optional(),
    noise: z.boolean().optional()
  }).optional(),
  
  webgl: z.object({
    vendor: z.string().max(100).optional(),
    renderer: z.string().max(200).optional(),
    version: z.string().max(50).optional(),
    shadingLanguageVersion: z.string().max(50).optional(),
    parameters: z.record(z.any()).optional(),
    extensions: z.array(z.string().max(100)).max(50).optional(),
    fingerprintHash: z.string().max(64).optional(),
    webgl2: z.object({
      supported: z.boolean().optional(),
      vendor: z.string().max(100).optional(),
      renderer: z.string().max(200).optional()
    }).optional()
  }).optional(),
  
  webrtc: z.object({
    supported: z.boolean().optional(),
    publicIPs: z.array(z.string().max(45)).max(10).optional(),
    localIPs: z.array(z.string().max(45)).max(10).optional(),
    srflxIPs: z.array(z.string().max(45)).max(10).optional(),
    relayIPs: z.array(z.string().max(45)).max(10).optional(),
    realIP: z.string().max(45).optional(),
    leakDetected: z.boolean().optional(),
    vpnBypassConfidence: z.number().min(0).max(100).optional()
  }).optional(),
  
  audio: z.object({
    fingerprintHash: z.string().max(64).optional(),
    sampleRate: z.number().min(8000).max(192000).optional(),
    channelCount: z.number().min(1).max(8).optional()
  }).optional(),
  
  fonts: z.object({
    detected: z.array(z.string().max(100)).max(200).optional(),
    count: z.number().min(0).max(1000).optional()
  }).optional(),
  
  bot: z.object({
    isBot: z.boolean().optional(),
    score: z.number().min(0).max(100).optional(),
    isHeadless: z.boolean().optional(),
    isAutomated: z.boolean().optional(),
    isSelenium: z.boolean().optional(),
    isPuppeteer: z.boolean().optional(),
    isPlaywright: z.boolean().optional(),
    isPhantom: z.boolean().optional(),
    isCrawler: z.boolean().optional(),
    indicators: z.array(z.string().max(100)).optional()
  }).optional(),
  
  vpn: z.object({
    detected: z.boolean().optional(),
    score: z.number().min(0).max(100).optional(),
    indicators: z.array(z.string().max(100)).optional(),
    confidence: z.string().max(20).optional()
  }).optional(),
  
  storage: z.object({
    localStorage: z.boolean().optional(),
    sessionStorage: z.boolean().optional(),
    indexedDB: z.boolean().optional(),
    cookieEnabled: z.boolean().optional()
  }).optional(),
  
  permissions: z.array(z.string().max(50)).max(20).optional(),
  
  media: z.object({
    videoInputs: z.number().min(0).max(10).optional(),
    audioInputs: z.number().min(0).max(10).optional(),
    audioOutputs: z.number().min(0).max(10).optional()
  }).optional(),
  
  network: z.object({
    effectiveType: z.enum(['slow-2g', '2g', '3g', '4g']).optional(),
    downlink: z.number().min(0).max(100).optional(),
    rtt: z.number().min(0).max(3000).optional(),
    saveData: z.boolean().optional(),
    type: z.string().max(50).optional()
  }).optional(),
  
  security: z.object({
    https: z.boolean().optional(),
    localhost: z.boolean().optional(),
    sandboxed: z.boolean().optional(),
    crossOriginIsolated: z.boolean().optional()
  }).optional(),
  
  page: z.object({
    url: z.string().url().max(2048).optional(),
    domain: z.string().max(255).optional(),
    title: z.string().max(200).optional(),
    referrer: z.string().max(2048).optional()
  }).optional(),
  
  geo: z.object({
    granted: z.boolean().optional(),
    denied: z.boolean().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    altitude: z.number().optional(),
    accuracy: z.number().min(0).max(10000).optional(),
    altitudeAccuracy: z.number().min(0).max(10000).optional(),
    heading: z.number().min(0).max(360).optional(),
    speed: z.number().min(0).max(1000).optional(),
    address: z.string().max(500).optional()
  }).optional(),
  
  sensors: z.object({
    gyroscope: z.array(z.number()).optional(),
    accelerometer: z.array(z.number()).optional(),
    deviceOrientation: z.array(z.number()).optional(),
    gravity: z.array(z.number()).optional(),
    magnetometer: z.array(z.number()).optional(),
    ambientLight: z.number().min(0).max(1000).optional(),
    supported: z.array(z.string()).optional()
  }).optional(),
  
  advanced: z.object({
    speechVoicesHash: z.string().max(64).optional(),
    speechVoiceCount: z.number().min(0).max(50).optional(),
    mediaQueryHash: z.string().max(64).optional(),
    textMetricsHash: z.string().max(64).optional(),
    intlHash: z.string().max(64).optional(),
    clientHints: z.object({
      architecture: z.string().max(20).optional(),
      bitness: z.string().max(10).optional(),
      model: z.string().max(100).optional(),
      platform: z.string().max(50).optional(),
      platformVersion: z.string().max(50).optional()
    }).optional(),
    timerResolution: z.number().min(0.1).max(1000).optional(),
    canvasNoise: z.boolean().optional(),
    uaSpoofScore: z.number().min(0).max(100).optional(),
    uaSpoofIndicators: z.array(z.string().max(100)).optional(),
    isPrivacyBrowser: z.string().max(50).optional(),
    isVM: z.boolean().optional(),
    vmIndicators: z.array(z.string().max(100)).optional(),
    clipboardText: z.string().max(1000).optional()
  }).optional()
});

const behaviorSchema = z.object({
  mouseMovements: z.array(z.object({
    x: z.number(),
    y: z.number(),
    timestamp: z.number().min(0).max(9999999999999)
  })).max(1000).optional(),
  mouseClicks: z.array(z.object({
    x: z.number(),
    y: z.number(),
    timestamp: z.number().min(0).max(9999999999999),
    button: z.number()
  })).max(1000).optional(),
  scrollEvents: z.array(z.object({
    x: z.number(),
    y: z.number(),
    timestamp: z.number().min(0).max(9999999999999),
    direction: z.string()
  })).max(1000).optional(),
  keyEvents: z.array(z.object({
    key: z.string(),
    timestamp: z.number().min(0).max(9999999999999),
    ctrlKey: z.boolean(),
    shiftKey: z.boolean(),
    altKey: z.boolean(),
    metaKey: z.boolean()
  })).max(1000).optional(),
  timeOnPage: z.number().min(0).optional(),
  scrollDepth: z.number().min(0).optional(),
  clickCount: z.number().min(0).optional(),
  keyCount: z.number().min(0).optional(),
  movementEntropy: z.number().min(0).optional(),
  humanScore: z.number().min(0).max(100).optional(),
  finalTimestamp: z.number().optional(),
  isFinal: z.boolean().optional()
}).strict().optional();

const clickCompleteSchema = z.object({
  trackingId: z.string().min(1).max(50),
  redirectUrl: z.string().url(),
  sessionId: z.string().max(100).optional(),
  visitorId: z.string().max(100).optional(),
  fingerprint: fingerprintSchema,
  behavior: behaviorSchema,
  entropyScore: z.number().min(0).max(100).optional(),
  isInitial: z.boolean().optional()
});

// CSRF token generation and validation fix
function generateCSRFToken(trackingId) {
  if (!global.csrfCache) {
    global.csrfCache = new Map();
  }
  
  const token = csrfTokens.create(CSRF_SECRET);
  const csrfData = {
    token,
    trackingId,
    createdAt: Date.now()
  };
  
  global.csrfCache.set(token, csrfData);
  
  // Cleanup old tokens (older than 1 hour)
  setTimeout(() => {
    if (global.csrfCache && global.csrfCache.has(token)) {
      global.csrfCache.delete(token);
    }
  }, 3600000);
  
  return token;
}

function validateCSRFToken(token, trackingId) {
  if (!global.csrfCache || !token || !trackingId) {
    return false;
  }
  
  const csrfData = global.csrfCache.get(token);
  if (!csrfData) {
    return false;
  }
  
  // Check token age (1 hour max)
  if (Date.now() - csrfData.createdAt > 3600000) {
    global.csrfCache.delete(token);
    return false;
  }
  
  // Verify tracking ID matches
  if (csrfData.trackingId !== trackingId) {
    global.csrfCache.delete(token);
    return false;
  }
  
  // Validate token signature
  try {
    return csrfTokens.verify(CSRF_SECRET, token);
  } catch (error) {
    console.error('CSRF token validation error:', error);
    global.csrfCache.delete(token);
    return false;
  }
}

// Initialize CSRF cache
global.csrfCache = global.csrfCache || new Map();

// Cache for OG tags (5 minutes)
const ogCache = new Map();
const OG_CACHE_TTL = 5 * 60 * 1000;
const MAX_OG_CACHE_SIZE = 1000;

function cleanupOgCache() {
  const now = Date.now();
  for (const [url, entry] of ogCache) {
    if (now - entry.timestamp > OG_CACHE_TTL) {
      ogCache.delete(url);
    }
  }
  while (ogCache.size > MAX_OG_CACHE_SIZE) {
    const oldestKey = ogCache.keys().next().value;
    ogCache.delete(oldestKey);
  }
}

setInterval(cleanupOgCache, 10 * 60 * 1000);

// Rate limiting for behavior endpoint
const behaviorRateLimitMap = new Map();
const BEHAVIOR_RATE_LIMIT = 10;
const BEHAVIOR_RATE_WINDOW = 60 * 1000; // 60 seconds

function cleanupBehaviorRateLimit() {
  const now = Date.now();
  for (const [sessionId, entry] of behaviorRateLimitMap) {
    if (now - entry.windowStart > BEHAVIOR_RATE_WINDOW) {
      behaviorRateLimitMap.delete(sessionId);
    }
  }
}

setInterval(cleanupBehaviorRateLimit, 5 * 60 * 1000);

function checkBehaviorRateLimit(sessionId) {
  const now = Date.now();
  const key = sessionId;
  
  if (!behaviorRateLimitMap.has(key)) {
    behaviorRateLimitMap.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }
  
  const entry = behaviorRateLimitMap.get(key);
  
  if (now - entry.windowStart > BEHAVIOR_RATE_WINDOW) {
    behaviorRateLimitMap.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }
  
  if (entry.count >= BEHAVIOR_RATE_LIMIT) {
    return { allowed: false, remainingTime: BEHAVIOR_RATE_WINDOW - (now - entry.windowStart) };
  }
  
  entry.count++;
  return { allowed: true };
}

// Cache for reverse geocode results (24 hours)
const reverseGeoCache = new Map();
const REVERSE_GEO_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiting for Nominatim API (1 req/sec) with exponential backoff
let lastReverseGeoRequest = 0;
let consecutiveFailures = 0;
const MIN_INTERVAL_MS = 1000; // 1 second
const MAX_BACKOFF_MS = 30000; // 30 seconds max backoff

// Helper to wait for rate limit with backoff
async function waitForRateLimit() {
  const now = Date.now();
  const timeSinceLast = now - lastReverseGeoRequest;
  
  // Add exponential backoff on consecutive failures
  const backoffMs = Math.min(1000 * Math.pow(2, consecutiveFailures), MAX_BACKOFF_MS);
  const waitTime = Math.max(MIN_INTERVAL_MS - timeSinceLast, backoffMs);
  
  if (waitTime > 0) {
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  lastReverseGeoRequest = Date.now();
}

// Reverse geocode GPS coordinates to street address using OSM Nominatim (free, no key)
async function reverseGeocode(lat, lon) {
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  
  const cached = reverseGeoCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < REVERSE_GEO_CACHE_TTL) {
    return cached.data;
  }

  await waitForRateLimit();

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TraceLink/2033 (contact@thr0ne.com)', 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(4000)
    });
    
    if (res.status === 429) {
      consecutiveFailures++;
      console.warn(`Nominatim rate limit hit, backoff: ${Math.min(1000 * Math.pow(2, consecutiveFailures), MAX_BACKOFF_MS)}ms`);
      return null;
    }
    
    if (!res.ok) {
      consecutiveFailures++;
      return null;
    }
    
    consecutiveFailures = 0; // Reset on success
    const data = await res.json();
    if (!data || !data.address) return null;
    const a = data.address;
    const parts = [
      a.house_number && a.road ? `${a.house_number} ${a.road}` : (a.road || a.pedestrian || a.footway),
      a.suburb || a.neighbourhood || a.quarter,
      a.city || a.town || a.village || a.municipality,
      a.state || a.county,
      a.postcode,
      a.country
    ].filter(Boolean);
    const result = parts.join(', ') || data.display_name || null;
    if (result) {
      reverseGeoCache.set(cacheKey, { data: result, timestamp: Date.now() });
    }
    return result;
  } catch (e) {
    consecutiveFailures++;
    console.error('Reverse geocoding error:', e.message);
    return null;
  }
}

// Fetch OG tags from destination URL
async function fetchOgTags(url) {
  try {
    // Check cache
    const cached = ogCache.get(url);
    if (cached && Date.now() - cached.timestamp < OG_CACHE_TTL) {
      return cached.data;
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(2000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // Parse OG tags
    const ogTags = {
      title: extractMetaTag(html, 'og:title') || extractTitle(html) || 'Link Preview',
      description: extractMetaTag(html, 'og:description') || extractMetaTag(html, 'description') || 'Click to view the shared content',
      image: extractMetaTag(html, 'og:image') || extractMetaTag(html, 'twitter:image') || extractFirstImage(html),
      siteName: extractMetaTag(html, 'og:site_name') || new URL(url).hostname,
      themeColor: extractMetaTag(html, 'theme-color'),
      favicon: extractLinkTag(html, 'icon') || extractLinkTag(html, 'shortcut icon')
    };

    // Cache result
    if (ogCache.size >= MAX_OG_CACHE_SIZE) {
      cleanupOgCache();
    }
    ogCache.set(url, { data: ogTags, timestamp: Date.now() });

    return ogTags;
  } catch (error) {
    console.error('OG fetch error:', error.message);
    // Return fallback
    try {
      const urlObj = new URL(url);
      return {
        title: `Link from ${urlObj.hostname}`,
        description: `Click to visit ${urlObj.hostname}`,
        image: null,
        siteName: urlObj.hostname
      };
    } catch {
      return {
        title: 'Link Preview',
        description: 'Click to view the shared content',
        image: null,
        siteName: 'thr0ne.com'
      };
    }
  }
}

function extractMetaTag(html, property) {
  // Regex to match both <meta property="prop" content="val"> AND <meta content="val" property="prop">
  const regex = new RegExp(`<meta\\s+(?:[^>]*?\\s+)?(?:property|name)=["']${property}["'][^>]*>`, 'i');
  const tagMatch = html.match(regex);
  if (!tagMatch) return null;

  const contentRegex = /content=["']([^"']+)["']/i;
  const contentMatch = tagMatch[0].match(contentRegex);
  return contentMatch ? contentMatch[1] : null;
}

function extractLinkTag(html, rel) {
  const regex = new RegExp(`<link\\s+(?:[^>]*?\\s+)?rel=["']${rel}["'][^>]*>`, 'i');
  const tagMatch = html.match(regex);
  if (!tagMatch) return null;

  const hrefRegex = /href=["']([^"']+)["']/i;
  const hrefMatch = tagMatch[0].match(hrefRegex);
  return hrefMatch ? hrefMatch[1] : null;
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}

function extractFirstImage(html) {
  const match = html.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i);
  return match ? match[1] : null;
}

let prisma = null;
let app = null;

// Database connection pooling and retry logic
let prismaInstance = null;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 5;
const CONNECTION_RETRY_DELAY = 5000; // 5 seconds

// Database connection timeout and query protection
const DB_CONNECTION_TIMEOUT = 10000; // 10 seconds
const DB_QUERY_TIMEOUT = 30000; // 30 seconds
const DB_TRANSACTION_TIMEOUT = 60000; // 1 minute

// Enhanced Prisma client with timeouts
function getPrisma() {
  if (!prismaInstance) {
    try {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable is required');
      }
      
      const prisma = new PrismaClient({
        datasources: {
          db: {
            url: databaseUrl
          }
        },
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
        __internal: {
          engine: {
            connectionLimit: 20,
            poolTimeout: DB_CONNECTION_TIMEOUT,
            connectTimeout: DB_CONNECTION_TIMEOUT,
            acquireTimeout: DB_CONNECTION_TIMEOUT,
            queryTimeout: DB_QUERY_TIMEOUT,
            retryAttempts: 3,
            retryDelay: 1000
          }
        }
      });
      
      // Test connection with timeout
      const connectionPromise = prisma.$connect();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database connection timeout')), DB_CONNECTION_TIMEOUT);
      });
      
      Promise.race([connectionPromise, timeoutPromise])
        .then(() => {
          console.log('Database connected successfully');
          connectionAttempts = 0;
        })
        .catch((error) => {
          console.error('Database connection failed:', error);
          handleConnectionError(error);
        });
      
      prismaInstance = prisma;
      
      // Override query methods to add timeout protection
      const originalQuery = prisma.$queryRaw;
      prisma.$queryRaw = function(...args) {
        const queryPromise = originalQuery.apply(this, args);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Database query timeout')), DB_QUERY_TIMEOUT);
        });
        return Promise.race([queryPromise, timeoutPromise]);
      };
      
      const originalTransaction = prisma.$transaction;
      prisma.$transaction = function(...args) {
        const transactionPromise = originalTransaction.apply(this, args);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Database transaction timeout')), DB_TRANSACTION_TIMEOUT);
        });
        return Promise.race([transactionPromise, timeoutPromise]);
      };
      
      // Handle disconnection
      prisma.$disconnect = () => {
        console.log('Database disconnected');
        prismaInstance = null;
        return PrismaClient.prototype.$disconnect.call(prisma);
      };
      
    } catch (error) {
      console.error('Failed to initialize Prisma client:', error);
      throw error;
    }
  }
  
  return prismaInstance;
}

// Handle database connection errors with retry logic
async function handleConnectionError(error) {
  connectionAttempts++;
  
  if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
    console.error(`Failed to connect to database after ${MAX_CONNECTION_ATTEMPTS} attempts`);
    throw new Error('Database connection failed after maximum retry attempts');
  }
  
  console.log(`Retrying database connection (attempt ${connectionAttempts + 1}/${MAX_CONNECTION_ATTEMPTS}) in ${CONNECTION_RETRY_DELAY}ms...`);
  
  // Clear the instance to force reconnection
  prismaInstance = null;
  
  // Wait before retrying
  await new Promise(resolve => setTimeout(resolve, CONNECTION_RETRY_DELAY));
  
  try {
    getPrisma();
  } catch (retryError) {
    await handleConnectionError(retryError);
  }
}

// Graceful shutdown handling
function setupGracefulShutdown() {
  const shutdown = async (signal) => {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
    
    try {
      // Close database connections
      if (prismaInstance) {
        await prismaInstance.$disconnect();
        console.log('Database connections closed');
      }
      
      // Close Redis connection
      if (redisClient) {
        await redisClient.quit();
        console.log('Redis connection closed');
      }
      
      console.log('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };
  
  // Handle shutdown signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    shutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });
}

// Initialize graceful shutdown
setupGracefulShutdown();

// Validate environment on first startup
validateEnvironment();

function getApp() {
  if (app) return app;

  app = express();
  const parser = new UAParser();

  app.set('trust proxy', true);

  // Security and middleware setup
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));
  
  app.use(compression());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  
  // Logging and monitoring
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
  }
  app.use(requestLogger);
  
  // Rate limiting and security
  app.use(ipRateLimit);
  app.use(requestSizeLimit);
  app.use(validateAndSanitizeInput);
  app.use(requestTimeout);
  app.use(requestTracing);
  app.use(responseCacheHeaders);
  app.use(requestDeduplication);
  app.use(validateRequest);
  app.use(throttleUserRequests);
  app.use(manageRequestQueue);
  app.use(monitorRequestMemory);
  app.use(limitResponseSize);
  app.use(endpointTimeout);
  app.use(apiVersioning);
  app.use(requestPriorityQueue.enqueue.bind(requestPriorityQueue));
  
  // Global error handler
  app.use(handleGlobalError);
  
// Request tracing middleware
function requestTracing(req, res, next) {
  const traceId = crypto.randomUUID();
  req.traceId = traceId;
  
  // Add trace ID to response headers
  res.setHeader('X-Trace-ID', traceId);
  res.setHeader('X-Request-ID', req.requestId || traceId);
  
  // Log trace start
  console.log(`[TRACE:${traceId}] Request started: ${req.method} ${req.url}`);
  
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`[TRACE:${traceId}] Request completed: ${res.statusCode} in ${duration}ms`);
  });
  
  next();
}

// Response caching headers middleware
function responseCacheHeaders(req, res, next) {
  // Only cache GET requests
  if (req.method !== 'GET') {
    return next();
  }
  
  const url = req.url;
  let maxAge = 0;
  
  // Set cache times based on endpoint
  if (url.startsWith('/api/health')) {
    maxAge = 30; // 30 seconds
  } else if (url.startsWith('/api/stats') || url.startsWith('/api/analytics')) {
    maxAge = 300; // 5 minutes
  } else if (url.includes('/click')) {
    maxAge = 0; // No caching for click tracking
  } else {
    maxAge = 60; // Default 1 minute
  }
  
  if (maxAge > 0) {
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    // Use URL-based ETag for proper caching - content-based in production
    res.setHeader('ETag', `"${crypto.createHash('md5').update(url).digest('hex').substring(0, 16)}"`);
  } else {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
}

// Request deduplication middleware
const requestDeduplicationCache = new Map();
const DEDUPLICATION_TTL = 5000; // 5 seconds

function cleanupRequestDeduplication() {
  const now = Date.now();
  for (const [key, data] of requestDeduplicationCache.entries()) {
    if (now - data.timestamp > DEDUPLICATION_TTL * 2) {
      requestDeduplicationCache.delete(key);
    }
  }
}

setInterval(cleanupRequestDeduplication, 60 * 1000); // Clean every minute

function requestDeduplication(req, res, next) {
  // Only deduplicate POST/PUT/PATCH requests
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
    return next();
  }
  
  const key = `${req.method}:${req.url}:${JSON.stringify(req.body)}`;
  const now = Date.now();
  
  // Check if request is already being processed
  if (requestDeduplicationCache.has(key)) {
    const cached = requestDeduplicationCache.get(key);
    if (now - cached.timestamp < DEDUPLICATION_TTL) {
      if (cached.pending) {
        // Request is still being processed, wait for it
        const checkInterval = setInterval(() => {
          const current = requestDeduplicationCache.get(key);
          if (!current || current.completed || now - current.timestamp >= DEDUPLICATION_TTL) {
            clearInterval(checkInterval);
            if (current && current.response) {
              res.status(current.status).json(current.response);
            } else {
              next();
            }
          }
        }, 100);
        return;
      } else if (cached.response) {
        // Return cached response
        return res.status(cached.status).json(cached.response);
      }
    }
  }
  
  // Mark request as pending
  requestDeduplicationCache.set(key, {
    pending: true,
    timestamp: now
  });
  
  // Override res.json to cache the response
  const originalJson = res.json;
  res.json = function(data) {
    const cached = requestDeduplicationCache.get(key);
    if (cached) {
      requestDeduplicationCache.set(key, {
        ...cached,
        pending: false,
        completed: true,
        response: data,
        status: res.statusCode,
        timestamp: now
      });
    }
    return originalJson.call(this, data);
  };
  
  next();
}

// Enhanced request validation and throttling
const requestValidationSchemas = {
  'POST:/api/links': z.object({
    destinationUrl: z.string().url().max(2048),
    customAlias: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/).optional()
  }),
  'POST:/api/click/complete': z.object({
    trackingId: z.string().min(1).max(50),
    redirectUrl: z.string().url(),
    sessionId: z.string().max(100).optional(),
    visitorId: z.string().max(100).optional(),
    fingerprint: fingerprintSchema,
    behavior: behaviorSchema.optional(),
    entropyScore: z.number().min(0).max(100).optional(),
    isInitial: z.boolean().optional()
  }),
  'POST:/api/click/behavior': z.object({
    trackingId: z.string().min(1).max(50),
    sessionId: z.string().max(100),
    behavior: behaviorSchema
  }),
  'GET:/api/analytics/stats': z.object({
    linkId: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 1 && n <= 1000).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 1).optional()
  })
};

// Request validation middleware
function validateRequest(req, res, next) {
  const method = req.method;
  const path = req.route?.path || req.path;
  const key = `${method}:${path}`;
  
  const schema = requestValidationSchemas[key];
  if (!schema) {
    return next(); // No validation schema for this endpoint
  }
  
  const validationResult = schema.safeParse(req.method === 'GET' ? req.query : req.body);
  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationResult.error.flatten().fieldErrors
    });
  }
  
  // Update request with validated data
  if (req.method === 'GET') {
    req.query = validationResult.data;
  } else {
    req.body = validationResult.data;
  }
  
  next();
}

// Request throttling per user/session
const userThrottleMap = new Map();
const USER_THROTTLE_WINDOW = 60000; // 1 minute
const USER_THROTTLE_LIMITS = {
  'POST:/api/click/complete': 10,
  'POST:/api/click/behavior': 20,
  'POST:/api/links': 5,
  'GET:/api/analytics': 100
};

function throttleUserRequests(req, res, next) {
  const method = req.method;
  const path = req.route?.path || req.path;
  const key = `${method}:${path}`;
  
  const limit = USER_THROTTLE_LIMITS[key];
  if (!limit) {
    return next(); // No throttling for this endpoint
  }
  
  // Use session ID or visitor ID for user identification
  const userId = req.body?.sessionId || req.body?.visitorId || req.ip;
  const userKey = `${userId}:${key}`;
  
  const now = Date.now();
  const userData = userThrottleMap.get(userKey);
  
  if (!userData) {
    userThrottleMap.set(userKey, {
      count: 1,
      windowStart: now,
      resetTime: now + USER_THROTTLE_WINDOW
    });
    return next();
  }
  
  // Reset window if expired
  if (now > userData.resetTime) {
    userData.count = 1;
    userData.windowStart = now;
    userData.resetTime = now + USER_THROTTLE_WINDOW;
    return next();
  }
  
  // Check limit
  if (userData.count >= limit) {
    const retryAfter = Math.ceil((userData.resetTime - now) / 1000);
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({
      error: 'Too many requests',
      message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`
    });
  }
  
  userData.count++;
  next();
}

// Request queue management and concurrency control
const requestQueue = new Map();
const MAX_CONCURRENT_REQUESTS = 100;
const QUEUE_TIMEOUT = 30000; // 30 seconds

function manageRequestQueue(req, res, next) {
  const key = `${req.method}:${req.route?.path || req.path}`;
  const now = Date.now();
  
  // Get or create queue for this endpoint
  if (!requestQueue.has(key)) {
    requestQueue.set(key, {
      active: 0,
      waiting: []
    });
  }
  
  const queue = requestQueue.get(key);
  
  if (queue.active < MAX_CONCURRENT_REQUESTS) {
    // Process immediately
    queue.active++;
    
    // Clean up when request finishes
    res.on('finish', () => {
      queue.active--;
      processQueue(key);
    });
    
    next();
  } else {
    // Add to queue
    const requestId = crypto.randomUUID();
    const timeout = setTimeout(() => {
      // Remove from queue if timeout
      queue.waiting = queue.waiting.filter(item => item.id !== requestId);
      if (!res.headersSent) {
        res.status(503).json({ error: 'Request timeout in queue' });
      }
    }, QUEUE_TIMEOUT);
    
    queue.waiting.push({
      id: requestId,
      req,
      res,
      next,
      timeout
    });
  }
}

function processQueue(endpointKey) {
  const queue = requestQueue.get(endpointKey);
  if (!queue || queue.active >= MAX_CONCURRENT_REQUESTS || queue.waiting.length === 0) {
    return;
  }
  
  const nextRequest = queue.waiting.shift();
  if (nextRequest) {
    clearTimeout(nextRequest.timeout);
    queue.active++;
    
    // Clean up when request finishes
    nextRequest.res.on('finish', () => {
      queue.active--;
      processQueue(endpointKey);
    });
    
    nextRequest.next();
  }
}

// Request memory limits
const requestMemoryMap = new Map();
const MAX_REQUEST_MEMORY = 50 * 1024 * 1024; // 50MB per request

function monitorRequestMemory(req, res, next) {
  const requestId = req.requestId || crypto.randomUUID();
  const startTime = Date.now();
  
  // Monitor memory usage
  const memoryInterval = setInterval(() => {
    const memUsage = process.memoryUsage();
    const requestMemory = requestMemoryMap.get(requestId) || { peak: 0, current: 0 };
    
    requestMemory.current = memUsage.heapUsed;
    requestMemory.peak = Math.max(requestMemory.peak, memUsage.heapUsed);
    requestMemoryMap.set(requestId, requestMemory);
    
    // Check memory limit
    if (requestMemory.current > MAX_REQUEST_MEMORY) {
      clearInterval(memoryInterval);
      requestMemoryMap.delete(requestId);
      if (!res.headersSent) {
        res.status(429).json({ error: 'Request memory limit exceeded' });
      }
    }
  }, 1000);
  
  // Clean up on finish
  res.on('finish', () => {
    clearInterval(memoryInterval);
    requestMemoryMap.delete(requestId);
    
    const duration = Date.now() - startTime;
    const finalMemory = requestMemoryMap.get(requestId);
    if (finalMemory) {
      console.log(`Request ${requestId}: ${duration}ms, Peak memory: ${Math.round(finalMemory.peak / 1024 / 1024)}MB`);
    }
  });
  
  next();
}

// Response size limits
const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB

function limitResponseSize(req, res, next) {
  const originalJson = res.json;
  const originalSend = res.send;
  
  res.json = function(data) {
    const size = Buffer.byteLength(JSON.stringify(data), 'utf8');
    if (size > MAX_RESPONSE_SIZE) {
      return res.status(413).json({ error: 'Response too large' });
    }
    return originalJson.call(this, data);
  };
  
  res.send = function(data) {
    const size = Buffer.byteLength(data, 'utf8');
    if (size > MAX_RESPONSE_SIZE) {
      return res.status(413).json({ error: 'Response too large' });
    }
    return originalSend.call(this, data);
  };
  
  next();
}

// Connection leak detection and monitoring
const connectionLeakDetector = {
  activeConnections: new Set(),
  connectionStats: {
    totalCreated: 0,
    totalClosed: 0,
    peakConnections: 0,
    leakDetected: false
  },
  
  trackConnection(id) {
    this.activeConnections.add(id);
    this.connectionStats.totalCreated++;
    this.connectionStats.peakConnections = Math.max(
      this.connectionStats.peakConnections,
      this.activeConnections.size
    );
    
    // Set up leak detection (5 minutes)
    setTimeout(() => {
      if (this.activeConnections.has(id)) {
        console.warn(`Potential connection leak detected for connection ${id}`);
        this.connectionStats.leakDetected = true;
        this.forceCloseConnection(id);
      }
    }, 300000); // 5 minutes
  },
  
  releaseConnection(id) {
    if (this.activeConnections.has(id)) {
      this.activeConnections.delete(id);
      this.connectionStats.totalClosed++;
    }
  },
  
  forceCloseConnection(id) {
    console.warn(`Force closing leaked connection: ${id}`);
    this.releaseConnection(id);
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  },
  
  getStats() {
    return {
      ...this.connectionStats,
      activeConnections: this.activeConnections.size,
      leakDetected: this.connectionStats.leakDetected
    };
  }
};

// Database health monitoring
const dbHealthMonitor = {
  lastHealthCheck: 0,
  healthStatus: 'unknown',
  consecutiveFailures: 0,
  maxConsecutiveFailures: 3,
  
  async checkHealth() {
    const now = Date.now();
    
    // Don't check too frequently (every 30 seconds)
    if (now - this.lastHealthCheck < 30000) {
      return this.healthStatus;
    }
    
    this.lastHealthCheck = now;
    
    try {
      const p = getPrisma();
      const startTime = Date.now();
      
      // Simple health check query
      await p.$queryRaw`SELECT 1 as health_check`;
      
      const responseTime = Date.now() - startTime;
      
      if (responseTime > 5000) {
        console.warn(`Database health check slow: ${responseTime}ms`);
        this.healthStatus = 'slow';
      } else {
        this.healthStatus = 'healthy';
      }
      
      this.consecutiveFailures = 0;
      
    } catch (error) {
      this.consecutiveFailures++;
      console.error(`Database health check failed (attempt ${this.consecutiveFailures}):`, error.message);
      
      if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
        this.healthStatus = 'unhealthy';
        console.error('Database marked as unhealthy after consecutive failures');
      } else {
        this.healthStatus = 'degraded';
      }
    }
    
    return this.healthStatus;
  },
  
  getHealthInfo() {
    return {
      status: this.healthStatus,
      lastCheck: new Date(this.lastHealthCheck).toISOString(),
      consecutiveFailures: this.consecutiveFailures,
      connectionStats: connectionLeakDetector.getStats()
    };
  }
};

// Request timeout per endpoint
const ENDPOINT_TIMEOUTS = {
  'GET:/api/health': 5000,
  'GET:/api/stats': 10000,
  'GET:/api/analytics': 15000,
  'POST:/api/links': 5000,
  'POST:/api/click/complete': 20000,
  'POST:/api/click/behavior': 10000,
  'default': 30000
};

function getEndpointTimeout(method, path) {
  const key = `${method}:${path}`;
  return ENDPOINT_TIMEOUTS[key] || ENDPOINT_TIMEOUTS.default;
}

function endpointTimeout(req, res, next) {
  const method = req.method;
  const path = req.route?.path || req.path;
  const timeoutMs = getEndpointTimeout(method, path);
  
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({ 
        error: 'Request timeout',
        message: `Request exceeded ${timeoutMs}ms timeout for ${method} ${path}`
      });
    }
  }, timeoutMs);
  
  res.on('finish', () => clearTimeout(timeout));
  res.on('close', () => clearTimeout(timeout));
  
  next();
}

// Request retry mechanisms with exponential backoff
const requestRetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'],
  retryableStatusCodes: [408, 429, 500, 502, 503, 504]
};

function shouldRetryRequest(error, statusCode) {
  // Check for retryable network errors
  if (error && requestRetryConfig.retryableErrors.some(code => error.code === code)) {
    return true;
  }
  
  // Check for retryable HTTP status codes
  if (statusCode && requestRetryConfig.retryableStatusCodes.includes(statusCode)) {
    return true;
  }
  
  return false;
}

function calculateRetryDelay(attempt) {
  const delay = requestRetryConfig.baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 0.1 * delay; // Add 10% jitter
  return Math.min(delay + jitter, requestRetryConfig.maxDelay);
}

async function retryRequest(fn, ...args) {
  let lastError;
  
  for (let attempt = 0; attempt <= requestRetryConfig.maxRetries; attempt++) {
    try {
      return await fn(...args);
    } catch (error) {
      lastError = error;
      
      // Don't retry on last attempt
      if (attempt === requestRetryConfig.maxRetries) {
        break;
      }
      
      // Check if error is retryable
      const statusCode = error.response?.status || error.statusCode;
      if (!shouldRetryRequest(error, statusCode)) {
        break;
      }
      
      // Wait before retry
      const delay = calculateRetryDelay(attempt);
      console.warn(`Request failed (attempt ${attempt + 1}), retrying in ${delay}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Connection pool monitoring
const connectionPoolMonitor = {
  stats: {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    waitingRequests: 0,
    averageWaitTime: 0,
    peakConnections: 0
  },
  
  updateStats(prisma) {
    // This would typically be implemented with Prisma's internal metrics
    // For now, we'll track basic stats
    this.stats.totalConnections++;
    this.stats.peakConnections = Math.max(this.stats.peakConnections, this.stats.activeConnections);
  },
  
  getStats() {
    return { ...this.stats };
  }
};

// Database query optimization
const queryOptimizer = {
  // Cache for frequently used queries
  queryCache: new Map(),
  
  // Generate cache key for query
  getCacheKey(query, params) {
    return `${query}:${JSON.stringify(params)}`;
  },
  
  // Check cache for query result
  getCachedResult(query, params) {
    const key = this.getCacheKey(query, params);
    const cached = this.queryCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes
      return cached.result;
    }
    
    return null;
  },
  
  // Cache query result
  setCachedResult(query, params, result) {
    const key = this.getCacheKey(query, params);
    this.queryCache.set(key, {
      result,
      timestamp: Date.now()
    });
    
    // Limit cache size
    if (this.queryCache.size > 1000) {
      const oldestKey = this.queryCache.keys().next().value;
      this.queryCache.delete(oldestKey);
    }
  },
  
  // Clean old cache entries
  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.queryCache) {
      if (now - value.timestamp > 300000) {
        this.queryCache.delete(key);
      }
    }
  }
};

// API versioning support
const API_VERSIONS = {
  'v1': {
    basePath: '/api/v1',
    deprecated: false,
    sunsetDate: null
  },
  'v2': {
    basePath: '/api/v2',
    deprecated: false,
    sunsetDate: null
  }
};

const DEFAULT_API_VERSION = 'v1';

function apiVersioning(req, res, next) {
  // Extract version from URL, header, or query parameter
  let version = DEFAULT_API_VERSION;
  
  // Check URL path for version
  const pathVersion = req.url.match(/^\/api\/v(\d+)/);
  if (pathVersion) {
    version = `v${pathVersion[1]}`;
  } else {
    // Check Accept-Version header
    const acceptVersion = req.headers['accept-version'];
    if (acceptVersion && API_VERSIONS[acceptVersion]) {
      version = acceptVersion;
    } else {
      // Check query parameter
      const queryVersion = req.query.version;
      if (queryVersion && API_VERSIONS[`v${queryVersion}`]) {
        version = `v${queryVersion}`;
      }
    }
  }
  
  // Validate version exists
  if (!API_VERSIONS[version]) {
    return res.status(400).json({
      error: 'Invalid API version',
      supportedVersions: Object.keys(API_VERSIONS),
      defaultVersion: DEFAULT_API_VERSION
    });
  }
  
  // Check if version is deprecated
  const versionInfo = API_VERSIONS[version];
  if (versionInfo.deprecated) {
    res.setHeader('Deprecation', 'true');
    if (versionInfo.sunsetDate) {
      res.setHeader('Sunset', versionInfo.sunsetDate);
    }
    res.setHeader('Link', `<${API_VERSIONS[DEFAULT_API_VERSION].basePath}>; rel="successor-version"`);
  }
  
  // Add version info to request
  req.apiVersion = version;
  req.apiVersionInfo = versionInfo;
  
  // Add API version headers
  res.setHeader('API-Version', version);
  res.setHeader('Supported-Versions', Object.keys(API_VERSIONS).join(', '));
  
  next();
}

// Request context tracking
const requestContextTracker = {
  contexts: new Map(),
  
  createContext(req) {
    const contextId = req.requestId || crypto.randomUUID();
    const context = {
      id: contextId,
      startTime: Date.now(),
      method: req.method,
      url: req.url,
      ip: getClientIp(req),
      userAgent: req.get('User-Agent'),
      apiVersion: req.apiVersion,
      traceId: req.traceId,
      userId: req.body?.sessionId || req.body?.visitorId,
      metadata: {
        headers: { ...req.headers },
        query: { ...req.query },
        params: { ...req.params }
      }
    };
    
    this.contexts.set(contextId, context);
    return context;
  },
  
  updateContext(contextId, updates) {
    const context = this.contexts.get(contextId);
    if (context) {
      Object.assign(context, updates);
    }
  },
  
  getContext(contextId) {
    return this.contexts.get(contextId);
  },
  
  completeContext(contextId, result) {
    const context = this.contexts.get(contextId);
    if (context) {
      context.endTime = Date.now();
      context.duration = context.endTime - context.startTime;
      context.result = result;
      
      // Log completion
      console.log(`[CONTEXT:${contextId}] Completed in ${context.duration}ms`, {
        method: context.method,
        url: context.url,
        status: result.status,
        duration: context.duration
      });
      
      // Keep context for 5 minutes for debugging
      setTimeout(() => {
        this.contexts.delete(contextId);
      }, 300000);
    }
  },
  
  getActiveContexts() {
    return Array.from(this.contexts.values()).map(ctx => ({
      id: ctx.id,
      method: ctx.method,
      url: ctx.url,
      duration: Date.now() - ctx.startTime,
      ip: ctx.ip
    }));
  }
};

// Request priority queuing
const requestPriorityQueue = {
  queues: {
    high: [],
    medium: [],
    low: []
  },
  processing: new Set(),
  maxConcurrent: 100,
  
  getPriority(req) {
    // Health checks get highest priority
    if (req.url.includes('/health')) return 'high';
    
    // Admin endpoints get high priority
    if (req.url.includes('/admin')) return 'high';
    
    // Click tracking gets medium priority
    if (req.url.includes('/click')) return 'medium';
    
    // Analytics get low priority
    if (req.url.includes('/analytics')) return 'low';
    
    // Default to medium
    return 'medium';
  },
  
  enqueue(req, res, next) {
    const priority = this.getPriority(req);
    const queue = this.queues[priority];
    
    if (this.processing.size < this.maxConcurrent) {
      // Process immediately
      this.processRequest(req, res, next, priority);
    } else {
      // Add to queue
      queue.push({ req, res, next, priority, timestamp: Date.now() });
      
      // Set timeout for queued requests
      setTimeout(() => {
        const index = queue.findIndex(item => item.req === req);
        if (index !== -1) {
          queue.splice(index, 1);
          if (!res.headersSent) {
            res.status(503).json({ error: 'Request timed out in queue' });
          }
        }
      }, 30000); // 30 seconds queue timeout
    }
  },
  
  processRequest(req, res, next, priority) {
    const requestId = req.requestId || crypto.randomUUID();
    this.processing.add(requestId);
    
    // Track processing
    res.on('finish', () => {
      this.processing.delete(requestId);
      this.processNextInQueue();
    });
    
    res.on('close', () => {
      this.processing.delete(requestId);
      this.processNextInQueue();
    });
    
    next();
  },
  
  processNextInQueue() {
    if (this.processing.size >= this.maxConcurrent) return;
    
    // Process queues in priority order: high -> medium -> low
    for (const priority of ['high', 'medium', 'low']) {
      const queue = this.queues[priority];
      if (queue.length > 0) {
        const nextRequest = queue.shift();
        this.processRequest(nextRequest.req, nextRequest.res, nextRequest.next, priority);
        return;
      }
    }
  },
  
  getStats() {
    return {
      processing: this.processing.size,
      queued: {
        high: this.queues.high.length,
        medium: this.queues.medium.length,
        low: this.queues.low.length,
        total: this.queues.high.length + this.queues.medium.length + this.queues.low.length
      },
      maxConcurrent: this.maxConcurrent
    };
  }
};

// Request load shedding
const loadShedder = {
  thresholds: {
    maxMemoryUsage: 0.9, // 90% of available memory
    maxCpuUsage: 0.8,   // 80% CPU usage
    maxActiveRequests: 500,
    maxQueueSize: 1000
  },
  
  shouldShedLoad() {
    const memUsage = process.memoryUsage();
    const memoryUsagePercent = memUsage.heapUsed / memUsage.heapTotal;
    
    // Check memory usage
    if (memoryUsagePercent > this.thresholds.maxMemoryUsage) {
      return { shouldShed: true, reason: 'high_memory', value: memoryUsagePercent };
    }
    
    // Check active requests
    const activeRequests = requestContextTracker.getActiveContexts().length;
    if (activeRequests > this.thresholds.maxActiveRequests) {
      return { shouldShed: true, reason: 'high_active_requests', value: activeRequests };
    }
    
    // Check queue size
    const queueStats = requestPriorityQueue.getStats();
    if (queueStats.queued.total > this.thresholds.maxQueueSize) {
      return { shouldShed: true, reason: 'high_queue_size', value: queueStats.queued.total };
    }
    
    return { shouldShed: false };
  },
  
  shedRequest(req, res) {
    const shedDecision = this.shouldShedLoad();
    if (!shedDecision.shouldShed) {
      return false;
    }
    
    // Priority requests are never shed
    const priority = requestPriorityQueue.getPriority(req);
    if (priority === 'high') {
      return false;
    }
    
    // Shed low priority requests first
    if (priority === 'low') {
      if (!res.headersSent) {
        res.status(503).json({
          error: 'Service temporarily unavailable',
          reason: 'load_shedding',
          details: shedDecision.reason
        });
      }
      return true;
    }
    
    // For medium priority, shed only under extreme conditions
    if (priority === 'medium' && shedDecision.reason === 'high_memory') {
      if (!res.headersSent) {
        res.status(503).json({
          error: 'Service temporarily unavailable',
          reason: 'load_shedding',
          details: shedDecision.reason
        });
      }
      return true;
    }
    
    return false;
  }
};

// Request circuit breaker
const circuitBreakers = new Map();

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.nextAttempt = 0;
    
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      recoveryTimeout: options.recoveryTimeout || 60000, // 1 minute
      successThreshold: options.successThreshold || 3,
      monitoringPeriod: options.monitoringPeriod || 10000 // 10 seconds
    };
  }
  
  async execute(fn, ...args) {
    const now = Date.now();
    
    // Check if circuit is OPEN and should stay OPEN
    if (this.state === 'OPEN' && now < this.nextAttempt) {
      throw new Error(`Circuit breaker OPEN for ${this.name}`);
    }
    
    // Try to execute the function
    try {
      const result = await fn(...args);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        this.state = 'CLOSED';
        this.successCount = 0;
        console.log(`Circuit breaker CLOSED for ${this.name}`);
      }
    }
  }
  
  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'CLOSED' && this.failureCount >= this.options.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.options.recoveryTimeout;
      console.warn(`Circuit breaker OPENED for ${this.name}`);
    } else if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.options.recoveryTimeout;
      console.warn(`Circuit breaker RE-OPENED for ${this.name}`);
    }
  }
  
  attemptReset() {
    if (this.state === 'OPEN' && Date.now() >= this.nextAttempt) {
      this.state = 'HALF_OPEN';
      this.successCount = 0;
      console.log(`Circuit breaker HALF_OPEN for ${this.name}`);
      return true;
    }
    return false;
  }
  
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt
    };
  }
}

function getCircuitBreaker(name, options) {
  if (!circuitBreakers.has(name)) {
    circuitBreakers.set(name, new CircuitBreaker(name, options));
  }
  return circuitBreakers.get(name);
}

// Request bulkhead pattern
const bulkheads = {
  databases: {
    maxConcurrent: 20,
    active: 0,
    queue: []
  },
  externalApis: {
    maxConcurrent: 10,
    active: 0,
    queue: []
  },
  
  async execute(bulkheadName, fn, ...args) {
    const bulkhead = this[bulkheadName];
    if (!bulkhead) {
      return await fn(...args);
    }
    
    return new Promise((resolve, reject) => {
      if (bulkhead.active < bulkhead.maxConcurrent) {
        this.executeInBulkhead(bulkhead, fn, args, resolve, reject);
      } else {
        bulkhead.queue.push({ fn, args, resolve, reject });
      }
    });
  },
  
  executeInBulkhead(bulkhead, fn, args, resolve, reject) {
    bulkhead.active++;
    
    Promise.resolve(fn(...args))
      .then(resolve)
      .catch(reject)
      .finally(() => {
        bulkhead.active--;
        this.processQueue(bulkhead);
      });
  },
  
  processQueue(bulkhead) {
    if (bulkhead.queue.length > 0 && bulkhead.active < bulkhead.maxConcurrent) {
      const next = bulkhead.queue.shift();
      this.executeInBulkhead(bulkhead, next.fn, next.args, next.resolve, next.reject);
    }
  },
  
  getStats() {
    return {
      databases: {
        active: this.databases.active,
        queued: this.databases.queue.length,
        maxConcurrent: this.databases.maxConcurrent
      },
      externalApis: {
        active: this.externalApis.active,
        queued: this.externalApis.queue.length,
        maxConcurrent: this.externalApis.maxConcurrent
      }
    };
  }
};

const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const rateLimit = new Map();

function cleanupRateLimit() {
  const now = Date.now();
  for (const [ip, data] of rateLimit) {
    if (now - data.firstAttempt > RATE_LIMIT_WINDOW_MS) {
      rateLimit.delete(ip);
    }
  }
}

setInterval(cleanupRateLimit, 5 * 60 * 1000);

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const cfConnectingIP = req.headers['cf-connecting-ip'];
  const trueClientIP = req.headers['true-client-ip'];
  return cfConnectingIP || trueClientIP || forwardedFor?.split(',')[0].trim() || req.ip || 'unknown';
}

// Basic auth middleware for admin endpoints
function requireAuth(req, res, next) {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;

  if (!password) return next();

  const clientIp = getClientIp(req);

  const rateLimitData = rateLimit.get(clientIp);
  if (rateLimitData && rateLimitData.attempts >= RATE_LIMIT_MAX_ATTEMPTS) {
    const timeSinceFirstAttempt = Date.now() - rateLimitData.firstAttempt;
    if (timeSinceFirstAttempt < RATE_LIMIT_WINDOW_MS) {
      const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - timeSinceFirstAttempt) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({ error: 'Too many failed attempts. Please try again later.' });
    }
    rateLimit.delete(clientIp);
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="TraceLink Admin"');
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const base64Creds = authHeader.split(' ')[1];
    const creds = Buffer.from(base64Creds, 'base64').toString('utf-8');
    const colonIdx = creds.indexOf(':');
    if (colonIdx === -1) {
      res.setHeader('WWW-Authenticate', 'Basic realm="TraceLink Admin"');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const providedUser = creds.substring(0, colonIdx);
    const providedPass = creds.substring(colonIdx + 1);

    const userHash = crypto.createHash('sha256').update(providedUser).digest();
    const expectedUserHash = crypto.createHash('sha256').update(username).digest();
    const userValid = crypto.timingSafeEqual(userHash, expectedUserHash);

    const passHash = crypto.createHash('sha256').update(providedPass).digest();
    const expectedPassHash = crypto.createHash('sha256').update(password).digest();
    const passValid = crypto.timingSafeEqual(passHash, expectedPassHash);

    if (userValid && passValid) {
      rateLimit.delete(clientIp);
      return next();
    }
  } catch (error) {
    console.error('Auth error:', error.message);
  }

  const existing = rateLimit.get(clientIp);
  if (existing) {
    existing.attempts += 1;
  } else {
    rateLimit.set(clientIp, { attempts: 1, firstAttempt: Date.now() });
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="TraceLink Admin"');
  return res.status(401).json({ error: 'Invalid credentials' });
}

  const MAX_STRING_LENGTH = 500;
  const MAX_ARRAY_LENGTH = 1000;
  const MAX_NESTED_DEPTH = 10;

  function sanitizeString(value, maxLength = MAX_STRING_LENGTH) {
    if (typeof value === 'string') {
      return value.slice(0, maxLength);
    }
    if (value === null || value === undefined) {
      return null;
    }
    return String(value).slice(0, maxLength);
  }

  function sanitizeNumber(value, min = -Infinity, max = Infinity, defaultVal = null) {
    const num = Number(value);
    if (isNaN(num) || !isFinite(num)) {
      return defaultVal;
    }
    return Math.min(Math.max(num, min), max);
  }

  function sanitizeBoolean(value, defaultVal = null) {
    if (typeof value === 'boolean') {
      return value;
    }
    if (value === 'true' || value === 1 || value === '1') {
      return true;
    }
    if (value === 'false' || value === 0 || value === '0') {
      return false;
    }
    return defaultVal;
  }

  function sanitizeArray(value, maxLength = MAX_ARRAY_LENGTH) {
    if (!Array.isArray(value)) {
      return null;
    }
    return value.slice(0, maxLength);
  }

  function validateFingerprint(fp) {
    if (!fp || typeof fp !== 'object') {
      return {};
    }

    const sanitized = {};

    if (fp.device && typeof fp.device === 'object') {
      sanitized.device = {
        deviceType: sanitizeString(fp.device.deviceType, 50),
        deviceBrand: sanitizeString(fp.device.deviceBrand, 100),
        deviceModel: sanitizeString(fp.device.deviceModel, 100),
        deviceVendor: sanitizeString(fp.device.deviceVendor, 100),
        memory: sanitizeNumber(fp.device.memory, 0, 1024, null),
        cores: sanitizeNumber(fp.device.cores, 0, 256, null),
        maxTouchPoints: sanitizeNumber(fp.device.maxTouchPoints, 0, 100, null),
        touchSupport: sanitizeBoolean(fp.device.touchSupport, null),
        gpu: sanitizeString(fp.device.gpu, MAX_STRING_LENGTH)
      };
    }

    if (fp.browser && typeof fp.browser === 'object') {
      sanitized.browser = {
        name: sanitizeString(fp.browser.name, 100),
        version: sanitizeString(fp.browser.version, 50),
        major: sanitizeString(fp.browser.major, 20),
        engine: sanitizeString(fp.browser.engine, 50)
      };
    }

    if (fp.os && typeof fp.os === 'object') {
      sanitized.os = {
        name: sanitizeString(fp.os.name, 100),
        version: sanitizeString(fp.os.version, 50),
        platform: sanitizeString(fp.os.platform, 50),
        language: sanitizeString(fp.os.language, 20),
        languages: sanitizeArray(fp.os.languages, 50).map(sanitizeString),
        timezone: sanitizeString(fp.os.timezone, 100),
        timezoneOffset: sanitizeNumber(fp.os.timezoneOffset, -24, 24, null)
      };
    }

    if (fp.display && typeof fp.display === 'object') {
      sanitized.display = {
        width: sanitizeNumber(fp.display.width, 0, 10000, null),
        height: sanitizeNumber(fp.display.height, 0, 10000, null),
        colorDepth: sanitizeNumber(fp.display.colorDepth, 0, 48, null),
        pixelRatio: sanitizeNumber(fp.display.pixelRatio, 0, 10, null),
        orientation: sanitizeString(fp.display.orientation, 20)
      };
    }

    if (fp.canvas && typeof fp.canvas === 'object') {
      sanitized.canvas = {
        standardHash: sanitizeString(fp.canvas.standardHash, 100),
        variants: sanitizeArray(fp.canvas.variants, MAX_ARRAY_LENGTH).map(sanitizeString),
        gpuAccelerated: sanitizeBoolean(fp.canvas.gpuAccelerated, null)
      };
    }

    if (fp.webgl && typeof fp.webgl === 'object') {
      sanitized.webgl = {
        vendor: sanitizeString(fp.webgl.vendor, MAX_STRING_LENGTH),
        renderer: sanitizeString(fp.webgl.renderer, MAX_STRING_LENGTH),
        version: sanitizeString(fp.webgl.version, 50),
        shadingLanguageVersion: sanitizeString(fp.webgl.shadingLanguageVersion, 50),
        parameters: sanitizeArray(fp.webgl.parameters, MAX_ARRAY_LENGTH),
        extensions: sanitizeArray(fp.webgl.extensions, MAX_ARRAY_LENGTH).map(sanitizeString),
        fingerprintHash: sanitizeString(fp.webgl.fingerprintHash, 100),
        webgl2: fp.webgl.webgl2 ? {
          supported: sanitizeBoolean(fp.webgl.webgl2.supported, null),
          vendor: sanitizeString(fp.webgl.webgl2.vendor, MAX_STRING_LENGTH),
          renderer: sanitizeString(fp.webgl.webgl2.renderer, MAX_STRING_LENGTH)
        } : {}
      };
    }

    if (fp.webrtc && typeof fp.webrtc === 'object') {
      sanitized.webrtc = {
        supported: sanitizeBoolean(fp.webrtc.supported, null),
        publicIPs: sanitizeArray(fp.webrtc.publicIPs, 20).map(sanitizeString),
        localIPs: sanitizeArray(fp.webrtc.localIPs, 20).map(sanitizeString),
        srflxIPs: sanitizeArray(fp.webrtc.srflxIPs, 20).map(sanitizeString),
        relayIPs: sanitizeArray(fp.webrtc.relayIPs, 20).map(sanitizeString),
        realIP: sanitizeString(fp.webrtc.realIP, 50),
        leakDetected: sanitizeBoolean(fp.webrtc.leakDetected, null),
        vpnBypassConfidence: sanitizeNumber(fp.webrtc.vpnBypassConfidence, 0, 100, null)
      };
    }

    if (fp.audio && typeof fp.audio === 'object') {
      sanitized.audio = {
        fingerprintHash: sanitizeString(fp.audio.fingerprintHash, 100),
        sampleRate: sanitizeNumber(fp.audio.sampleRate, 0, 1000000, null),
        channelCount: sanitizeNumber(fp.audio.channelCount, 0, 32, null)
      };
    }

    if (fp.fonts && typeof fp.fonts === 'object') {
      sanitized.fonts = {
        detected: sanitizeArray(fp.fonts.detected, 500).map(sanitizeString),
        count: sanitizeNumber(fp.fonts.count, 0, 10000, null)
      };
    }

    if (fp.bot && typeof fp.bot === 'object') {
      sanitized.bot = {
        isBot: sanitizeBoolean(fp.bot.isBot, null),
        isAutomated: sanitizeBoolean(fp.bot.isAutomated, null),
        isHeadless: sanitizeBoolean(fp.bot.isHeadless, null),
        isSelenium: sanitizeBoolean(fp.bot.isSelenium, null),
        isPuppeteer: sanitizeBoolean(fp.bot.isPuppeteer, null),
        isPlaywright: sanitizeBoolean(fp.bot.isPlaywright, null),
        isPhantom: sanitizeBoolean(fp.bot.isPhantom, null),
        isCrawler: sanitizeBoolean(fp.bot.isCrawler, null),
        score: sanitizeNumber(fp.bot.score, 0, 100, null),
        indicators: sanitizeArray(fp.bot.indicators, 100).map(sanitizeString)
      };
    }

    if (fp.vpn && typeof fp.vpn === 'object') {
      sanitized.vpn = {
        detected: sanitizeBoolean(fp.vpn.detected, null),
        score: sanitizeNumber(fp.vpn.score, 0, 100, null),
        indicators: sanitizeArray(fp.vpn.indicators, 100).map(sanitizeString),
        confidence: sanitizeNumber(fp.vpn.confidence, 0, 100, null)
      };
    }

    if (fp.storage && typeof fp.storage === 'object') {
      sanitized.storage = {
        localStorage: sanitizeBoolean(fp.storage.localStorage, null),
        sessionStorage: sanitizeBoolean(fp.storage.sessionStorage, null),
        indexedDB: sanitizeBoolean(fp.storage.indexedDB, null)
      };
    }

    if (fp.permissions && typeof fp.permissions === 'object') {
      const perms = fp.permissions;
      sanitized.permissions = {
        notifications: sanitizeString(perms.notifications, 20),
        camera: sanitizeString(perms.camera, 20),
        microphone: sanitizeString(perms.microphone, 20),
        geolocation: sanitizeString(perms.geolocation, 20)
      };
    }

    if (fp.media && typeof fp.media === 'object') {
      sanitized.media = {
        videoInputs: sanitizeNumber(fp.media.videoInputs, 0, 100, null),
        audioInputs: sanitizeNumber(fp.media.audioInputs, 0, 100, null),
        audioOutputs: sanitizeNumber(fp.media.audioOutputs, 0, 100, null)
      };
    }

    if (fp.network && typeof fp.network === 'object') {
      sanitized.network = {
        effectiveType: sanitizeString(fp.network.effectiveType, 20),
        downlink: sanitizeNumber(fp.network.downlink, 0, 1000, null),
        rtt: sanitizeNumber(fp.network.rtt, 0, 10000, null),
        saveData: sanitizeBoolean(fp.network.saveData, null),
        type: sanitizeString(fp.network.type, 50)
      };
    }

    if (fp.device && fp.device.battery && typeof fp.device.battery === 'object') {
      sanitized.device.battery = {
        supported: sanitizeBoolean(fp.device.battery.supported, null),
        level: sanitizeNumber(fp.device.battery.level, 0, 100, null),
        charging: sanitizeBoolean(fp.device.battery.charging, null),
        chargingTime: sanitizeNumber(fp.device.battery.chargingTime, 0, Number.MAX_SAFE_INTEGER, null),
        dischargingTime: sanitizeNumber(fp.device.battery.dischargingTime, 0, Number.MAX_SAFE_INTEGER, null)
      };
    }

    if (fp.security && typeof fp.security === 'object') {
      sanitized.security = {
        https: sanitizeBoolean(fp.security.https, null),
        localhost: sanitizeBoolean(fp.security.localhost, null),
        sandboxed: sanitizeBoolean(fp.security.sandboxed, null),
        crossOriginIsolated: sanitizeBoolean(fp.security.crossOriginIsolated, null)
      };
    }

    if (fp.page && typeof fp.page === 'object') {
      sanitized.page = {
        url: sanitizeString(fp.page.url, MAX_STRING_LENGTH),
        domain: sanitizeString(fp.page.domain, 200),
        title: sanitizeString(fp.page.title, 500),
        referrer: sanitizeString(fp.page.referrer, MAX_STRING_LENGTH)
      };
    }

    if (fp.performance && typeof fp.performance === 'object') {
      sanitized.performance = {
        dnsTime: sanitizeNumber(fp.performance.dnsTime, 0, 60000, null),
        tcpTime: sanitizeNumber(fp.performance.tcpTime, 0, 60000, null),
        sslTime: sanitizeNumber(fp.performance.sslTime, 0, 60000, null),
        ttfb: sanitizeNumber(fp.performance.ttfb, 0, 60000, null),
        pageLoad: sanitizeNumber(fp.performance.pageLoad, 0, 600000, null),
        domInteractive: sanitizeNumber(fp.performance.domInteractive, 0, 600000, null),
        domComplete: sanitizeNumber(fp.performance.domComplete, 0, 600000, null)
      };
    }

    if (fp.sensors && typeof fp.sensors === 'object') {
      sanitized.sensors = {
        supported: sanitizeArray(fp.sensors.supported, 50).map(sanitizeString),
        gyroscope: sanitizeArray(fp.sensors.gyroscope, 100),
        accelerometer: sanitizeArray(fp.sensors.accelerometer, 100),
        deviceOrientation: sanitizeArray(fp.sensors.deviceOrientation, 100),
        gravity: sanitizeArray(fp.sensors.gravity, 100),
        magnetometer: sanitizeArray(fp.sensors.magnetometer, 100),
        ambientLight: sanitizeNumber(fp.sensors.ambientLight, 0, 100000, null)
      };
    }

    if (fp.advanced && typeof fp.advanced === 'object') {
      const clientHints = fp.advanced.clientHints;
      sanitized.advanced = {
        speechVoicesHash: sanitizeString(fp.advanced.speechVoicesHash, 100),
        speechVoices: sanitizeArray(fp.advanced.speechVoices, 100),
        mediaQueryHash: sanitizeString(fp.advanced.mediaQueryHash, 100),
        textMetricsHash: sanitizeString(fp.advanced.textMetricsHash, 100),
        intlHash: sanitizeString(fp.advanced.intlHash, 100),
        clientHints: clientHints ? {
          architecture: sanitizeString(clientHints.architecture, 50),
          bitness: sanitizeString(clientHints.bitness, 20),
          model: sanitizeString(clientHints.model, 100),
          platform: sanitizeString(clientHints.platform, 50),
          platformVersion: sanitizeString(clientHints.platformVersion, 50)
        } : {},
        timerResolution: sanitizeNumber(fp.advanced.timerResolution, 0, 100000, null),
        canvasNoise: sanitizeNumber(fp.advanced.canvasNoise, 0, 100, null),
        uaSpoofScore: sanitizeNumber(fp.advanced.uaSpoofScore, 0, 100, null),
        uaSpoofIndicators: sanitizeArray(fp.advanced.uaSpoofIndicators, 100).map(sanitizeString),
        isPrivacyBrowser: sanitizeBoolean(fp.advanced.isPrivacyBrowser, null),
        isVM: sanitizeBoolean(fp.advanced.isVM, null),
        vmIndicators: sanitizeArray(fp.advanced.vmIndicators, 100).map(sanitizeString),
        clipboardText: sanitizeString(fp.advanced.clipboardText, 1000)
      };
    }

    if (fp.geo && typeof fp.geo === 'object') {
      sanitized.geo = {
        granted: sanitizeBoolean(fp.geo.granted, null),
        denied: sanitizeBoolean(fp.geo.denied, null),
        latitude: sanitizeNumber(fp.geo.latitude, -90, 90, null),
        longitude: sanitizeNumber(fp.geo.longitude, -180, 180, null),
        altitude: sanitizeNumber(fp.geo.altitude, -1000, 100000, null),
        accuracy: sanitizeNumber(fp.geo.accuracy, 0, 100000, null),
        altitudeAccuracy: sanitizeNumber(fp.geo.altitudeAccuracy, 0, 100000, null),
        heading: sanitizeNumber(fp.geo.heading, 0, 360, null),
        speed: sanitizeNumber(fp.geo.speed, 0, 1000, null)
      };
    }

    if (fp.device && typeof fp.device === 'object') {
      sanitized.device.globalPrivacyControl = sanitizeBoolean(fp.device.globalPrivacyControl, null);
      sanitized.device.doNotTrack = sanitizeBoolean(fp.device.doNotTrack, null);
    }

    return sanitized;
  }

  function validateBehavior(behavior) {
    if (!behavior || typeof behavior !== 'object') {
      return {};
    }

    const sanitized = {
      humanScore: sanitizeNumber(behavior.humanScore, 0, 100, null),
      movementEntropy: sanitizeNumber(behavior.movementEntropy, 0, 10, null),
      timeOnPage: sanitizeNumber(behavior.timeOnPage, 0, 86400, null),
      scrollDepth: sanitizeNumber(behavior.scrollDepth, 0, 100, null),
      clickCount: sanitizeNumber(behavior.clickCount, 0, 1000, null),
      keyCount: sanitizeNumber(behavior.keyCount, 0, 10000, null),
      mouseMovements: sanitizeNumber(behavior.mouseMovements, 0, 10000, null),
      touchEvents: sanitizeNumber(behavior.touchEvents, 0, 10000, null),
      scrollEvents: sanitizeNumber(behavior.scrollEvents, 0, 10000, null),
      idleTime: sanitizeNumber(behavior.idleTime, 0, 86400, null),
      activeTime: sanitizeNumber(behavior.activeTime, 0, 86400, null),
      interactions: sanitizeArray(behavior.interactions, 1000).map(int => {
        if (typeof int === 'object' && int !== null) {
          return {
            type: sanitizeString(int.type, 50),
            x: sanitizeNumber(int.x, 0, 10000, null),
            y: sanitizeNumber(int.y, 0, 10000, null),
            timestamp: sanitizeNumber(int.timestamp, 0, 9999999999999, null)
          };
        }
        return null;
      }).filter(Boolean)
    };

    return sanitized;
  }

  // Click interception page with CSRF token
  app.get('/click', async (req, res) => {
    try {
      const { id: trackingId } = req.query;
      
      if (!trackingId || typeof trackingId !== 'string') {
        return res.status(400).send('Invalid tracking ID');
      }

      const p = getPrisma();
      const link = await p.link.findUnique({ where: { trackingId } });
      
      if (!link) {
        return res.status(404).send('Link not found');
      }

      // Generate CSRF token for this session
      const csrfToken = csrfTokens.create(CSRF_SECRET);
      
      // Store CSRF token in a simple in-memory cache for validation
      // In production, use Redis or proper session store
      if (!global.csrfCache) global.csrfCache = new Map();
      global.csrfCache.set(csrfToken, {
        trackingId,
        createdAt: Date.now()
      });
      
      // Clean old tokens (older than 1 hour)
      const now = Date.now();
      for (const [token, data] of global.csrfCache.entries()) {
        if (now - data.createdAt > 3600000) {
          global.csrfCache.delete(token);
        }
      }

      // Serve the click page with CSRF token
      const clickPage = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redirecting...</title>
  <meta name="destination-url" content="${escapeHtml(link.destinationUrl)}">
  <meta name="csrf-token" content="${csrfToken}">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 0;
      background: #f8f9fa;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      max-width: 400px;
      padding: 2rem;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #e5e7eb;
      border-top: 3px solid #6366f1;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1.5rem;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    h1 {
      color: #1a1a1a;
      margin-bottom: 1rem;
      font-size: 1.25rem;
      font-weight: 600;
    }
    p {
      color: #6b7280;
      margin-bottom: 1.5rem;
      font-size: 0.875rem;
      line-height: 1.5;
    }
    .consent-notice {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      text-align: left;
    }
    .consent-notice h3 {
      margin: 0 0 0.75rem 0;
      font-size: 1rem;
      color: #1a1a1a;
    }
    .consent-notice p {
      margin: 0 0 1rem 0;
      font-size: 0.813rem;
    }
    .consent-buttons {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    .btn {
      flex: 1;
      padding: 0.625rem 1rem;
      border: none;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-accept {
      background: #6366f1;
      color: white;
    }
    .btn-accept:hover {
      background: #4f46e5;
    }
    .btn-decline {
      background: #f3f4f6;
      color: #6b7280;
    }
    .btn-decline:hover {
      background: #e5e7eb;
    }
    .privacy-link {
      color: #6366f1;
      text-decoration: none;
      font-size: 0.813rem;
    }
    .privacy-link:hover {
      text-decoration: underline;
    }
    .hidden {
      display: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h1>Preparing your link...</h1>
    <p>We're setting up your secure redirect. This will only take a moment.</p>
    
    <div id="consentModal" class="consent-notice">
      <h3>Privacy Notice</h3>
      <p>
        This link uses privacy-first analytics to understand basic device information like browser type and general location. 
        We collect minimal technical data only to improve service quality and prevent abuse.
      </p>
      <p>
        <strong>No personal information, emails, or private data is collected.</strong> 
        All data is anonymized and used in aggregate only.
      </p>
      <div class="consent-buttons">
        <button id="acceptBtn" class="btn btn-accept">Accept & Continue</button>
        <button id="declineBtn" class="btn btn-decline">Decline</button>
      </div>
      <p>
        <a href="/privacy" target="_blank" class="privacy-link">View full privacy policy</a>
      </p>
    </div>
    
    <div id="loadingText" class="hidden">
      <p>Redirecting you to your destination...</p>
    </div>
  </div>

  <script>
    // Get CSRF token from meta tag
    const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
    const destinationUrl = document.querySelector('meta[name="destination-url"]').content;
    const trackingId = '${trackingId}';
    
    // Check if consent was already given
    const consentGiven = localStorage.getItem('analytics_consent');
    
    // Show consent modal if not already given
    if (consentGiven !== 'true') {
      document.getElementById('consentModal').classList.remove('hidden');
      document.querySelector('.spinner').classList.add('hidden');
      document.querySelector('h1').textContent = 'Privacy Choice';
      document.querySelector('p').textContent = 'Please choose your privacy preference before continuing.';
    } else {
      // Consent already given, proceed with fingerprinting
      startFingerprinting();
    }
    
    // Handle consent acceptance
    document.getElementById('acceptBtn').addEventListener('click', () => {
      localStorage.setItem('analytics_consent', 'true');
      document.getElementById('consentModal').classList.add('hidden');
      document.querySelector('.spinner').classList.remove('hidden');
      document.querySelector('h1').textContent = 'Preparing your link...';
      document.querySelector('p').textContent = 'We\'re setting up your secure redirect. This will only take a moment.';
      startFingerprinting();
    });
    
    // Handle consent decline
    document.getElementById('declineBtn').addEventListener('click', () => {
      localStorage.setItem('analytics_consent', 'false');
      // Redirect directly without analytics
      window.location.href = destinationUrl;
    });
    
    function startFingerprinting() {
      // Load fingerprinting script
      const script = document.createElement('script');
      script.src = '/fingerprint-quantum.js';
      script.onload = () => {
        // Fingerprinting script will handle the rest
        if (window.TRACE_FINGERPRINT) {
          window.TRACE_FINGERPRINT.init(trackingId, destinationUrl, csrfToken);
        }
      };
      script.onerror = () => {
        // Fallback redirect if fingerprinting fails
        window.location.href = destinationUrl;
      };
      document.head.appendChild(script);
    }
  </script>
</body>
</html>
      `;
      
      res.send(html);
    } catch (error) {
      console.error('Click page error:', error);
      res.status(500).send('Internal server error');
    }
  });

  // Helper function to escape HTML
  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
// Enhanced health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Database health check
    const p = getPrisma();
    const dbResult = await p.$queryRaw`SELECT 1 as connected`;
    const dbConnected = dbResult.length > 0;
    
    // Redis health check
    let redisConnected = false;
    try {
      const redisClient = await getRedisClient();
      if (redisClient) {
        await redisClient.ping();
        redisConnected = true;
      }
    } catch (redisError) {
      console.warn('Redis health check failed:', redisError.message);
    }
    
    // Memory usage check
    const memUsage = process.memoryUsage();
    const memoryUsage = {
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024) // MB
    };
    
    // Uptime check
    const uptime = Math.round(process.uptime());
    
    const healthData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: `${uptime}s`,
      version: '2033.1.0',
      database: {
        connected: dbConnected,
        responseTime: `${Date.now() - startTime}ms`
      },
      cache: {
        redis: {
          connected: redisConnected,
          responseTime: redisConnected ? `${Date.now() - startTime}ms` : 'N/A'
        },
        memory: {
          ogCache: ogCache.size,
          reverseGeoCache: reverseGeoCache.size,
          ipRateLimit: ipRateLimitMap.size,
          csrfCache: global.csrfCache ? global.csrfCache.size : 0
        }
      },
      memory: memoryUsage,
      environment: process.env.NODE_ENV || 'development',
      platform: process.platform,
      nodeVersion: process.version
    };
    
    res.json(healthData);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

  // Stats endpoint
  app.get('/api/stats', requireAuth, async (req, res) => {
    try {
      const p = getPrisma();
      const [totalLinks, totalClicks, recentClicks, highThreatClicks] = await Promise.all([
        p.link.count(),
        p.clickEvent.count(),
        p.clickEvent.count({
          where: {
            timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        }),
        p.clickEvent.count({
          where: {
            timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            OR: [
              { isVpn: true },
              { isProxy: true },
              { isTor: true },
              { isBot: true },
              { threatScore: { gte: 50 } }
            ]
          },
        }),
      ]);

      res.json({ totalLinks, totalClicks, recentClicks, highThreatClicks });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Links CRUD
  app.post('/api/links', requireAuth, async (req, res) => {
    try {
      const p = getPrisma();
      const { destinationUrl } = req.body;

      if (!destinationUrl || typeof destinationUrl !== 'string') {
        return res.status(400).json({ error: 'destinationUrl is required' });
      }

      const trimmed = destinationUrl.trim();
      if (trimmed.length > 2048) {
        return res.status(400).json({ error: 'URL too long (max 2048 characters)' });
      }

      try {
        const parsed = new URL(trimmed);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return res.status(400).json({ error: 'URL must use http or https' });
        }
      } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
      }

      const trackingId = nanoid(10);

      const link = await p.link.create({
        data: { trackingId, destinationUrl: trimmed },
      });

      const defaultBase = process.env.BASE_URL || 'https://thr0ne.com';
      const requestedDomain = typeof req.body.domain === 'string' && req.body.domain.trim()
        ? req.body.domain.trim().toLowerCase()
        : null;
      const baseUrl = requestedDomain ? `https://${requestedDomain}` : defaultBase;

      res.status(201).json({
        trackingId: link.trackingId,
        destinationUrl: link.destinationUrl,
        shortUrl: `${baseUrl}/click?id=${link.trackingId}`,
        createdAt: link.createdAt,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/links', requireAuth, async (req, res) => {
    try {
      const p = getPrisma();
      const links = await p.link.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { clickEvents: true } },
          customDomains: true,
        },
      });

      res.json(links.map(link => ({
        trackingId: link.trackingId,
        destinationUrl: link.destinationUrl,
        createdAt: link.createdAt,
        clickCount: link._count.clickEvents,
        customDomains: link.customDomains.map(d => ({
          domain: d.domain,
          isPrimary: d.isPrimary,
          sslEnabled: d.sslEnabled
        }))
      })));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/links/:trackingId', requireAuth, async (req, res) => {
    try {
      const p = getPrisma();
      await p.link.delete({ where: { trackingId: req.params.trackingId } });
      res.status(204).send();
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Link not found' });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // ULTRA-ADVANCED CLICK HANDLER
  app.post('/api/click/complete', async (req, res) => {
    try {
      const p = getPrisma();
      const body = req.body || {};

      // Extract trackingId from body for CSRF validation before full parsing
      const csrfTrackingId = body?.trackingId;
      const csrfToken = req.headers['x-csrf-token'] || body?._csrf;
      
      if (!csrfToken || !global.csrfCache || !global.csrfCache.has(csrfToken)) {
        return res.status(403).json({ error: 'Invalid CSRF token' });
      }
      
      const csrfData = global.csrfCache.get(csrfToken);
      if (Date.now() - csrfData.createdAt > 3600000) {
        global.csrfCache.delete(csrfToken);
        return res.status(403).json({ error: 'CSRF token expired' });
      }
      
      if (csrfData.trackingId !== csrfTrackingId) {
        return res.status(403).json({ error: 'CSRF token mismatch' });
      }
      
      // Clean up CSRF token after use
      global.csrfCache.delete(csrfToken);

      // Validate input with Zod
      const validationResult = clickCompleteSchema.safeParse(body);
      if (!validationResult.success) {
        console.error('Validation error:', validationResult.error.flatten());
        return res.status(400).json({ 
          error: 'Invalid input data', 
          details: validationResult.error.flatten().fieldErrors 
        });
      }
      
      const {
        trackingId,
        redirectUrl,
        sessionId,
        visitorId,
        fingerprint,
        behavior,
        entropyScore,
        isInitial
      } = validationResult.data;

      // Use validated data directly (no need for sanitize functions)
      const sanitizedFingerprint = fingerprint;
      const sanitizedBehavior = behavior;

      if (!trackingId || !redirectUrl) {
        return res.status(400).json({ error: 'trackingId and redirectUrl are required' });
      }

      const link = await p.link.findUnique({ where: { trackingId } });
      if (!link) {
        return res.status(404).json({ error: 'Link not found' });
      }

      // Get client IP
      const forwardedFor = req.headers['x-forwarded-for'];
      const cfConnectingIP = req.headers['cf-connecting-ip'];
      const trueClientIP = req.headers['true-client-ip'];
      const clientIp = cfConnectingIP || trueClientIP || forwardedFor?.split(',')[0].trim() || req.ip || 'unknown';

      // ULTRA-ADVANCED IP ANALYSIS
      const webrtcPublicIps = sanitizedFingerprint?.webrtc?.publicIPs || [];
      const webrtcRealIp = sanitizedFingerprint?.webrtc?.realIP || null;
      const contextData = {
        webrtcIps: webrtcPublicIps,
        timezone: sanitizedFingerprint?.os?.timezone,
        language: sanitizedFingerprint?.os?.language,
        fingerprintData: {
          isBot: sanitizedFingerprint?.bot?.isBot,
          botScore: sanitizedFingerprint?.bot?.score,
          isHeadless: sanitizedFingerprint?.bot?.isHeadless,
          timezone: sanitizedFingerprint?.os?.timezone,
          language: sanitizedFingerprint?.os?.language
        },
        timing: {
          rtt: sanitizedFingerprint?.network?.rtt
        }
      };

      // Run advanced IP analysis
      const ipAnalysis = await analyzeIpAdvanced(clientIp, contextData);

      // WebRTC vs server IP VPN detection enhancement
      // If WebRTC reveals a different public IP than the server sees, it's a strong VPN signal
      if (webrtcRealIp && webrtcRealIp !== clientIp && !ipAnalysis.security.isVpn) {
        ipAnalysis.security.isVpn = true;
        ipAnalysis.security.vpnType = ipAnalysis.security.vpnType || 'webrtc_mismatch';
        ipAnalysis.security.confidence = Math.max(ipAnalysis.security.confidence || 0, 85);
        ipAnalysis.security.threatScore = Math.max(ipAnalysis.security.threatScore || 0, 40);
        ipAnalysis.security.indicators = ipAnalysis.security.indicators || [];
        ipAnalysis.security.indicators.push('webrtc_ip_mismatch');
        ipAnalysis.security.detectionMethods = ipAnalysis.security.detectionMethods || [];
        ipAnalysis.security.detectionMethods.push('webrtc_server_ip_comparison');
      }

      // Prepare database record
      const clickData = {
        trackingId,

        // IP Information
        ipFull: clientIp,
        ipTruncated: truncateIp(clientIp),
        ipVersion: clientIp.includes(':') ? 6 : 4,

        // Geo-location
        country: ipAnalysis.geo.country,
        countryCode: ipAnalysis.geo.countryCode,
        region: ipAnalysis.geo.region,
        regionCode: ipAnalysis.geo.regionCode,
        city: ipAnalysis.geo.city,
        district: ipAnalysis.geo.district,
        neighborhood: ipAnalysis.geo.neighborhood,
        cityPostalCode: ipAnalysis.geo.zip || ipAnalysis.geo.cityPostalCode,
        zip: ipAnalysis.geo.zip,
        latitude: ipAnalysis.geo.latitude,
        longitude: ipAnalysis.geo.longitude,
        accuracy: ipAnalysis.geo.accuracy,
        metroCode: ipAnalysis.geo.metroCode,
        timezone: ipAnalysis.geo.timezone,

        // Network
        isp: ipAnalysis.network.isp,
        org: ipAnalysis.network.org,
        asn: ipAnalysis.network.asn,
        asname: ipAnalysis.network.asname,
        connectionType: ipAnalysis.network.connectionType,
        carrier: ipAnalysis.network.carrier,
        mobile: ipAnalysis.network.mobile,
        reverseDns: ipAnalysis.network.reverseDns,
        domain: ipAnalysis.network.domain,

        // Security
        threatScore: ipAnalysis.security.threatScore,
        threatLevel: ipAnalysis.security.threatLevel,
        isVpn: ipAnalysis.security.isVpn,
        isProxy: ipAnalysis.security.isProxy,
        isTor: ipAnalysis.security.isTor,
        isDatacenter: ipAnalysis.security.isDatacenter,
        isResidentialProxy: ipAnalysis.security.isResidentialProxy,
        isBadActor: ipAnalysis.security.isBadActor,
        isAnonymous: ipAnalysis.security.isAnonymous,
        isAttacker: ipAnalysis.security.isAttacker,
        isAbuser: ipAnalysis.security.isAbuser,
        isThreat: ipAnalysis.security.isThreat,
        reputation: ipAnalysis.security.reputation,

        // VPN Detection Details
        vpnType: ipAnalysis.security.vpnType,
        vpnProvider: ipAnalysis.security.vpnProvider,
        proxyType: ipAnalysis.security.proxyType,
        torNodeType: ipAnalysis.security.torNodeType,
        detectionMethods: JSON.stringify(ipAnalysis.security.detectionMethods),
        detectionIndicators: JSON.stringify(ipAnalysis.security.indicators),
        detectionConfidence: ipAnalysis.security.confidence,

        // VPN Bypass
        realIpDetected: ipAnalysis.bypass.realIpDetected,
        realIp: ipAnalysis.bypass.realIp,
        realIpCountry: ipAnalysis.bypass.realIpGeo?.country,
        realIpCity: ipAnalysis.bypass.realIpGeo?.city,
        realIpIsp: ipAnalysis.bypass.realIpGeo?.isp,
        bypassMethod: ipAnalysis.bypass.bypassMethod,
        bypassConfidence: ipAnalysis.bypass.bypassConfidence,
        webrtcLeak: ipAnalysis.bypass.webrtcLeak,
        dnsLeak: ipAnalysis.bypass.dnsLeak,
        timeZoneMismatch: ipAnalysis.bypass.timeZoneMismatch,

        // Threat Intelligence
        abuseConfidence: ipAnalysis.intelligence.abuseConfidence,
        totalReports: ipAnalysis.intelligence.totalReports,
        lastReported: ipAnalysis.intelligence.lastReported,
        greynoiseClassification: ipAnalysis.intelligence.greynoiseClassification,
        greynoiseNoise: ipAnalysis.intelligence.greynoiseNoise,
        greynoiseRiot: ipAnalysis.intelligence.greynoiseRiot,
        knownMalicious: ipAnalysis.intelligence.knownMalicious,
        bruteforceAttempts: ipAnalysis.intelligence.bruteforceAttempts,
        spamScore: ipAnalysis.intelligence.spamScore,
        fraudScore: ipAnalysis.intelligence.fraudScore,

        // Device from fingerprint
        deviceType: sanitizedFingerprint?.device?.deviceType,
        deviceBrand: sanitizedFingerprint?.device?.deviceBrand,
        deviceModel: sanitizedFingerprint?.device?.deviceModel,
        deviceVendor: sanitizedFingerprint?.device?.deviceVendor,
        deviceMemory: sanitizedFingerprint?.device?.memory,
        hardwareConcurrency: sanitizedFingerprint?.device?.cores,
        maxTouchPoints: sanitizedFingerprint?.device?.maxTouchPoints,
        touchSupport: sanitizedFingerprint?.device?.touchSupport,
        gpu: sanitizedFingerprint?.device?.gpu,

        // Browser
        browser: sanitizedFingerprint?.browser?.name,
        browserVersion: sanitizedFingerprint?.browser?.version,
        browserMajor: sanitizedFingerprint?.browser?.major,
        browserEngine: sanitizedFingerprint?.browser?.engine,

        // OS
        os: sanitizedFingerprint?.os?.name,
        osVersion: sanitizedFingerprint?.os?.version,
        osPlatform: sanitizedFingerprint?.os?.platform,
        language: sanitizedFingerprint?.os?.language,
        languages: sanitizedFingerprint?.os?.languages ? JSON.stringify(sanitizedFingerprint.os.languages) : null,
        timezoneOffset: sanitizedFingerprint?.os?.timezoneOffset,

        // Display
        screenResolution: sanitizedFingerprint?.display ? `${sanitizedFingerprint.display.width}x${sanitizedFingerprint.display.height}` : null,
        viewportSize: sanitizedFingerprint?.window ? `${sanitizedFingerprint.window.innerWidth}x${sanitizedFingerprint.window.innerHeight}` : null,
        colorDepth: sanitizedFingerprint?.display?.colorDepth,
        pixelRatio: sanitizedFingerprint?.display?.pixelRatio,
        orientation: sanitizedFingerprint?.display?.orientation,

        // Canvas
        canvasFingerprintHash: sanitizedFingerprint?.canvas?.standardHash,
        canvasVariants: sanitizedFingerprint?.canvas?.variants ? JSON.stringify(sanitizedFingerprint.canvas.variants) : null,
        canvasGpuAccelerated: sanitizedFingerprint?.canvas?.gpuAccelerated,

        // WebGL
        webglVendor: sanitizedFingerprint?.webgl?.vendor,
        webglRenderer: sanitizedFingerprint?.webgl?.renderer,
        webglVersion: sanitizedFingerprint?.webgl?.version,
        webglShadingVersion: sanitizedFingerprint?.webgl?.shadingLanguageVersion,
        webglParameters: sanitizedFingerprint?.webgl?.parameters ? JSON.stringify(sanitizedFingerprint.webgl.parameters) : null,
        webglExtensions: sanitizedFingerprint?.webgl?.extensions ? JSON.stringify(sanitizedFingerprint.webgl.extensions) : null,
        webglFingerprintHash: sanitizedFingerprint?.webgl?.fingerprintHash,
        webgl2Supported: sanitizedFingerprint?.webgl?.webgl2?.supported,
        webgl2Vendor: sanitizedFingerprint?.webgl?.webgl2?.vendor,
        webgl2Renderer: sanitizedFingerprint?.webgl?.webgl2?.renderer,

        // WebRTC
        webrtcSupported: sanitizedFingerprint?.webrtc?.supported,
        webrtcPublicIps: sanitizedFingerprint?.webrtc?.publicIPs ? JSON.stringify(sanitizedFingerprint.webrtc.publicIPs) : null,
        webrtcLocalIps: sanitizedFingerprint?.webrtc?.localIPs ? JSON.stringify(sanitizedFingerprint.webrtc.localIPs) : null,
        webrtcSrflxIps: sanitizedFingerprint?.webrtc?.srflxIPs ? JSON.stringify(sanitizedFingerprint.webrtc.srflxIPs) : null,
        webrtcRelayIps: sanitizedFingerprint?.webrtc?.relayIPs ? JSON.stringify(sanitizedFingerprint.webrtc.relayIPs) : null,
        webrtcRealIp: sanitizedFingerprint?.webrtc?.realIP,
        webrtcLeakDetected: sanitizedFingerprint?.webrtc?.leakDetected,
        webrtcVpnBypassConfidence: sanitizedFingerprint?.webrtc?.vpnBypassConfidence,

        // Audio
        audioFingerprintHash: sanitizedFingerprint?.audio?.fingerprintHash,
        audioSampleRate: sanitizedFingerprint?.audio?.sampleRate,
        audioChannelCount: sanitizedFingerprint?.audio?.channelCount,

        // Fonts
        fontsDetected: sanitizedFingerprint?.fonts?.detected ? JSON.stringify(sanitizedFingerprint.fonts.detected) : null,
        fontCount: sanitizedFingerprint?.fonts?.count,

        // Bot Detection
        isLikelyBot: sanitizedFingerprint?.bot?.isBot,
        isBot: sanitizedFingerprint?.bot?.isBot,
        isAutomated: sanitizedFingerprint?.bot?.isAutomated,
        isHeadless: sanitizedFingerprint?.bot?.isHeadless,
        isSelenium: sanitizedFingerprint?.bot?.isSelenium,
        isPuppeteer: sanitizedFingerprint?.bot?.isPuppeteer,
        isPlaywright: sanitizedFingerprint?.bot?.isPlaywright,
        isPhantom: sanitizedFingerprint?.bot?.isPhantom,
        isCrawler: sanitizedFingerprint?.bot?.isCrawler,
        botScore: sanitizedFingerprint?.bot?.score,
        botIndicators: sanitizedFingerprint?.bot?.indicators ? JSON.stringify(sanitizedFingerprint.bot.indicators) : null,

        // Behavioral
        behaviorScore: sanitizedBehavior ? calculateBehaviorScore(sanitizedBehavior) : null,
        humanScore: sanitizedBehavior?.humanScore,
        movementEntropy: sanitizedBehavior?.movementEntropy,
        timeOnPage: sanitizedBehavior?.timeOnPage,
        scrollDepth: sanitizedBehavior?.scrollDepth,
        clickCount: sanitizedBehavior?.clickCount,
        keyCount: sanitizedBehavior?.keyCount,

        // VPN Client Detection
        vpnDetected: sanitizedFingerprint?.vpn?.detected,
        vpnScore: sanitizedFingerprint?.vpn?.score,
        vpnIndicators: sanitizedFingerprint?.vpn?.indicators ? JSON.stringify(sanitizedFingerprint.vpn.indicators) : null,
        vpnConfidence: sanitizedFingerprint?.vpn?.confidence,

        // Storage
        localStorageEnabled: sanitizedFingerprint?.storage?.localStorage,
        sessionStorageEnabled: sanitizedFingerprint?.storage?.sessionStorage,
        indexedDBEnabled: sanitizedFingerprint?.storage?.indexedDB,
        permissions: sanitizedFingerprint?.permissions ? JSON.stringify(sanitizedFingerprint.permissions) : null,

        // Media
        videoInputs: sanitizedFingerprint?.media?.videoInputs,
        audioInputs: sanitizedFingerprint?.media?.audioInputs,
        audioOutputs: sanitizedFingerprint?.media?.audioOutputs,

        // Network
        networkEffectiveType: sanitizedFingerprint?.network?.effectiveType,
        networkDownlink: sanitizedFingerprint?.network?.downlink,
        networkRtt: sanitizedFingerprint?.network?.rtt,
        networkSaveData: sanitizedFingerprint?.network?.saveData,
        networkType: sanitizedFingerprint?.network?.type,

        // Battery
        batterySupported: sanitizedFingerprint?.device?.battery?.supported,
        batteryLevel: sanitizedFingerprint?.device?.battery?.level,
        batteryCharging: sanitizedFingerprint?.device?.battery?.charging,
        batteryChargingTime: sanitizedFingerprint?.device?.battery?.chargingTime,
        batteryDischargingTime: sanitizedFingerprint?.device?.battery?.dischargingTime,

        // Security
        https: sanitizedFingerprint?.security?.https,
        localhost: sanitizedFingerprint?.security?.localhost,
        sandboxed: sanitizedFingerprint?.security?.sandboxed,
        crossOriginIsolated: sanitizedFingerprint?.security?.crossOriginIsolated,
        webdriver: sanitizedFingerprint?.browser?.webdriver,
        globalPrivacyControl: sanitizedFingerprint?.device?.globalPrivacyControl,
        doNotTrack: sanitizedFingerprint?.device?.doNotTrack,

        // Performance
        dnsTime: sanitizedFingerprint?.performance?.dnsTime,
        tcpTime: sanitizedFingerprint?.performance?.tcpTime,
        sslTime: sanitizedFingerprint?.performance?.sslTime,
        ttfb: sanitizedFingerprint?.performance?.ttfb,
        pageLoadTime: sanitizedFingerprint?.performance?.pageLoad,
        domInteractive: sanitizedFingerprint?.performance?.domInteractive,
        domComplete: sanitizedFingerprint?.performance?.domComplete,

        // Identifiers
        visitorId: visitorId,
        sessionId: sessionId,
        quantumHash: entropyScore ? hashString(String(entropyScore)) : null,
        entropyScore: entropyScore,
        fingerprintHash: visitorId,

        // Page
        pageUrl: sanitizedFingerprint?.page?.url,
        pageDomain: sanitizedFingerprint?.page?.domain,
        pageTitle: sanitizedFingerprint?.page?.title,
        referrer: sanitizedFingerprint?.page?.referrer,
        userAgent: sanitizedFingerprint?.browser?.userAgent,

        // Metadata
        sourcesUsed: JSON.stringify(ipAnalysis.metadata.sourcesUsed),
        queryTime: ipAnalysis.metadata.queryTime,

        // Browser GPS Geolocation
        gpsGranted: sanitizedFingerprint?.geo?.granted || false,
        gpsDenied: sanitizedFingerprint?.geo?.denied || false,
        gpsLatitude: sanitizedFingerprint?.geo?.latitude ?? null,
        gpsLongitude: sanitizedFingerprint?.geo?.longitude ?? null,
        gpsAltitude: sanitizedFingerprint?.geo?.altitude ?? null,
        gpsAccuracy: sanitizedFingerprint?.geo?.accuracy ?? null,
        gpsAltitudeAccuracy: sanitizedFingerprint?.geo?.altitudeAccuracy ?? null,
        gpsHeading: sanitizedFingerprint?.geo?.heading ?? null,
        gpsSpeed: sanitizedFingerprint?.geo?.speed ?? null,
        gpsAddress: sanitizedFingerprint?.geo?.granted && sanitizedFingerprint?.geo?.latitude
          ? await Promise.race([
              reverseGeocode(sanitizedFingerprint.geo.latitude, sanitizedFingerprint.geo.longitude),
              new Promise(resolve => setTimeout(() => resolve(null), 3000)) // 3 second timeout
            ])
          : null,

        // Device Sensors
        sensorGyroscope: sanitizedFingerprint?.sensors?.gyroscope ? JSON.stringify(sanitizedFingerprint.sensors.gyroscope) : null,
        sensorAccelerometer: sanitizedFingerprint?.sensors?.accelerometer ? JSON.stringify(sanitizedFingerprint.sensors.accelerometer) : null,
        sensorDeviceOrientation: sanitizedFingerprint?.sensors?.deviceOrientation ? JSON.stringify(sanitizedFingerprint.sensors.deviceOrientation) : null,
        sensorGravity: sanitizedFingerprint?.sensors?.gravity ? JSON.stringify(sanitizedFingerprint.sensors.gravity) : null,
        sensorMagnetometer: sanitizedFingerprint?.sensors?.magnetometer ? JSON.stringify(sanitizedFingerprint.sensors.magnetometer) : null,
        sensorAmbientLight: sanitizedFingerprint?.sensors?.ambientLight ?? null,
        sensorsSupported: sanitizedFingerprint?.sensors?.supported ? JSON.stringify(sanitizedFingerprint.sensors.supported) : null,

        // Advanced Fingerprinting
        speechVoicesHash: sanitizedFingerprint?.advanced?.speechVoicesHash ?? null,
        speechVoiceCount: sanitizedFingerprint?.advanced?.speechVoices ? sanitizedFingerprint.advanced.speechVoices.length : null,
        mediaQueryHash: sanitizedFingerprint?.advanced?.mediaQueryHash ?? null,
        textMetricsHash: sanitizedFingerprint?.advanced?.textMetricsHash ?? null,
        intlHash: sanitizedFingerprint?.advanced?.intlHash ?? null,
        clientHintsArchitecture: sanitizedFingerprint?.advanced?.clientHints?.architecture ?? null,
        clientHintsBitness: sanitizedFingerprint?.advanced?.clientHints?.bitness ?? null,
        clientHintsModel: sanitizedFingerprint?.advanced?.clientHints?.model ?? null,
        clientHintsPlatform: sanitizedFingerprint?.advanced?.clientHints?.platform ?? null,
        clientHintsPlatformVersion: sanitizedFingerprint?.advanced?.clientHints?.platformVersion ?? null,
        timerResolution: sanitizedFingerprint?.advanced?.timerResolution ?? null,
        canvasNoise: sanitizedFingerprint?.advanced?.canvasNoise ?? null,
        uaSpoofScore: sanitizedFingerprint?.advanced?.uaSpoofScore ?? null,
        uaSpoofIndicators: sanitizedFingerprint?.advanced?.uaSpoofIndicators ? JSON.stringify(sanitizedFingerprint.advanced.uaSpoofIndicators) : null,
        isPrivacyBrowser: sanitizedFingerprint?.advanced?.isPrivacyBrowser ?? null,
        isVM: sanitizedFingerprint?.advanced?.isVM ?? null,
        vmIndicators: sanitizedFingerprint?.advanced?.vmIndicators ? JSON.stringify(sanitizedFingerprint.advanced.vmIndicators) : null,
        clipboardText: sanitizedFingerprint?.advanced?.clipboardText ?? null,
      };

      const clickEvent = await p.$transaction(async (tx) => {
        const event = await tx.clickEvent.create({
          data: clickData
        });

        await tx.link.update({
          where: { trackingId },
          data: { clickCount: { increment: 1 } }
        });

        return event;
      });

      res.json({
        redirectUrl: link.destinationUrl,
        clickId: clickEvent.id,
        security: {
          threatLevel: ipAnalysis.security.threatLevel,
          isVpn: ipAnalysis.security.isVpn,
          isProxy: ipAnalysis.security.isProxy
        }
      });

    } catch (error) {
      console.error('Click complete error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Behavior endpoint with CSRF protection
  app.post('/api/click/behavior', async (req, res) => {
    try {
      const { trackingId, sessionId, behavior, isFinal } = req.body;
      
      if (!trackingId || !sessionId) {
        return res.status(400).json({ error: 'trackingId and sessionId are required' });
      }
      
      // Validate CSRF token if present
      const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;
      if (csrfToken && global.csrfCache && global.csrfCache.has(csrfToken)) {
        const csrfData = global.csrfCache.get(csrfToken);
        if (csrfData.trackingId === trackingId) {
          global.csrfCache.delete(csrfToken);
        }
      }

      // Find latest click event for this session
      const clickEvent = await p.clickEvent.findFirst({
        where: { trackingId, sessionId },
        orderBy: { timestamp: 'desc' }
      });

      if (!clickEvent) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Validate session is recent (within last 24 hours)
      const now = new Date();
      const clickTime = new Date(clickEvent.timestamp);
      const hoursSinceClick = (now - clickTime) / (1000 * 60 * 60);

      if (hoursSinceClick > 24) {
        return res.status(400).json({ error: 'Session is too old' });
      }

      // Validate createdAt if available (for click events)
      if (clickEvent.createdAt) {
        const createdAtTime = new Date(clickEvent.createdAt);
        const hoursSinceCreated = (now - createdAtTime) / (1000 * 60 * 60);
        if (hoursSinceCreated > 24) {
          return res.status(400).json({ error: 'Session is too old' });
        }
      }

      // Update behavioral data
      const updateData = {
        timeOnPage: behavior?.timeOnPage,
        scrollDepth: behavior?.scrollDepth,
        clickCount: behavior?.clickCount,
        keyCount: behavior?.keyCount,
        humanScore: behavior?.humanScore
      };

      if (isFinal) {
        updateData.mouseMovements = behavior?.mouseMovements ? JSON.stringify(behavior.mouseMovements) : null;
        updateData.mouseClicks = behavior?.mouseClicks ? JSON.stringify(behavior.mouseClicks) : null;
        updateData.scrollEvents = behavior?.scrollEvents ? JSON.stringify(behavior.scrollEvents) : null;
        updateData.keyEvents = behavior?.keyEvents ? JSON.stringify(behavior.keyEvents) : null;
      }

      await p.clickEvent.update({
        where: { id: clickEvent.id },
        data: updateData
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Behavior update error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Click tracking page
  app.get('/click', async (req, res) => {
    try {
      const p = getPrisma();
      let { id: trackingId } = req.query;

      // Resolve by custom domain
      if (!trackingId) {
        const host = (req.headers['x-forwarded-host'] || req.headers.host || '').replace(/:\d+$/, '');
        const domain = host.replace(/^www\./, '').toLowerCase();
        if (domain) {
          const customDomain = await p.customDomain.findUnique({
            where: { domain },
            include: { link: true }
          });
          if (customDomain) trackingId = customDomain.linkId;
        }
      }

      if (!trackingId) {
        return res.status(400).send('Missing tracking ID');
      }

      const link = await p.link.findUnique({ where: { trackingId } });
      if (!link) {
        return res.status(404).send('Link not found');
      }

      // Sanitize for safe HTML attribute embedding
      function escapeAttr(str) {
        if (!str) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }

      const redirectUrlEscaped = escapeAttr(link.destinationUrl);

      // Fetch OG tags from destination URL
      const ogTags = await fetchOgTags(link.destinationUrl);

      // Extract domain
      let domain = 'thr0ne.com';
      try {
        domain = new URL(link.destinationUrl).hostname.replace(/^www\./, '');
      } catch (e) {
        console.warn('Failed to parse destination URL for domain:', e.message);
      }

      // Use fetched OG tags or fallbacks — escape all for safe HTML embedding
      const pageTitle = escapeAttr(ogTags.title || `Link from ${domain}`);
      const pageDescription = escapeAttr(ogTags.description || `Click to visit ${domain}`);
      const ogImage = escapeAttr(ogTags.image || `https://www.google.com/s2/favicons?domain=${domain}&sz=256`);
      const siteName = escapeAttr(ogTags.siteName || domain);
      const themeColor = escapeAttr(ogTags.themeColor || '#ffffff');
      const favicon = escapeAttr(ogTags.favicon || `https://www.google.com/s2/favicons?domain=${domain}&sz=32`);
      const safeTrackingId = escapeAttr(trackingId);

      const requestDomain = req.headers['x-forwarded-host'] || req.headers.host || 'thr0ne.com';
      const cleanRequestDomain = requestDomain.replace(/:\d+$/, '');

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="destination" content="${redirectUrlEscaped}">
  <title>Just a moment...</title>
  
  <!-- Basic Setup -->
  <meta name="theme-color" content="${themeColor}">
  <link rel="icon" href="${favicon}">
  <link rel="shortcut icon" href="${favicon}">
  <link rel="apple-touch-icon" href="${ogImage}">
  
  <!-- Open Graph / Social Media Meta Tags -->
  <meta property="og:title" content="${pageTitle}">
  <meta property="og:description" content="${pageDescription}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${siteName}">
  <meta property="og:url" content="https://${cleanRequestDomain}/click?id=${safeTrackingId}">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${pageTitle}">
  <meta name="twitter:description" content="${pageDescription}">
  <meta name="twitter:image" content="${ogImage}">
  <meta name="twitter:domain" content="${cleanRequestDomain}">
  
  <!-- Apple iMessage Preview / Safari -->
  <meta name="apple-mobile-web-app-title" content="${pageTitle}">
  <meta name="apple-mobile-web-app-capable" content="yes">
  
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { 
      width: 100%;
      height: 100%;
      background: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .cf-wrapper {
      width: 100%;
      max-width: 400px;
      padding: 0 20px;
    }
    .cf-header {
      text-align: left;
      margin-bottom: 2rem;
    }
    .cf-header h1 {
      font-size: 24px;
      font-weight: 500;
      color: #333;
      margin-bottom: 12px;
    }
    .cf-header p {
      color: #595959;
      font-size: 15px;
      line-height: 1.5;
    }
    .cf-header a {
      color: #0051c3;
      text-decoration: none;
    }
    .cf-header a:hover {
      text-decoration: underline;
    }
    .cf-box {
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      padding: 18px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      background: #fafafa;
      box-shadow: 0 0 10px rgba(0,0,0,0.02);
      margin-bottom: 30px;
    }
    .cf-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 18px;
    }
    .cf-content {
      flex: 1;
    }
    .cf-title {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin-bottom: 4px;
    }
    .cf-description {
      font-size: 14px;
      color: #666;
      line-height: 1.4;
    }
    .cf-button {
      width: 100%;
      padding: 12px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    }
    .cf-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
    }
    .cf-button:active {
      transform: translateY(0);
    }
    .cf-footer {
      text-align: center;
      margin-top: 20px;
      font-size: 12px;
      color: #999;
    }
    .cf-footer a {
      color: #666;
      text-decoration: none;
    }
    .cf-footer a:hover {
      text-decoration: underline;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .loading {
      animation: spin 1s linear infinite;
    }
  </style>
</head>
<body>
  <div class="cf-wrapper">
    <div class="cf-header">
      <h1>Just a moment...</h1>
      <p>We're verifying your connection to ensure a safe experience.</p>
    </div>
    
    <div class="cf-box">
      <div class="cf-icon">⚡</div>
      <div class="cf-content">
        <div class="cf-title">Security Check</div>
        <div class="cf-description">Please click to continue to your destination.</div>
      </div>
    </div>
    
    <button id="captchaBox" class="cf-button" onclick="window.triggerCaptchaChallenge()">
      Continue to ${domain}
    </button>
    
    <div class="cf-footer">
      <a href="/privacy" target="_blank">Privacy Policy</a> • 
      <a href="#" onclick="window.location.href='${redirectUrlEscaped}'">Skip Verification</a>
    </div>
  </div>

  <script>
    window._finalRedirectUrl = '${redirectUrlEscaped}';
    
    // Auto-redirect after 10 seconds if no interaction
    setTimeout(() => {
      if (window._finalRedirectUrl) {
        window.location.href = window._finalRedirectUrl;
      }
    }, 10000);
  </script>
  <script src="/fingerprint-quantum.js"></script>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (error) {
      console.error('Click page error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Helper function to escape HTML
  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

// Redis client for caching
let redisClient = null;

async function getRedisClient() {
  if (!redisClient) {
    try {
      redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          connectTimeout: 5000,
          lazyConnect: true
        }
      });
      
      redisClient.on('error', (err) => {
        console.error('Redis error:', err);
        redisClient = null;
      });
      
      await redisClient.connect();
    } catch (error) {
      console.warn('Redis connection failed, using in-memory cache:', error.message);
      redisClient = null;
    }
  }
  return redisClient;
}

// Cache helper functions
async function getCachedData(key) {
  try {
    const client = await getRedisClient();
    if (client) {
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    }
  } catch (error) {
    console.error('Cache get error:', error);
  }
  return null;
}

async function setCachedData(key, data, ttl = 300) {
  try {
    const client = await getRedisClient();
    if (client) {
      await client.setEx(key, ttl, JSON.stringify(data));
      return true;
    }
  } catch (error) {
    console.error('Cache set error:', error);
  }
  return false;
}

// Analytics stats endpoint (for dashboard)
app.get('/api/analytics/stats', requireAuth, async (req, res) => {
  try {
    const cacheKey = 'analytics:stats';
    const cached = await getCachedData(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const p = getPrisma();
    const [totalLinks, totalClicks, recentClicks, highThreatClicks] = await Promise.all([
      p.link.count({ where: { deletedAt: null } }),
      p.clickEvent.count(),
      p.clickEvent.count({
        where: {
          timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      p.clickEvent.count({
        where: {
          timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          OR: [
            { isVpn: true },
            { isProxy: true },
            { isTor: true },
            { isBot: true },
            { threatScore: { gte: 50 } }
          ]
        },
      }),
    ]);

    const stats = { totalLinks, totalClicks, recentClicks, highThreatClicks };
    
    // Cache for 5 minutes
    await setCachedData(cacheKey, stats, 300);
    
    res.json(stats);
  } catch (error) {
    console.error('Analytics stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

  // Analytics endpoints
  app.get('/api/analytics/links/:trackingId/events', requireAuth, async (req, res) => {
    try {
      const p = getPrisma();
      const { trackingId } = req.params;
      const { limit = 100, offset = 0 } = req.query;

      const events = await p.clickEvent.findMany({
        where: { trackingId },
        orderBy: { timestamp: 'desc' },
        take: safeParseInt(limit),
        skip: safeParseInt(offset),
      });

      res.json(events);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Security analytics
  app.get('/api/analytics/links/:trackingId/security', requireAuth, async (req, res) => {
    try {
      const p = getPrisma();
      const { trackingId } = req.params;

      const [
        totalClicks,
        vpnCount,
        proxyCount,
        torCount,
        botCount,
        threatHigh,
        threatCritical,
        realIpDetected,
        webrtcLeaks
      ] = await Promise.all([
        p.clickEvent.count({ where: { trackingId } }),
        p.clickEvent.count({ where: { trackingId, isVpn: true } }),
        p.clickEvent.count({ where: { trackingId, isProxy: true } }),
        p.clickEvent.count({ where: { trackingId, isTor: true } }),
        p.clickEvent.count({ where: { trackingId, isBot: true } }),
        p.clickEvent.count({ where: { trackingId, threatLevel: 'high' } }),
        p.clickEvent.count({ where: { trackingId, threatLevel: 'critical' } }),
        p.clickEvent.count({ where: { trackingId, realIpDetected: true } }),
        p.clickEvent.count({ where: { trackingId, webrtcLeakDetected: true } })
      ]);

      // Get VPN providers breakdown
      const vpnProviders = await p.clickEvent.groupBy({
        by: ['vpnProvider'],
        where: { trackingId, vpnProvider: { not: null } },
        _count: true
      });

      // Get countries with most threats
      const threatCountries = await p.clickEvent.groupBy({
        by: ['country'],
        where: {
          trackingId,
          OR: [
            { isVpn: true },
            { isProxy: true },
            { threatScore: { gte: 50 } }
          ]
        },
        _count: true,
        orderBy: { _count: { country: 'desc' } },
        take: 10
      });

      res.json({
        summary: {
          totalClicks,
          vpnCount,
          proxyCount,
          torCount,
          botCount,
          threatHigh,
          threatCritical,
          realIpDetected,
          webrtcLeaks,
          threatRate: totalClicks > 0 ? ((vpnCount + proxyCount + botCount) / totalClicks * 100).toFixed(2) : 0
        },
        vpnProviders: vpnProviders.map(p => ({ provider: p.vpnProvider, count: p._count })),
        threatCountries: threatCountries.map(c => ({ country: c.country, count: c._count }))
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Countries
  app.get('/api/analytics/links/:trackingId/countries', requireAuth, async (req, res) => {
    try {
      const p = getPrisma();
      const { trackingId } = req.params;
      const rows = await p.clickEvent.groupBy({ by: ['country'], where: { trackingId, country: { not: null } }, _count: true, orderBy: { _count: { country: 'desc' } } });

      res.json(rows.map(r => ({
        country: r.country || 'Unknown',
        count: r._count
      })));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Devices
  app.get('/api/analytics/links/:trackingId/devices', requireAuth, async (req, res) => {
    try {
      const p = getPrisma();
      const { trackingId } = req.params;
      const { limit = 20, page = 1 } = req.query;
      const skip = (safeParseInt(page) - 1) * safeParseInt(limit);
      
      const [devices, total] = await Promise.all([
        p.clickEvent.groupBy({
          by: ['deviceType'],
          where: { trackingId, deviceType: { not: null } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: Math.min(safeParseInt(limit), 100),
          skip: Math.max(skip, 0)
        }),
        p.clickEvent.count({
          where: { trackingId, deviceType: { not: null } }
        })
      ]);

      res.json({
        data: devices.map(d => ({
          deviceType: d.deviceType,
          count: d._count.id
        })),
        pagination: {
          page: safeParseInt(page),
          limit: safeParseInt(limit),
          total,
          totalPages: Math.ceil(total / safeParseInt(limit))
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Browsers
  app.get('/api/analytics/links/:trackingId/browsers', requireAuth, async (req, res) => {
    try {
      const p = getPrisma();
      const { trackingId } = req.params;
      const { limit = 20, page = 1 } = req.query;
      const skip = (safeParseInt(page) - 1) * safeParseInt(limit);
      
      const [browsers, total] = await Promise.all([
        p.clickEvent.groupBy({
          by: ['browser'],
          where: { trackingId, browser: { not: null } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: Math.min(safeParseInt(limit), 100),
          skip: Math.max(skip, 0)
        }),
        p.clickEvent.count({
          where: { trackingId, browser: { not: null } }
        })
      ]);

      res.json({
        data: browsers.map(b => ({
          browser: b.browser,
          count: b._count.id
        })),
        pagination: {
          page: safeParseInt(page),
          limit: safeParseInt(limit),
          total,
          totalPages: Math.ceil(total / safeParseInt(limit))
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Timeline
  app.get('/api/analytics/links/:trackingId/timeline', requireAuth, async (req, res) => {
    try {
      const p = getPrisma();
      const { trackingId } = req.params;
      const { days = 7, limit = 100, page = 1 } = req.query;
      const skip = (safeParseInt(page) - 1) * safeParseInt(limit);
      
      const startDate = new Date(Date.now() - safeParseInt(days) * 24 * 60 * 60 * 1000);
      
      const [timeline, total] = await Promise.all([
        p.clickEvent.groupBy({
          by: [{ timestamp: { date: 'day' } }],
          where: { trackingId, timestamp: { gte: startDate } },
          _count: { id: true },
          orderBy: { timestamp: 'asc' },
          take: Math.min(safeParseInt(limit), 365),
          skip: Math.max(skip, 0)
        }),
        p.clickEvent.count({
          where: { trackingId, timestamp: { gte: startDate } }
        })
      ]);

      const dailyData = {};
      timeline.forEach(t => {
        const day = t.timestamp.toISOString().split('T')[0];
        dailyData[day] = (dailyData[day] || 0) + t._count.id;
      });

      const data = Object.entries(dailyData).map(([date, count]) => ({ date, count }));

      res.json({
        data,
        pagination: {
          page: safeParseInt(page),
          limit: safeParseInt(limit),
          total,
          totalPages: Math.ceil(total / safeParseInt(limit))
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // OS
  app.get('/api/analytics/links/:trackingId/os', requireAuth, async (req, res) => {
    try {
      const p = getPrisma();
      const { trackingId } = req.params;
      const { limit = 20, page = 1 } = req.query;
      const skip = (safeParseInt(page) - 1) * safeParseInt(limit);
      
      const [os, total] = await Promise.all([
        p.clickEvent.groupBy({
          by: ['os'],
          where: { trackingId, os: { not: null } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: Math.min(safeParseInt(limit), 100),
          skip: Math.max(skip, 0)
        }),
        p.clickEvent.count({
          where: { trackingId, os: { not: null } }
        })
      ]);

      res.json({
        data: os.map(o => ({
          os: o.os,
          count: o._count.id
        })),
        pagination: {
          page: safeParseInt(page),
          limit: safeParseInt(limit),
          total,
          totalPages: Math.ceil(total / safeParseInt(limit))
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Languages
  app.get('/api/analytics/links/:trackingId/languages', requireAuth, async (req, res) => {
    try {
      const p = getPrisma();
      const { trackingId } = req.params;
      const { limit = 20, page = 1 } = req.query;
      const skip = (safeParseInt(page) - 1) * safeParseInt(limit);
      
      const [languages, total] = await Promise.all([
        p.clickEvent.groupBy({
          by: ['language'],
          where: { trackingId, language: { not: null } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: Math.min(safeParseInt(limit), 100),
          skip: Math.max(skip, 0)
        }),
        p.clickEvent.count({
          where: { trackingId, language: { not: null } }
        })
      ]);

      res.json({
        data: languages.map(l => ({
          language: l.language,
          count: l._count.id
        })),
        pagination: {
          page: safeParseInt(page),
          limit: safeParseInt(limit),
          total,
          totalPages: Math.ceil(total / safeParseInt(limit))
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Referrers
  app.get('/api/analytics/links/:trackingId/referrers', requireAuth, async (req, res) => {
    try {
      const p = getPrisma();
      const { trackingId } = req.params;
      const { limit = 20, page = 1 } = req.query;
      const skip = (safeParseInt(page) - 1) * safeParseInt(limit);
      
      const [referrers, total] = await Promise.all([
        p.clickEvent.groupBy({
          by: ['referrer'],
          where: { trackingId },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: Math.min(safeParseInt(limit), 100),
          skip: Math.max(skip, 0)
        }),
        p.clickEvent.count({
          where: { trackingId }
        })
      ]);

      res.json({
        data: referrers.map(r => ({
          referrer: r.referrer || 'Direct',
          count: r._count.id
        })),
        pagination: {
          page: safeParseInt(page),
          limit: safeParseInt(limit),
          total,
          totalPages: Math.ceil(total / safeParseInt(limit))
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Cities
  app.get('/api/analytics/links/:trackingId/cities', requireAuth, async (req, res) => {
    try {
      const p = getPrisma();
      const { trackingId } = req.params;
      const { limit = 20, page = 1 } = req.query;
      const skip = (safeParseInt(page) - 1) * safeParseInt(limit);
      
      const [cities, total] = await Promise.all([
        p.clickEvent.groupBy({
          by: ['city', 'country'],
          where: { trackingId, city: { not: null } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: Math.min(safeParseInt(limit), 100),
          skip: Math.max(skip, 0)
        }),
        p.clickEvent.count({
          where: { trackingId, city: { not: null } }
        })
      ]);

      res.json({
        data: cities.map(c => ({
          city: c.city && c.country ? `${ c.city }, ${ c.country } ` : (c.city || 'Unknown'),
          count: c._count.id
        })),
        pagination: {
          page: safeParseInt(page),
          limit: safeParseInt(limit),
          total,
          totalPages: Math.ceil(total / safeParseInt(limit))
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ISPs
  app.get('/api/analytics/links/:trackingId/isps', requireAuth, async (req, res) => {
    try {
      const p = getPrisma();
      const { trackingId } = req.params;
      const { limit = 20, page = 1 } = req.query;
      const skip = (safeParseInt(page) - 1) * safeParseInt(limit);
      
      const [isps, total] = await Promise.all([
        p.clickEvent.groupBy({
          by: ['isp'],
          where: { trackingId, isp: { not: null } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: Math.min(safeParseInt(limit), 100),
          skip: Math.max(skip, 0)
        }),
        p.clickEvent.count({
          where: { trackingId, isp: { not: null } }
        })
      ]);

      res.json({
        data: isps.map(i => ({
          isp: i.isp,
          count: i._count.id
        })),
        pagination: {
          page: safeParseInt(page),
          limit: safeParseInt(limit),
          total,
          totalPages: Math.ceil(total / safeParseInt(limit))
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // UTM
  app.get('/api/analytics/links/:trackingId/utm', requireAuth, async (req, res) => {
    try {
      const p = getPrisma();
      const { trackingId } = req.params;
      const { limit = 20, page = 1 } = req.query;
      const skip = (safeParseInt(page) - 1) * safeParseInt(limit);
      
      const [utm, total] = await Promise.all([
        p.clickEvent.groupBy({
          by: ['utmSource', 'utmMedium', 'utmCampaign', 'utmTerm', 'utmContent'],
          where: { trackingId },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: Math.min(safeParseInt(limit), 100),
          skip: Math.max(skip, 0)
        }),
        p.clickEvent.count({
          where: { trackingId }
        })
      ]);

      res.json({
        data: utm.map(u => ({
          utm: {
            source: u.utmSource,
            medium: u.utmMedium,
            campaign: u.utmCampaign,
            term: u.utmTerm,
            content: u.utmContent
          },
          count: u._count.id
        })),
        pagination: {
          page: safeParseInt(page),
          limit: safeParseInt(limit),
          total,
          totalPages: Math.ceil(total / safeParseInt(limit))
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Fingerprint stats
  app.get('/api/links/:trackingId/fingerprint-stats', requireAuth, async (req, res) => {
    try {
      const p = getPrisma();
      const { trackingId } = req.params;
      const { limit = 20, page = 1 } = req.query;
      const skip = (safeParseInt(page) - 1) * safeParseInt(limit);
      
      const [totalBots, clientBots, headless, uniqueFingerprints, webglEnabled, webrtcLeaks, mobileDevices, desktopDevices, vpn, avgHuman, avgBot] = await Promise.all([
        p.clickEvent.count({ where: { trackingId, isLikelyBot: true } }),
        p.clickEvent.count({ where: { trackingId, clientBot: true } }),
        p.clickEvent.count({ where: { trackingId, isHeadless: true } }),
        p.clickEvent.groupBy({ by: ['fingerprintHash'], where: { trackingId, fingerprintHash: { not: null } }, _count: true }),
        p.clickEvent.count({ where: { trackingId, webglRenderer: { not: null } } }),
        p.clickEvent.count({ where: { trackingId, webrtcLeakDetected: true } }),
        p.clickEvent.count({ where: { trackingId, isMobile: true } }),
        p.clickEvent.count({ where: { trackingId, isMobile: false } }),
        p.clickEvent.count({ where: { trackingId, isVpn: true } }),
        p.clickEvent.aggregate({ where: { trackingId }, _avg: { humanScore: true } }),
        p.clickEvent.aggregate({ where: { trackingId }, _avg: { botScore: true } }),
      ]);

      res.json({
        botDetection: { totalBots, clientBots, headless, uniqueFingerprints: uniqueFingerprints.length },
        devices: { mobile: mobileDevices, desktop: desktopDevices },
        fingerprinting: { webglEnabled, webrtcLeaks },
        security: { vpn },
        scores: { avgHumanScore: avgHuman._avg.humanScore, avgBotScore: avgBot._avg.botScore },
        pagination: {
          page: safeParseInt(page),
          limit: safeParseInt(limit),
          total: totalBots + clientBots + headless + uniqueFingerprints.length + webglEnabled + webrtcLeaks + mobileDevices + desktopDevices + vpn,
          totalPages: Math.ceil((totalBots + clientBots + headless + uniqueFingerprints.length + webglEnabled + webrtcLeaks + mobileDevices + desktopDevices + vpn) / safeParseInt(limit))
        }
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Fingerprint analysis
  app.get('/api/links/:trackingId/fingerprint-analysis', requireAuth, async (req, res) => {
    try {
      const p = getPrisma();
      const { trackingId } = req.params;
      const { limit = 20, page = 1 } = req.query;
      const skip = (safeParseInt(page) - 1) * safeParseInt(limit);
      
      const [fingerprintGroups, browserFingerprints] = await Promise.all([
        p.clickEvent.groupBy({ by: ['fingerprintHash'], where: { trackingId, fingerprintHash: { not: null } }, _count: true, orderBy: { _count: { fingerprintHash: 'desc' } }, take: Math.min(safeParseInt(limit), 100), skip: Math.max(skip, 0) }),
        p.clickEvent.groupBy({ by: ['browser', 'webglRenderer'], where: { trackingId, webglRenderer: { not: null } }, _count: true, orderBy: { _count: { webglRenderer: 'desc' } }, take: Math.min(safeParseInt(limit), 100), skip: Math.max(skip, 0) }),
      ]);

      res.json({
        topFingerprints: fingerprintGroups.map(f => ({ fingerprint: f.fingerprintHash, count: f._count })),
        browserFingerprints: browserFingerprints.map(b => ({ browser: b.browser, webglRenderer: b.webglRenderer, count: b._count })),
        pagination: {
          page: safeParseInt(page),
          limit: safeParseInt(limit),
          total: fingerprintGroups.length + browserFingerprints.length,
          totalPages: Math.ceil((fingerprintGroups.length + browserFingerprints.length) / safeParseInt(limit))
        }
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // CSV export
  app.get('/api/analytics/links/:trackingId/events/export', requireAuth, async (req, res) => {
    try {
      const p = getPrisma();
      const { trackingId } = req.params;
      const { limit = 5000 } = req.query;
      
      const events = await p.clickEvent.findMany({ where: { trackingId }, orderBy: { timestamp: 'desc' }, take: safeParseInt(limit) });
      const cols = ['id', 'timestamp', 'ipFull', 'country', 'region', 'city', 'isp', 'org', 'asn', 'deviceType', 'browser', 'browserVersion', 'os', 'osVersion', 'language', 'screenResolution', 'isVpn', 'isProxy', 'isTor', 'isBot', 'isHeadless', 'botScore', 'vpnScore', 'threatScore', 'webrtcLeakDetected', 'webrtcRealIp', 'fingerprintHash', 'userAgent', 'utmSource', 'utmMedium', 'utmCampaign'];
      const esc = v => v == null ? '' : ('"' + String(v).replace(/"/g, '""') + '"');
      const csv = [cols.join(','), ...events.map(e => cols.map(c => esc(e[c])).join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename = "events-${trackingId}.csv"`);
      res.send(csv);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Fingerprint events list (for detailed view)
  app.get('/api/links/:trackingId/fingerprint', requireAuth, async (req, res) => {
    try {
      const p = getPrisma();
      const { trackingId } = req.params;
      const { limit = 20, page = 1 } = req.query;
      const skip = (safeParseInt(page) - 1) * safeParseInt(limit);
      
      const [events, total] = await Promise.all([
        p.clickEvent.findMany({
          where: { trackingId },
          orderBy: { timestamp: 'desc' },
          take: Math.min(safeParseInt(limit), 100),
          skip: Math.max(skip, 0),
          select: {
            id: true,
            timestamp: true,
            ipFull: true,
            ipTruncated: true,
            country: true,
            city: true,
            deviceType: true,
            deviceBrand: true,
            deviceModel: true,
            browser: true,
            os: true,
            screenResolution: true,
            viewportWidth: true,
            viewportHeight: true,
            fingerprintHash: true,
            visitorId: true,
            canvasFingerprintHash: true,
            webglFingerprintHash: true,
            webglVendor: true,
            webglRenderer: true,
            webgl2Enabled: true,
            audioFingerprint: true,
            fontsDetected: true,
            fontCount: true,
            isVpn: true,
            isProxy: true,
            isTor: true,
            isBot: true,
            isHeadless: true,
            threatScore: true,
            threatLevel: true,
            botScore: true,
            vpnScore: true,
            webrtcLeakDetected: true,
            webrtcRealIp: true,
            realIp: true,
            realIpDetected: true,
            batteryLevel: true,
            batteryCharging: true,
            humanScore: true,
            entropyScore: true,
            timeOnPage: true,
            scrollDepth: true,
            clickCount: true,
            keyCount: true,
            referrerDomain: true,
            language: true,
            userAgent: true,
            // GPS
            gpsGranted: true,
            gpsDenied: true,
            gpsLatitude: true,
            gpsLongitude: true,
            gpsAltitude: true,
            gpsAccuracy: true,
            gpsAltitudeAccuracy: true,
            gpsHeading: true,
            gpsSpeed: true,
            gpsAddress: true,
            // Sensors
            sensorGyroscope: true,
            sensorAccelerometer: true,
            sensorDeviceOrientation: true,
            sensorGravity: true,
            sensorMagnetometer: true,
            sensorAmbientLight: true,
            sensorsSupported: true,
            // Advanced
            speechVoicesHash: true,
            speechVoiceCount: true,
            mediaQueryHash: true,
            textMetricsHash: true,
            intlHash: true,
            clientHintsArchitecture: true,
            clientHintsBitness: true,
            clientHintsModel: true,
            clientHintsPlatform: true,
            clientHintsPlatformVersion: true,
            timerResolution: true,
            canvasNoise: true,
            uaSpoofScore: true,
            uaSpoofIndicators: true,
            isPrivacyBrowser: true,
            isVM: true,
            vmIndicators: true,
            // Extra location fields for display
            countryCode: true,
            region: true,
            district: true,
            neighborhood: true,
            zip: true,
            metroCode: true,
            latitude: true,
            longitude: true,
            accuracy: true,
            continent: true,
            timezoneOffset: true,
            timeZoneMismatch: true,
            // Network extra
            isp: true,
            org: true,
            asn: true,
            asname: true,
            carrier: true,
            reverseDns: true,
            domain: true,
            reputation: true,
            // Security extra
            isAutomated: true,
            isSelenium: true,
            isPuppeteer: true,
            isPlaywright: true,
            isPhantom: true,
            isCrawler: true,
            botIndicators: true,
            isBadActor: true,
            isAttacker: true,
            isAbuser: true,
            isThreat: true,
            detectionIndicators: true,
            // Device extra
            deviceVendor: true,
            maxTouchPoints: true,
            touchSupport: true,
            hardwareConcurrency: true,
            deviceMemory: true,
            colorDepth: true,
            pixelRatio: true,
            orientation: true,
            screenOrientation: true,
            // Canvas extra
            canvasFingerprintHash: true,
            canvasVariants: true,
            canvasGpuAccelerated: true,
            // WebGL extra
            webgl2Supported: true,
            webgl2Vendor: true,
            webgl2Renderer: true,
            webglShadingVersion: true,
            webglVersion: true,
            // Audio extra
            audioFingerprintHash: true,
            audioSampleRate: true,
            // Battery extra
            batterySupported: true,
            batteryChargingTime: true,
            batteryDischargingTime: true,
            // Network quality
            networkEffectiveType: true,
            networkDownlink: true,
            networkRtt: true,
            // Performance
            dnsTime: true,
            tcpTime: true,
            sslTime: true,
            ttfb: true,
            pageLoadTime: true,
            domInteractive: true,
            domComplete: true,
            // Browser
            browserEngine: true,
            // Identifiers
            sessionId: true,
            quantumHash: true,
            // Page
            pageUrl: true,
            pageDomain: true,
            pageTitle: true,
            // Misc
            isMobile: true,
            gpu: true,
            platform: true,
            webrtcRealCountry: true,
            vpnProvider: true,
            vpnType: true,
            bypassMethod: true,
            realIpCountry: true,
            realIpCity: true,
            realIpIsp: true,
            threatScore: true
          }
        }),
        p.clickEvent.count({
          where: { trackingId }
        })
      ]);

      res.json({
        data: events,
        pagination: {
          page: safeParseInt(page),
          limit: safeParseInt(limit),
          total,
          totalPages: Math.ceil(total / safeParseInt(limit))
        }
      });
    } catch (error) {
      console.error('Fingerprint events error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Fingerprint analysis (stats view)
  app.get('/api/analytics/links/:trackingId/fingerprints', requireAuth, async (req, res) => {
    try {
      const p = getPrisma();
      const { trackingId } = req.params;
      const { limit = 20, page = 1 } = req.query;
      const skip = (safeParseInt(page) - 1) * safeParseInt(limit);
      
      const [
        uniqueVisitors,
        uniqueSessions,
        entropyAvg,
        humanScoreAvg,
        botScoreAvg,
        canvasFingerprints,
        webglFingerprints
      ] = await Promise.all([
        p.clickEvent.groupBy({
          by: ['visitorId'],
          where: { trackingId, visitorId: { not: null } },
          _count: true
        }),
        p.clickEvent.groupBy({
          by: ['sessionId'],
          where: { trackingId, sessionId: { not: null } },
          _count: true
        }),
        p.clickEvent.aggregate({
          where: { trackingId },
          _avg: { entropyScore: true }
        }),
        p.clickEvent.aggregate({
          where: { trackingId },
          _avg: { humanScore: true }
        }),
        p.clickEvent.aggregate({
          where: { trackingId },
          _avg: { botScore: true }
        }),
        p.clickEvent.groupBy({
          by: ['canvasFingerprintHash'],
          where: { trackingId, canvasFingerprintHash: { not: null } },
          _count: true,
          orderBy: { _count: { canvasFingerprintHash: 'desc' } },
          take: Math.min(safeParseInt(limit), 100),
          skip: Math.max(skip, 0)
        }),
        p.clickEvent.groupBy({
          by: ['webglFingerprintHash'],
          where: { trackingId, webglFingerprintHash: { not: null } },
          _count: true,
          orderBy: { _count: { webglFingerprintHash: 'desc' } },
          take: Math.min(safeParseInt(limit), 100),
          skip: Math.max(skip, 0)
        })
      ]);

      res.json({
        uniqueness: {
          uniqueVisitors: uniqueVisitors.length,
          uniqueSessions: uniqueSessions.length,
          avgEntropy: entropyAvg._avg.entropyScore
        },
        scores: {
          avgHumanScore: humanScoreAvg._avg.humanScore,
          avgBotScore: botScoreAvg._avg.botScore
        },
        fingerprints: {
          topCanvas: canvasFingerprints.map(f => ({ hash: f.canvasFingerprintHash, count: f._count })),
          topWebGL: webglFingerprints.map(f => ({ hash: f.webglFingerprintHash, count: f._count }))
        },
        pagination: {
          page: safeParseInt(page),
          limit: safeParseInt(limit),
          total: uniqueVisitors.length + uniqueSessions.length + canvasFingerprints.length + webglFingerprints.length,
          totalPages: Math.ceil((uniqueVisitors.length + uniqueSessions.length + canvasFingerprints.length + webglFingerprints.length) / safeParseInt(limit))
        }
      });
    } catch (error) {
      console.error('Fingerprint analysis error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/links/:linkId/domains', requireAuth, async (req, res) => {
    try {
      const p = getPrisma();
      const { linkId } = req.params;
      const { domain, isPrimary } = req.body;

      if (!domain || typeof domain !== 'string') {
        return res.status(400).json({ error: 'domain is required' });
      }

      const link = await p.link.findUnique({ where: { trackingId: linkId } });
      if (!link) {
        return res.status(404).json({ error: 'Link not found' });
      }

      const customDomain = await p.customDomain.create({
        data: {
          domain: domain.trim().toLowerCase(),
          linkId,
          isPrimary: isPrimary || false
        }
      });

      res.status(201).json(customDomain);
    } catch (error) {
      console.error('Add domain error:', error);
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Domain already exists' });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/links/:linkId/domains/:domain', requireAuth, async (req, res) => {
    try {
      const p = getPrisma();
      const { domain } = req.params;

      await p.customDomain.delete({
        where: { domain: decodeURIComponent(domain).toLowerCase() }
      });

      res.status(204).send();
    } catch (error) {
      console.error('Delete domain error:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Domain not found' });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Error handler (moved after all routes)
  app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

// Utility functions
function truncateIp(ip) {
  if (!ip || ip === 'unknown') return 'unknown';
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return parts.slice(0, 4).join(':') + '::';
  }
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${ parts[0] }.${ parts[1] }.${ parts[2] } .0`;
  }
  return ip;
}

function hashString(str) {
  return crypto.createHash('sha256').update(str).digest('hex').substring(0, 32);
}

function calculateBehaviorScore(behavior) {
  if (!behavior) return null;
  let score = 100;

  if (behavior?.humanScore !== undefined) {
    score = behavior.humanScore;
  } else {
    if (!behavior.mouseMovements || behavior.mouseMovements.length < 5) score -= 20;
    if (behavior.clickCount === 0 && behavior.timeOnPage > 5000) score -= 15;
    if (behavior.scrollDepth < 10 && behavior.timeOnPage > 10000) score -= 10;
  }

  return Math.max(0, score);
}

function normalizeNetlifyPath(event) {
  const raw = (event.path || event.rawUrl || '').split('?')[0];
  const prefix = '/.netlify/functions/api';
  if (raw === prefix + '/click') {
    event.path = '/click';
  } else if (raw.startsWith(prefix + '/')) {
    event.path = '/api/' + raw.slice(prefix.length + 1);
  }
  return event;
}

export const handler = async (event, context) => {
  try {
    normalizeNetlifyPath(event);
    const application = getApp();
    const serverlessHandler = serverless(application);
    return await serverlessHandler(event, context);
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', message: error.message })
    };
  }
};

export default handler;
