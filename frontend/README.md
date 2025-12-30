# Hippo Equity Research Dashboard - Frontend

React + TypeScript frontend application for the Hippo Equity Research Dashboard.

## Features

- **Reusable Components**: StockCard, NewsCard, ChartComponent, FinancialMetricsPanel, LanguageSelector, AutopilotQueue, PDFReportButton
- **Multi-Language Support**: 6 languages (English, Spanish, French, German, Chinese, Hebrew)
- **Real-Time Language Switching**: Change language without page reload
- **Responsive Design**: Works on mobile, tablet, and desktop
- **Type Safety**: Full TypeScript strict mode
- **Property-Based Testing**: Fast-check for property validation

## Prerequisites

- Node.js 18+
- npm or yarn

## Installation

```bash
cd frontend
npm install
```

## Development

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Environment

The frontend reads Vite environment variables from the repo root `.env` or the shell.

- `VITE_API_BASE_URL` (default: `/api`) - Base URL for API requests
- `VITE_API_PROXY_TARGET` (default: `http://localhost:3000`) - Dev server proxy target

## Build

```bash
npm run build
```

## Testing

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Project Structure

```
frontend/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── StockCard/
│   │   ├── NewsCard/
│   │   ├── ChartComponent/
│   │   ├── FinancialMetricsPanel/
│   │   ├── LanguageSelector/
│   │   ├── AutopilotQueue/
│   │   └── PDFReportButton/
│   ├── pages/               # Page components
│   │   └── Dashboard/
│   ├── services/            # API and business logic
│   │   ├── api.ts
│   │   └── translation.ts
│   ├── types/               # TypeScript type definitions
│   │   └── models.ts
│   ├── styles/             # Global styles and design system
│   │   └── design-system.css
│   ├── test/               # Test utilities and property tests
│   │   ├── setup.ts
│   │   └── property/
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Components

### StockCard
Displays stock price, change, and percentage change with sentiment indicators.

### NewsCard
Shows news articles with title, date, preview, sentiment, and expandable content.

### ChartComponent
Renders interactive charts (line, bar, area) for time-series data visualization.

### FinancialMetricsPanel
Displays organized financial analysis sections with ratings and key points.

### LanguageSelector
Dropdown for language selection with persistence to backend.

### AutopilotQueue
Shows queue status, progress, ETA, and current task for batch processing.

### PDFReportButton
Triggers PDF generation and provides download link.

## API Integration

The frontend communicates with backend services through the API Gateway:

- **Data Service**: `/api/data/stock/:symbol`
- **Translation Service**: `/api/translation/*`
- **User Service**: `/api/user/preferences/*`
- **Queue Service**: `/api/queue/*`

## Design System

The application uses a unified design system defined in `src/styles/design-system.css`:

- CSS Variables for colors, spacing, typography
- Consistent component styling
- Responsive breakpoints
- Accessibility support

## Testing

### Unit Tests
Component tests using Vitest and React Testing Library.

### Property Tests
Property-based tests using fast-check for:
- Responsive design usability (Property 13)
- Language switching without reload (Property 10)

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

