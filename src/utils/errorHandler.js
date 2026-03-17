/**
 * Enhanced Error Handler for Better UX
 * 
 * This module provides user-friendly error messages with helpful suggestions
 * and contextual information for various error scenarios.
 */

import crypto from 'crypto';

// Error categories with user-friendly messages
const ERROR_CATEGORIES = {
  VALIDATION: {
    title: 'Invalid Input',
    icon: '⚠️',
    color: '#FFA500',
    suggestions: [
      'Please check your input and try again',
      'Make sure all required fields are filled',
      'Verify the format of your data'
    ]
  },
  AUTHENTICATION: {
    title: 'Authentication Required',
    icon: '🔐',
    color: '#FF6B6B',
    suggestions: [
      'Please log in to access this feature',
      'Check your credentials and try again',
      'Contact support if you need help'
    ]
  },
  AUTHORIZATION: {
    title: 'Access Denied',
    icon: '🚫',
    color: '#FF6B6B',
    suggestions: [
      'You don\'t have permission to perform this action',
      'Contact an administrator if you need access',
      'Check your account permissions'
    ]
  },
  RATE_LIMIT: {
    title: 'Rate Limit Exceeded',
    icon: '⏱️',
    color: '#FFA500',
    suggestions: [
      'Please wait a moment before trying again',
      'Too many requests - slow down and retry',
      'Consider upgrading your plan for higher limits'
    ]
  },
  NETWORK: {
    title: 'Connection Error',
    icon: '🌐',
    color: '#FF6B6B',
    suggestions: [
      'Check your internet connection',
      'Try refreshing the page',
      'The service may be temporarily unavailable'
    ]
  },
  DATABASE: {
    title: 'Service Unavailable',
    icon: '🗄️',
    color: '#FF6B6B',
    suggestions: [
      'The service is temporarily unavailable',
      'Please try again in a few moments',
      'Contact support if the problem persists'
    ]
  },
  NOT_FOUND: {
    title: 'Resource Not Found',
    icon: '🔍',
    color: '#FFA500',
    suggestions: [
      'The requested resource doesn\'t exist',
      'Check the URL or ID you entered',
      'The item may have been deleted'
    ]
  },
  OSINT: {
    title: 'OSINT Scan Failed',
    icon: '🔍',
    color: '#FF6B6B',
    suggestions: [
      'The OSINT tool encountered an error',
      'Try with different parameters',
      'Check if the target is valid and accessible'
    ]
  },
  SYSTEM: {
    title: 'System Error',
    icon: '⚙️',
    color: '#FF6B6B',
    suggestions: [
      'An unexpected error occurred',
      'Please try again later',
      'Contact support if the problem continues'
    ]
  }
};

// Specific error messages with contextual help
const SPECIFIC_ERRORS = {
  'Invalid URL format': {
    category: 'VALIDATION',
    message: 'The URL you entered is not valid',
    help: 'Please enter a complete URL starting with http:// or https://',
    examples: ['https://example.com', 'http://localhost:3000']
  },
  'destinationUrl is required': {
    category: 'VALIDATION',
    message: 'Please provide a destination URL',
    help: 'Enter the URL where users should be redirected',
    examples: ['https://google.com', 'https://github.com']
  },
  'User not found': {
    category: 'NOT_FOUND',
    message: 'User account not found',
    help: 'Your account may not be registered in the system',
    examples: []
  },
  'Link not found': {
    category: 'NOT_FOUND',
    message: 'The tracking link was not found',
    help: 'Check the link ID or it may have been deleted',
    examples: []
  },
  'You are not authorized to use this command': {
    category: 'AUTHORIZATION',
    message: 'Admin access required for this feature',
    help: 'Only administrators can access this feature',
    examples: []
  },
  'Too many failed attempts': {
    category: 'RATE_LIMIT',
    message: 'Too many login attempts',
    help: 'Please wait before trying to login again',
    examples: []
  },
  'Database temporarily unavailable': {
    category: 'DATABASE',
    message: 'The database is temporarily unavailable',
    help: 'The service is experiencing technical difficulties',
    examples: []
  },
  'Request timeout': {
    category: 'NETWORK',
    message: 'The request took too long to complete',
    help: 'The operation timed out. Please try again',
    examples: []
  },
  'Invalid authentication': {
    category: 'AUTHENTICATION',
    message: 'Authentication failed',
    help: 'Please check your login credentials',
    examples: []
  },
  'SpiderFoot not installed': {
    category: 'OSINT',
    message: 'SpiderFoot tool is not available',
    help: 'The OSINT tool is not installed on the server',
    examples: []
  },
  'Invalid target format': {
    category: 'VALIDATION',
    message: 'The target format is not valid',
    help: 'Please check the target format for this OSINT tool',
    examples: ['example.com', 'username', 'user@example.com', '+1234567890']
  }
};

/**
 * Create a user-friendly error response
 */
export function createFriendlyError(error, context = {}) {
  const errorId = generateErrorId();
  const timestamp = new Date().toISOString();
  
  // Determine error category and message
  const errorInfo = determineErrorInfo(error);
  const category = ERROR_CATEGORIES[errorInfo.category] || ERROR_CATEGORIES.SYSTEM;
  
  // Build the error response
  const friendlyError = {
    error: true,
    errorId,
    timestamp,
    category: errorInfo.category,
    title: category.title,
    icon: category.icon,
    color: category.color,
    message: errorInfo.message,
    help: errorInfo.help,
    suggestions: category.suggestions,
    examples: errorInfo.examples,
    context: {
      endpoint: context.endpoint,
      method: context.method,
      userId: context.userId,
      requestId: context.requestId
    },
    technical: {
      originalError: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }
  };

  return friendlyError;
}

/**
 * Determine error information based on error message
 */
function determineErrorInfo(error) {
  const message = error.message || String(error);
  
  // Check for specific error patterns
  for (const [pattern, info] of Object.entries(SPECIFIC_ERRORS)) {
    if (message.includes(pattern)) {
      return info;
    }
  }
  
  // Categorize based on error type or message patterns
  if (error.name === 'ValidationError' || message.includes('validation')) {
    return {
      category: 'VALIDATION',
      message: 'The input data is not valid',
      help: 'Please check your input and try again',
      examples: []
    };
  }
  
  if (error.name === 'PrismaClientKnownRequestError') {
    return {
      category: 'DATABASE',
      message: 'Database operation failed',
      help: 'The database is temporarily unavailable',
      examples: []
    };
  }
  
  if (message.includes('rate limit') || message.includes('too many')) {
    return {
      category: 'RATE_LIMIT',
      message: 'You\'ve exceeded the rate limit',
      help: 'Please wait before trying again',
      examples: []
    };
  }
  
  if (message.includes('not found') || message.includes('does not exist')) {
    return {
      category: 'NOT_FOUND',
      message: 'The requested resource was not found',
      help: 'Check if the resource exists or the ID is correct',
      examples: []
    };
  }
  
  if (message.includes('unauthorized') || message.includes('forbidden')) {
    return {
      category: 'AUTHORIZATION',
      message: 'You don\'t have permission to perform this action',
      help: 'Contact an administrator if you need access',
      examples: []
    };
  }
  
  if (message.includes('timeout') || message.includes('network')) {
    return {
      category: 'NETWORK',
      message: 'Network connection issue',
      help: 'Check your internet connection and try again',
      examples: []
    };
  }
  
  // Default to system error
  return {
    category: 'SYSTEM',
    message: 'An unexpected error occurred',
    help: 'Please try again later or contact support',
    examples: []
  };
}

/**
 * Generate a unique error ID for tracking
 */
function generateErrorId() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Express middleware for friendly error handling
 */
export function friendlyErrorHandler(error, req, res, next) {
  const context = {
    endpoint: req.path,
    method: req.method,
    userId: req.telegramId || req.user?.id,
    requestId: req.headers['x-request-id']
  };
  
  const friendlyError = createFriendlyError(error, context);
  
  // Log the error for debugging
  console.error(`[${friendlyError.errorId}] ${friendlyError.title}: ${friendlyError.message}`, {
    error: error.message,
    stack: error.stack,
    context
  });
  
  // Determine appropriate status code
  let statusCode = 500;
  switch (friendlyError.category) {
    case 'VALIDATION':
      statusCode = 400;
      break;
    case 'AUTHENTICATION':
      statusCode = 401;
      break;
    case 'AUTHORIZATION':
      statusCode = 403;
      break;
    case 'NOT_FOUND':
      statusCode = 404;
      break;
    case 'RATE_LIMIT':
      statusCode = 429;
      break;
    case 'DATABASE':
    case 'NETWORK':
      statusCode = 503;
      break;
  }
  
  res.status(statusCode).json(friendlyError);
}

/**
 * Create a success response with optional warnings
 */
export function createSuccessResponse(data, warnings = []) {
  return {
    success: true,
    data,
    warnings: warnings.map(warning => ({
      type: 'warning',
      message: warning.message,
      icon: '⚠️',
      color: '#FFA500'
    })),
    timestamp: new Date().toISOString()
  };
}

/**
 * Create a warning response
 */
export function createWarningResponse(message, data = null) {
  return {
    success: true,
    warning: {
      type: 'warning',
      message,
      icon: '⚠️',
      color: '#FFA500'
    },
    data,
    timestamp: new Date().toISOString()
  };
}

/**
 * Format error for Telegram bot responses
 */
export function formatTelegramError(error) {
  const friendlyError = createFriendlyError(error);
  
  let message = `${friendlyError.icon} ${friendlyError.title}\n\n`;
  message += `${friendlyError.message}\n\n`;
  
  if (friendlyError.help) {
    message += `💡 ${friendlyError.help}\n\n`;
  }
  
  if (friendlyError.suggestions && friendlyError.suggestions.length > 0) {
    message += `📝 Suggestions:\n`;
    friendlyError.suggestions.forEach((suggestion, index) => {
      message += `${index + 1}. ${suggestion}\n`;
    });
  }
  
  if (friendlyError.examples && friendlyError.examples.length > 0) {
    message += `\n📋 Examples:\n`;
    friendlyError.examples.forEach(example => {
      message += `• ${example}\n`;
    });
  }
  
  return message;
}

export default {
  createFriendlyError,
  friendlyErrorHandler,
  createSuccessResponse,
  createWarningResponse,
  formatTelegramError
};
