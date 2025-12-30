# API Gateway Tests

This directory contains unit tests for the API Gateway middleware and functionality.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

## Test Coverage

The tests cover:

1. **Rate Limiting**
   - Verifies that rate limiting works correctly (100 requests per minute)
   - Tests rate limit reset after window expires
   - Validates rate limit error messages

2. **Error Handling**
   - Tests user-friendly error messages
   - Verifies 404 error handling
   - Tests service proxy error handling
   - Ensures stack traces are not exposed in production
   - Verifies stack traces are available in development

3. **CORS Configuration**
   - Tests CORS headers are included in responses
   - Verifies preflight OPTIONS requests are handled
   - Tests origin validation

4. **Request Logging**
   - Verifies request details are logged
   - Tests response logging when requests finish
   - Validates log format and content

## Requirements Validated

- **Requirement 7.1**: Rate limiting behavior
- **Requirement 9.1**: Error handling and user-friendly messages

