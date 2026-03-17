#!/usr/bin/env node

/**
 * Environment Variables Validation Script
 * 
 * This script validates that all required environment variables are set
 * and provides helpful error messages for missing configurations.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

// Environment variable definitions
const envVars = {
  // Required variables
  required: {
    DATABASE_URL: {
      description: 'PostgreSQL database connection string',
      validator: (value) => {
        try {
          const url = new URL(value);
          return url.protocol === 'postgresql:' || url.protocol === 'postgres:';
        } catch {
          return false;
        }
      },
      example: 'postgresql://username:password@localhost:5432/tracelink'
    }
  },

  // Optional but recommended
  recommended: {
    BASE_URL: {
      description: 'Base URL for the application',
      validator: (value) => {
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      },
      example: 'https://your-domain.com'
    },
    BOT_TOKEN: {
      description: 'Telegram bot token',
      validator: (value) => typeof value === 'string' && value.length > 0,
      example: '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz'
    },
    ADMIN_TELEGRAM_IDS: {
      description: 'Comma-separated list of admin Telegram user IDs',
      validator: (value) => {
        if (!value) return true; // Optional
        return value.split(',').every(id => {
          const trimmed = id.trim();
          return /^\d+$/.test(trimmed) && trimmed.length > 0;
        });
      },
      example: '123456789,987654321'
    }
  },

  // Optional variables with defaults
  optional: {
    PORT: {
      description: 'Port for the Express server',
      validator: (value) => {
        const port = parseInt(value);
        return !isNaN(port) && port > 0 && port < 65536;
      },
      default: '3000',
      example: '8080'
    },
    NODE_ENV: {
      description: 'Environment mode',
      validator: (value) => ['development', 'production', 'test'].includes(value),
      default: 'development',
      example: 'production'
    },
    LOG_LEVEL: {
      description: 'Logging level',
      validator: (value) => ['debug', 'info', 'warn', 'error'].includes(value),
      default: 'info',
      example: 'warn'
    },
    REDIS_URL: {
      description: 'Redis connection URL for caching',
      validator: (value) => {
        if (!value) return true; // Optional
        try {
          const url = new URL(value);
          return url.protocol === 'redis:';
        } catch {
          return false;
        }
      },
      example: 'redis://localhost:6379'
    }
  }
};

// Validation function
function validateEnvironment() {
  console.log('🔍 Validating environment variables...\n');

  let hasErrors = false;
  let hasWarnings = false;

  // Check required variables
  console.log('📋 Required Variables:');
  for (const [key, config] of Object.entries(envVars.required)) {
    const value = process.env[key];
    
    if (!value) {
      console.error(`❌ ${key}: Missing (required)`);
      console.error(`   Description: ${config.description}`);
      console.error(`   Example: ${config.example}\n`);
      hasErrors = true;
    } else if (!config.validator(value)) {
      console.error(`❌ ${key}: Invalid format`);
      console.error(`   Current value: ${value}`);
      console.error(`   Description: ${config.description}`);
      console.error(`   Example: ${config.example}\n`);
      hasErrors = true;
    } else {
      console.log(`✅ ${key}: Valid`);
    }
  }

  // Check recommended variables
  console.log('\n⚠️  Recommended Variables:');
  for (const [key, config] of Object.entries(envVars.recommended)) {
    const value = process.env[key];
    
    if (!value) {
      console.warn(`⚠️  ${key}: Not set (recommended)`);
      console.warn(`   Description: ${config.description}`);
      console.warn(`   Example: ${config.example}\n`);
      hasWarnings = true;
    } else if (!config.validator(value)) {
      console.warn(`⚠️  ${key}: Invalid format`);
      console.warn(`   Current value: ${value}`);
      console.warn(`   Description: ${config.description}`);
      console.warn(`   Example: ${config.example}\n`);
      hasWarnings = true;
    } else {
      console.log(`✅ ${key}: Valid`);
    }
  }

  // Check optional variables
  console.log('\n💡 Optional Variables:');
  for (const [key, config] of Object.entries(envVars.optional)) {
    const value = process.env[key];
    
    if (!value) {
      console.log(`ℹ️  ${key}: Not set (using default: ${config.default})`);
      console.log(`   Description: ${config.description}`);
      console.log(`   Example: ${config.example}\n`);
    } else if (!config.validator(value)) {
      console.warn(`⚠️  ${key}: Invalid format, using default`);
      console.warn(`   Current value: ${value}`);
      console.warn(`   Default: ${config.default}`);
      console.warn(`   Description: ${config.description}\n`);
      hasWarnings = true;
    } else {
      console.log(`✅ ${key}: Valid (${value})`);
    }
  }

  // Summary
  console.log('\n📊 Summary:');
  if (hasErrors) {
    console.error('❌ Validation failed - Please fix the required variables above');
    process.exit(1);
  } else if (hasWarnings) {
    console.warn('⚠️  Validation passed with warnings - Consider setting recommended variables');
    process.exit(0);
  } else {
    console.log('✅ All environment variables are valid!');
    process.exit(0);
  }
}

// Run validation
if (import.meta.url === `file://${process.argv[1]}`) {
  validateEnvironment();
}

export { validateEnvironment };
