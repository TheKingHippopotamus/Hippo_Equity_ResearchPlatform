# Data Service Tests

This directory contains unit tests and property-based tests for the Data Service.

## Test Structure

- `unit/` - Unit tests for individual services and components
- `property/` - Property-based tests using fast-check

## Running Tests

### Install Dependencies

First, install all dependencies including test dependencies:

```bash
npm install
```

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

## Test Files

### Property Tests

1. **retryLogic.test.ts** - Property 2: Exponential Backoff Retry Timing
   - Validates: Requirements 1.3
   - Tests that API retries follow exponential backoff (1s, 2s, 4s) and never exceed 3 attempts

2. **dataNormalization.test.ts** - Property 4: Data Normalization Round-Trip
   - Validates: Requirements 1.5
   - Tests that essential fields are preserved during normalization

3. **cacheTTL.test.ts** - Property 19: Cache TTL Expiration
   - Validates: Requirements 7.2
   - Tests that cached data expires after TTL and fresh data is fetched

### Unit Tests

1. **dataService.test.ts** - DataService unit tests
   - Tests cache hit/miss scenarios
   - Tests API fetch with error handling
   - Tests fallback to stale cache
   - Validates: Requirements 1.4, 7.2

## Test Configuration

Tests are configured using `jest.config.js` with:
- TypeScript support via `ts-jest`
- ES modules support
- Coverage collection from `src/**/*.ts`
- Excludes type definition files from coverage

## Notes

- Property tests run minimum 50-100 iterations each
- All tests use mocks for external dependencies (Redis, Axios, Logger)
- Tests are designed to be fast and isolated

