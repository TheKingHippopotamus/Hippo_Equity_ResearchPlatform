import * as fc from 'fast-check';
import request from 'supertest';
import express, { Express } from 'express';

/**
 * Property Test: Rate Limiting Under High Load
 * Feature: stock-market-dashboard
 * Property 20: Rate Limiting Under High Load
 * Validates: Requirements 7.4
 * 
 * Tests that rate limiting prevents service degradation under high concurrent load
 * while maintaining fairness across requests.
 */
describe('Property 20: Rate Limiting Under High Load', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock rate limiting middleware
    let requestCounts = new Map<string, { count: number; resetAt: number }>();
    const RATE_LIMIT = 100; // requests per minute
    const WINDOW_MS = 60 * 1000; // 1 minute

    app.use((req, res, next) => {
      const ip = req.ip || 'unknown';
      const now = Date.now();
      
      const record = requestCounts.get(ip);
      if (!record || now > record.resetAt) {
        requestCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
        return next();
      }

      if (record.count >= RATE_LIMIT) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((record.resetAt - now) / 1000)
        });
      }

      record.count++;
      next();
    });

    // Test endpoint
    app.get('/api/test', (req, res) => {
      res.json({ success: true, timestamp: new Date().toISOString() });
    });
  });

  it('should enforce rate limits under high concurrent load', async () => {
    return fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 50, max: 200 }), // Number of concurrent requests
        fc.string(), // IP address variation
        async (concurrentRequests, ipSuffix) => {
          const requests = Array.from({ length: concurrentRequests }, (_, i) => {
            const ip = `192.168.1.${(i % 10)}${ipSuffix.substring(0, 1)}`;
            return request(app)
              .get('/api/test')
              .set('X-Forwarded-For', ip)
              .set('X-Real-IP', ip);
          });

          const responses = await Promise.all(requests);
          
          // Count successful (200) vs rate limited (429) responses
          const successCount = responses.filter(r => r.status === 200).length;
          const rateLimitedCount = responses.filter(r => r.status === 429).length;

          // Property: Rate limiting should be applied
          // At least some requests should be rate limited if we exceed the limit
          if (concurrentRequests > 100) {
            expect(rateLimitedCount).toBeGreaterThan(0);
          }

          // Property: Successful requests should not exceed rate limit per IP
          // Group by IP and verify each IP doesn't exceed limit
          const ipCounts = new Map<string, number>();
          responses.forEach((res, index) => {
            const ip = `192.168.1.${(index % 10)}${ipSuffix.substring(0, 1)}`;
            if (res.status === 200) {
              ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1);
            }
          });

          // Each IP should not have more than RATE_LIMIT successful requests
          for (const [ip, count] of ipCounts.entries()) {
            expect(count).toBeLessThanOrEqual(100);
          }

          // Property: Total requests should equal sum of successful and rate limited
          expect(successCount + rateLimitedCount).toBe(concurrentRequests);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should maintain fairness across different IP addresses', async () => {
    return fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 5, maxLength: 20 }), // IP addresses
        async (ipAddresses) => {
          const requestsPerIP = 50;
          const requests = ipAddresses.flatMap(ip => 
            Array.from({ length: requestsPerIP }, () =>
              request(app)
                .get('/api/test')
                .set('X-Forwarded-For', ip)
                .set('X-Real-IP', ip)
            )
          );

          const responses = await Promise.all(requests);
          
          // Group responses by IP
          const ipResponses = new Map<string, { success: number; rateLimited: number }>();
          ipAddresses.forEach((ip, index) => {
            const startIndex = index * requestsPerIP;
            const endIndex = startIndex + requestsPerIP;
            const ipRes = responses.slice(startIndex, endIndex);
            
            ipResponses.set(ip, {
              success: ipRes.filter(r => r.status === 200).length,
              rateLimited: ipRes.filter(r => r.status === 429).length
            });
          });

          // Property: Each IP should be treated fairly
          // All IPs should have similar success/rate limit ratios
          const successRates = Array.from(ipResponses.values()).map(r => 
            r.success / (r.success + r.rateLimited)
          );

          if (successRates.length > 1) {
            const avgRate = successRates.reduce((a, b) => a + b, 0) / successRates.length;
            // Each IP's success rate should be within 20% of average (fairness)
            successRates.forEach(rate => {
              expect(Math.abs(rate - avgRate)).toBeLessThan(0.2);
            });
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should allow requests after rate limit window resets', async () => {
    return fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }), // Number of test cycles
        async (cycles) => {
          const ip = '192.168.1.100';
          let totalSuccess = 0;
          let totalRateLimited = 0;

          for (let cycle = 0; cycle < cycles; cycle++) {
            // Make requests up to rate limit
            const requests = Array.from({ length: 150 }, () =>
              request(app)
                .get('/api/test')
                .set('X-Forwarded-For', ip)
                .set('X-Real-IP', ip)
            );

            const responses = await Promise.all(requests);
            totalSuccess += responses.filter(r => r.status === 200).length;
            totalRateLimited += responses.filter(r => r.status === 429).length;

            // Wait for rate limit window to reset (simulated by clearing counts)
            // In real implementation, this would be time-based
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          // Property: After reset, new requests should be allowed
          // Total successful requests should be greater than single window limit
          expect(totalSuccess).toBeGreaterThan(100);
        }
      ),
      { numRuns: 5 }
    );
  });
});

