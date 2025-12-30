import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

/**
 * Security middleware
 * Implements Requirements 10.1, 10.3, 10.4
 */

/**
 * Middleware to enforce HTTPS
 * Implements Requirement 10.1: HTTPS Encryption
 */
export function enforceHTTPS(req: Request, res: Response, next: NextFunction): void {
  // In production, check if request is over HTTPS
  // Behind a reverse proxy (Apache), check X-Forwarded-Proto header
  const isHTTPS = 
    req.secure || 
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV !== 'production'; // Allow HTTP in development

  if (!isHTTPS && process.env.NODE_ENV === 'production') {
    logger.warn(`HTTPS enforcement: Blocked HTTP request from ${req.ip} to ${req.url}`);
    res.status(403).json({
      error: 'Forbidden',
      message: 'HTTPS is required for all requests in production',
      timestamp: new Date().toISOString()
    });
    return;
  }

  next();
}

/**
 * Middleware to validate API key
 * Implements Requirement 10.3: API Key Security
 */
export function validateAPIKey(req: Request, res: Response, next: NextFunction): void {
  // API key is optional for public endpoints
  // For protected endpoints, require API key from environment variable
  const requiredAPIKey = process.env.API_KEY;
  const providedAPIKey = req.headers['x-api-key'] as string;

  // If API key is configured, require it
  if (requiredAPIKey) {
    if (!providedAPIKey) {
      logger.warn(`API key validation: Missing API key from ${req.ip} to ${req.url}`);
      res.status(401).json({
        error: 'Unauthorized',
        message: 'API key is required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (providedAPIKey !== requiredAPIKey) {
      logger.warn(`API key validation: Invalid API key from ${req.ip} to ${req.url}`);
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key',
        timestamp: new Date().toISOString()
      });
      return;
    }
  }

  next();
}

/**
 * Session management middleware
 * Tracks and cleans up session data
 * Implements Requirement 10.4: Session Data Cleanup
 */
class SessionManager {
  private sessions: Map<string, { userId: string; lastAccess: Date; data: Record<string, unknown> }> = new Map();
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Start automatic session cleanup
   */
  private startCleanup(): void {
    // Clean up expired sessions every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000);
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const timeSinceLastAccess = now.getTime() - session.lastAccess.getTime();
      
      if (timeSinceLastAccess > this.SESSION_TIMEOUT) {
        this.sessions.delete(sessionId);
        cleanedCount++;
        logger.info(`Cleaned up expired session: ${sessionId}`);
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Session cleanup: Removed ${cleanedCount} expired sessions`);
    }
  }

  /**
   * Get or create session
   */
  getSession(sessionId: string): { userId: string; data: Record<string, unknown> } | null {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Update last access time
    session.lastAccess = new Date();
    
    return {
      userId: session.userId,
      data: session.data
    };
  }

  /**
   * Create or update session
   */
  setSession(sessionId: string, userId: string, data: Record<string, unknown> = {}): void {
    this.sessions.set(sessionId, {
      userId,
      lastAccess: new Date(),
      data
    });
  }

  /**
   * Clear session
   */
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    logger.info(`Cleared session: ${sessionId}`);
  }

  /**
   * Clear all sessions for a user
   */
  clearUserSessions(userId: string): void {
    let clearedCount = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(sessionId);
        clearedCount++;
      }
    }

    if (clearedCount > 0) {
      logger.info(`Cleared ${clearedCount} sessions for user: ${userId}`);
    }
  }

  /**
   * Get session statistics
   */
  getStats(): { totalSessions: number; activeSessions: number } {
    const now = new Date();
    let activeSessions = 0;

    for (const session of this.sessions.values()) {
      const timeSinceLastAccess = now.getTime() - session.lastAccess.getTime();
      if (timeSinceLastAccess <= this.SESSION_TIMEOUT) {
        activeSessions++;
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions
    };
  }

  /**
   * Stop cleanup interval
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton instance
const sessionManager = new SessionManager();

/**
 * Session middleware
 * Manages user sessions and cleans up expired sessions
 */
export function sessionMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Get session ID from cookie or header
  const sessionId = 
    req.cookies?.sessionId || 
    req.headers['x-session-id'] as string ||
    `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Get session data
  const session = sessionManager.getSession(sessionId);
  
  if (session) {
    (req as Request & { sessionId: string; userId: string; sessionData: Record<string, unknown> }).sessionId = sessionId;
    (req as Request & { sessionId: string; userId: string; sessionData: Record<string, unknown> }).userId = session.userId;
    (req as Request & { sessionId: string; userId: string; sessionData: Record<string, unknown> }).sessionData = session.data;
  } else {
    // Create new session if needed
    const userId = (req as Request & { userId?: string }).userId || 'anonymous';
    sessionManager.setSession(sessionId, userId);
    (req as Request & { sessionId: string; userId: string; sessionData: Record<string, unknown> }).sessionId = sessionId;
    (req as Request & { sessionId: string; userId: string; sessionData: Record<string, unknown> }).userId = userId;
    (req as Request & { sessionId: string; userId: string; sessionData: Record<string, unknown> }).sessionData = {};
  }

  // Set session cookie
  res.cookie('sessionId', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 60 * 1000 // 30 minutes
  });

  next();
}

/**
 * Clear session on logout
 */
export function clearSession(req: Request, res: Response, next: NextFunction): void {
  const sessionId = (req as Request & { sessionId?: string }).sessionId;
  
  if (sessionId) {
    sessionManager.clearSession(sessionId);
    res.clearCookie('sessionId');
  }

  next();
}

/**
 * Get session manager instance (for testing and admin endpoints)
 */
export function getSessionManager(): SessionManager {
  return sessionManager;
}

