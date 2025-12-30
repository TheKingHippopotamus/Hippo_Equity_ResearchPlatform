import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

/**
 * Supported languages for validation
 */
export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'zh', 'he'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

/**
 * Validation errors interface
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Input validation middleware
 * Implements Requirement 9.5: Input Validation Feedback
 */
class Validators {
  /**
   * Validate stock symbol
   * Stock symbols should be 1-10 uppercase alphanumeric characters
   */
  validateStockSymbol(symbol: string): { valid: boolean; error?: string } {
    if (!symbol || typeof symbol !== 'string') {
      return { valid: false, error: 'Stock symbol is required' };
    }

    const trimmed = symbol.trim().toUpperCase();
    
    if (trimmed.length === 0) {
      return { valid: false, error: 'Stock symbol cannot be empty' };
    }

    if (trimmed.length > 10) {
      return { valid: false, error: 'Stock symbol must be 10 characters or less' };
    }

    // Allow alphanumeric characters, dots, and hyphens (e.g., BRK.B, BRK-A)
    const symbolPattern = /^[A-Z0-9.\-]+$/;
    if (!symbolPattern.test(trimmed)) {
      return { 
        valid: false, 
        error: 'Stock symbol can only contain letters, numbers, dots, and hyphens' 
      };
    }

    return { valid: true };
  }

  /**
   * Validate language code
   */
  validateLanguage(language: string): { valid: boolean; error?: string; normalized?: SupportedLanguage } {
    if (!language || typeof language !== 'string') {
      return { valid: false, error: 'Language code is required' };
    }

    const normalized = language.toLowerCase().trim() as SupportedLanguage;
    
    if (!SUPPORTED_LANGUAGES.includes(normalized)) {
      return { 
        valid: false, 
        error: `Language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}` 
      };
    }

    return { valid: true, normalized };
  }

  /**
   * Validate user ID
   */
  validateUserId(userId: string): { valid: boolean; error?: string } {
    if (!userId || typeof userId !== 'string') {
      return { valid: false, error: 'User ID is required' };
    }

    const trimmed = userId.trim();
    
    if (trimmed.length === 0) {
      return { valid: false, error: 'User ID cannot be empty' };
    }

    if (trimmed.length > 255) {
      return { valid: false, error: 'User ID must be 255 characters or less' };
    }

    // Allow alphanumeric, underscores, hyphens, and dots
    const userIdPattern = /^[a-zA-Z0-9._-]+$/;
    if (!userIdPattern.test(trimmed)) {
      return { 
        valid: false, 
        error: 'User ID can only contain letters, numbers, dots, underscores, and hyphens' 
      };
    }

    return { valid: true };
  }

  /**
   * Sanitize string input to prevent injection attacks
   * Implements Requirement 10.4: Input sanitization
   */
  sanitizeString(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    // Remove null bytes and control characters
    let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    // Limit length to prevent DoS
    if (sanitized.length > 10000) {
      sanitized = sanitized.substring(0, 10000);
    }

    return sanitized;
  }

  /**
   * Sanitize object to prevent injection attacks
   */
  sanitizeObject(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (typeof obj === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeString(key);
        sanitized[sanitizedKey] = this.sanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Middleware to validate stock symbol in URL params
   */
  validateStockSymbolParam(req: Request, res: Response, next: NextFunction): void {
    const { symbol } = req.params;
    
    if (!symbol) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Stock symbol is required',
        field: 'symbol'
      });
      return;
    }

    const validation = this.validateStockSymbol(symbol);
    
    if (!validation.valid) {
      res.status(400).json({
        error: 'Validation Error',
        message: validation.error,
        field: 'symbol',
        value: symbol
      });
      return;
    }

    // Normalize symbol to uppercase
    req.params.symbol = symbol.trim().toUpperCase();
    next();
  }

  /**
   * Middleware to validate language code in query params
   */
  validateLanguageQuery(req: Request, res: Response, next: NextFunction): void {
    const language = req.query.language as string;
    
    if (!language) {
      // Language is optional, default to 'en'
      req.query.language = 'en';
      next();
      return;
    }

    const validation = this.validateLanguage(language);
    
    if (!validation.valid) {
      res.status(400).json({
        error: 'Validation Error',
        message: validation.error,
        field: 'language',
        value: language
      });
      return;
    }

    // Normalize language
    if (validation.normalized) {
      req.query.language = validation.normalized;
    }
    next();
  }

  /**
   * Middleware to validate and sanitize request body
   */
  sanitizeRequestBody = (req: Request, res: Response, next: NextFunction): void => {
    if (req.body && typeof req.body === 'object') {
      try {
        req.body = this.sanitizeObject(req.body) as typeof req.body;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Failed to sanitize request body: ${errorMessage}`);
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid request body format'
        });
        return;
      }
    }
    next();
  };

  /**
   * Middleware to validate user ID in params or body
   */
  validateUserIdParam(req: Request, res: Response, next: NextFunction): void {
    const userId = req.params.userId || (req.body?.userId as string);
    
    if (!userId) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'User ID is required',
        field: 'userId'
      });
      return;
    }

    const validation = this.validateUserId(userId);
    
    if (!validation.valid) {
      res.status(400).json({
        error: 'Validation Error',
        message: validation.error,
        field: 'userId',
        value: userId
      });
      return;
    }

    next();
  }

  /**
   * Validate multiple stock symbols (for autopilot queue)
   */
  validateStockSymbols(symbols: string[]): { valid: boolean; errors?: ValidationError[]; normalized?: string[] } {
    if (!Array.isArray(symbols)) {
      return { 
        valid: false, 
        errors: [{ field: 'symbols', message: 'Symbols must be an array' }] 
      };
    }

    if (symbols.length === 0) {
      return { 
        valid: false, 
        errors: [{ field: 'symbols', message: 'At least one symbol is required' }] 
      };
    }

    if (symbols.length > 100) {
      return { 
        valid: false, 
        errors: [{ field: 'symbols', message: 'Maximum 100 symbols allowed' }] 
      };
    }

    const errors: ValidationError[] = [];
    const normalized: string[] = [];

    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];
      const validation = this.validateStockSymbol(symbol);
      
      if (!validation.valid) {
        errors.push({
          field: `symbols[${i}]`,
          message: validation.error || 'Invalid symbol',
          value: symbol
        });
      } else {
        normalized.push(symbol.trim().toUpperCase());
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return { valid: true, normalized };
  }
}

// Singleton instance
const validators = new Validators();

export default validators;
