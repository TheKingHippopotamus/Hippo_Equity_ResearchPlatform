/**
 * Frontend validation utilities
 * Implements Requirement 9.5: Input Validation Feedback
 */

export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'zh', 'he'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export interface ValidationResult {
  valid: boolean;
  error?: string;
  normalized?: string;
}

/**
 * Validate stock symbol
 * Provides inline validation feedback before submission
 */
export function validateStockSymbol(symbol: string): ValidationResult {
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

  // Allow alphanumeric characters, dots, and hyphens
  const symbolPattern = /^[A-Z0-9.\-]+$/;
  if (!symbolPattern.test(trimmed)) {
    return { 
      valid: false, 
      error: 'Stock symbol can only contain letters, numbers, dots, and hyphens' 
    };
  }

  return { valid: true, normalized: trimmed };
}

/**
 * Validate language code
 */
export function validateLanguage(language: string): ValidationResult {
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
 * Validate multiple stock symbols
 */
export function validateStockSymbols(symbols: string[]): {
  valid: boolean;
  errors?: Array<{ index: number; error: string }>;
  normalized?: string[];
} {
  if (!Array.isArray(symbols)) {
    return { 
      valid: false, 
      errors: [{ index: -1, error: 'Symbols must be an array' }] 
    };
  }

  if (symbols.length === 0) {
    return { 
      valid: false, 
      errors: [{ index: -1, error: 'At least one symbol is required' }] 
    };
  }

  if (symbols.length > 100) {
    return { 
      valid: false, 
      errors: [{ index: -1, error: 'Maximum 100 symbols allowed' }] 
    };
  }

  const errors: Array<{ index: number; error: string }> = [];
  const normalized: string[] = [];

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    const validation = validateStockSymbol(symbol);
    
    if (!validation.valid) {
      errors.push({
        index: i,
        error: validation.error || 'Invalid symbol'
      });
    } else if (validation.normalized) {
      normalized.push(validation.normalized);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, normalized };
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

