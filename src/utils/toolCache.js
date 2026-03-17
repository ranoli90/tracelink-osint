/**
 * Tool Availability Cache
 * 
 * This module provides caching for OSINT tool availability checks to improve performance
 * and reduce system resource usage.
 */

import crypto from 'crypto';

// Cache configuration
const CACHE_CONFIG = {
  ttl: 5 * 60 * 1000, // 5 minutes TTL
  maxSize: 100, // Maximum cached items
  cleanupInterval: 60 * 1000 // Cleanup every minute
};

// In-memory cache storage
const cache = new Map();

// Cache item structure
class CacheItem {
  constructor(data, ttl = CACHE_CONFIG.ttl) {
    this.data = data;
    this.createdAt = Date.now();
    this.expiresAt = this.createdAt + ttl;
    this.accessCount = 0;
    this.lastAccessed = this.createdAt;
  }

  isExpired() {
    return Date.now() > this.expiresAt;
  }

  isExpired(maxAge) {
    return Date.now() - this.createdAt > maxAge;
  }

  touch() {
    this.accessCount++;
    this.lastAccessed = Date.now();
  }

  get size() {
    return JSON.stringify(this.data).length;
  }
}

/**
 * Tool Availability Cache Manager
 */
export class ToolAvailabilityCache {
  constructor() {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      cleanups: 0
    };
    
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, CACHE_CONFIG.cleanupInterval);
  }

  /**
   * Get cached tool availability
   */
  get(tool) {
    const key = this.generateKey(tool);
    const item = cache.get(key);
    
    if (!item) {
      this.stats.misses++;
      return null;
    }
    
    if (item.isExpired()) {
      cache.delete(key);
      this.stats.evictions++;
      return null;
    }
    
    item.touch();
    this.stats.hits++;
    
    return item.data;
  }

  /**
   * Set tool availability in cache
   */
  set(tool, data) {
    const key = this.generateKey(tool);
    
    // Check cache size limit
    if (cache.size >= CACHE_CONFIG.maxSize) {
      this.evictLeastRecentlyUsed();
    }
    
    const item = new CacheItem(data);
    cache.set(key, item);
    
    return item;
  }

  /**
   * Check if tool is cached
   */
  has(tool) {
    const key = this.generateKey(tool);
    const item = cache.get(key);
    
    if (!item || item.isExpired()) {
      return false;
    }
    
    return true;
  }

  /**
   * Delete cached tool
   */
  delete(tool) {
    const key = this.generateKey(tool);
    return cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear() {
    cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.evictions = 0;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests * 100).toFixed(2) : '0.00';
    
    return {
      ...this.stats,
      totalRequests,
      hitRate: `${hitRate}%`,
      size: cache.size,
      maxSize: CACHE_CONFIG.maxSize,
      ttl: CACHE_CONFIG.ttl,
      memoryUsage: this.getMemoryUsage()
    };
  }

  /**
   * Get memory usage of cache
   */
  getMemoryUsage() {
    let totalSize = 0;
    for (const item of cache.values()) {
      totalSize += item.size();
    }
    return totalSize;
  }

  /**
   * Generate cache key for tool
   */
  generateKey(tool) {
    return `tool:${tool}`;
  }

  /**
   * Evict least recently used items
   */
  evictLeastRecentlyUsed() {
    let lruKey = null;
    let lruTime = Date.now();
    
    for (const [key, item] of cache.entries()) {
      if (item.lastAccessed < lruTime) {
        lruKey = key;
        lruTime = item.lastAccessed;
      }
    }
    
    if (lruKey) {
      cache.delete(lruKey);
      this.stats.evictions++;
    }
  }

  /**
   * Clean up expired items
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, item] of cache.entries()) {
      if (item.isExpired()) {
        cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.stats.cleanups++;
      this.stats.evictions += cleaned;
    }
  }

  /**
   * Get all cached tools
   */
  getAll() {
    const result = {};
    
    for (const [key, item] of cache.entries()) {
      if (!item.isExpired()) {
        const tool = key.replace('tool:', '');
        result[tool] = {
          ...item.data,
          cachedAt: new Date(item.createdAt).toISOString(),
          expiresAt: new Date(item.expiresAt).toISOString(),
          accessCount: item.accessCount,
          lastAccessed: new Date(item.lastAccessed).toISOString()
        };
      }
    }
    
    return result;
  }

  /**
   * Warm up cache with common tools
   */
  async warmup(checkToolFunction) {
    const commonTools = ['spiderfoot', 'maigret', 'sherlock', 'holehe', 'phoneinfoga'];
    
    for (const tool of commonTools) {
      if (!this.has(tool)) {
        try {
          const availability = await checkToolFunction(tool);
          this.set(tool, availability);
        } catch (error) {
          // Continue warming up other tools
          continue;
        }
      }
    }
  }

  /**
   * Preload cache with data
   */
  preload(data) {
    for (const [tool, availability] of Object.entries(data)) {
      this.set(tool, availability);
    }
  }

  /**
   * Export cache data for persistence
   */
  export() {
    return this.getAll();
  }

  /**
   * Import cache data from persistence
   */
  import(data) {
    this.preload(data);
  }

  /**
   * Destroy cache and cleanup
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// Global cache instance
let toolCache = null;

/**
 * Get or create the tool cache instance
 */
export function getToolCache() {
  if (!toolCache) {
    toolCache = new ToolAvailabilityCache();
  }
  return toolCache;
}

/**
 * Initialize the tool cache
 */
export function initializeToolCache(checkToolFunction) {
  const cache = getToolCache();
  
  // Warm up cache asynchronously
  setTimeout(() => {
    cache.warmup(checkToolFunction);
  }, 1000);
  
  return cache;
}

/**
 * Cache middleware for Express
 */
export function cacheMiddleware(req, res, next) {
  const cache = getToolCache();
  
  // Add cache to request object
  req.toolCache = cache;
  
  // Add cache stats to response headers
  res.on('finish', () => {
    const stats = cache.getStats();
    res.set('X-Cache-Hits', stats.hits);
    res.set('X-Cache-Misses', stats.misses);
    res.set('X-Cache-Hit-Rate', stats.hitRate);
    res.set('X-Cache-Size', stats.size);
  });
  
  next();
}

/**
 * Cache decorator for functions
 */
export function cached(ttl = CACHE_CONFIG.ttl) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      const cache = getToolCache();
      const cacheKey = `${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`;
      
      // Try to get from cache
      const cached = cache.get(cacheKey);
      if (cached !== null) {
        return cached;
      }
      
      // Execute original method
      const result = await originalMethod.apply(this, args);
      
      // Cache the result
      cache.set(cacheKey, result);
      
      return result;
    };
    
    return descriptor;
  };
}

export default {
  ToolAvailabilityCache,
  getToolCache,
  initializeToolCache,
  cacheMiddleware,
  cached
};
