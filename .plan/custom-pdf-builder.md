# Custom PDF Builder Feature Plan

## Context and current state
- The frontend uses `PDFReportButton` to call `POST /report/generate` with `symbol`, `language`, and `userId`.
- The report service generates a fixed PDF: cover page, stock summary, financial analysis, news articles, and a price chart.
- There is no user control over content selection, ordering, or design choices.

## Goals
- Let users build a personalized PDF by selecting sections, ordering them, and tuning data density.
- Give users control over design with clear presets plus optional custom overrides.
- Preserve current behavior for users who want a one-click PDF.

## Proposed user experience
1) Add a "Customize PDF" action near the existing report button (Dashboard).
2) Open a "PDF Builder" drawer/modal with three tabs:
   - Content: pick sections, set filters, and reorder.
   - Design: choose a visual preset and optional customization.
   - Review: summary of selections + estimated length.
3) Provide "Save as template" so users can reuse their preferred layout.
4) One-click "Generate" from the builder, or "Generate default" from the current button.

## Content controls (section library)
Core sections with toggles and ordering:
- Cover page (title, subtitle, logo, date).
- Stock summary (price, change, previous close, trading date).
- Company overview (from analysis.companyDescription).
- Financial analysis (whole section or sub-sections):
  - Competitors, Financial Health, Growth, Profitability, Shareholder Returns, Valuation.
- Charts:
  - Price history (choose line/area/bar and range).
- News:
  - Include/omit news, choose max articles (e.g., 3/5/10), use full or summarized content.
- Appendix:
  - Data sources, methodology, disclaimers.

Guardrails:
- At least one section required.
- Show warnings if a selected section has no data.

## Design controls (visual customization)
Presets (fast, opinionated):
- Classic Research
- Investor Brief (compact)
- Modern Minimal
- Executive Summary (hero stats + short narrative)

Custom overrides:
- Theme color + accent color.
- Typography pair: Serif or Sans (PDF-safe fonts).
- Density: Compact / Comfortable.
- Header/Footer: page numbers, company name, optional disclaimer.
- Chart styling: grid on/off, line thickness.
- Cover style: image/logo, badge with symbol and price.

## Frontend plan (React)
- New components:
  - `PDFReportBuilder` (state + stepper/tabs)
  - `PDFSectionPicker` (toggle + reorder)
  - `PDFDesignPicker` (presets + overrides)
  - `PDFReviewSummary` (estimated pages + warnings)
- Update `PDFReportButton` to optionally open builder.
- Add new types in `src/types/models.ts`:
  - `ReportConfig`, `ReportSection`, `ReportTheme`, `ReportTemplate`.
- Add new API methods in `src/services/api.ts`:
  - `generatePDF(symbol, language, userId, reportConfig?)`
  - `saveReportTemplate(...)`, `listReportTemplates(...)` (if template storage is added)

## Report Service plan (backend)
- Extend `POST /report/generate` to accept `reportConfig`.
- Default config mirrors current report to keep backward compatibility.
- Refactor PDF generation to:
  - Build an ordered list of section renderers.
  - Apply theme tokens (colors, fonts, spacing) in `applyBranding` and `addSectionHeader`.
  - Respect content filters (news count, summary mode, chart type).
- Save `reportConfig` in metadata (JSONB column or new table).

## User/Template storage (optional but recommended)
- Add endpoints to User Service or Report Service:
  - `POST /user/preferences/report-template`
  - `GET /user/preferences/report-templates`
  - `DELETE /user/preferences/report-template/:id`
- Store template JSON in PostgreSQL for reuse across sessions.

## API Gateway updates
- Update swagger docs and request validation to accept `reportConfig`.
- Pass through new template endpoints if added.

## Validation and safety
- Server-side validation to reject unknown sections or invalid options.
- Enforce bounds (e.g., max news articles, max pages if needed).
- Sanitization for custom text fields (subtitle, disclaimer).

## Testing plan
Frontend:
- Component tests for section selection, ordering, and validation.
- Smoke test for builder -> API request payload.
Backend:
- Unit tests for config parsing and section ordering.
- Regression tests to ensure default config renders current PDF.
- Property test update for PDF completeness to allow optional sections.

## Rollout
- Phase 1: Builder UI + config-driven PDF generation (no templates).
- Phase 2: Saved templates + analytics on usage.
- Phase 3: Advanced design options (custom charts, extra data sources).

## Success metrics
- Adoption rate of "Customize PDF".
- Average sections selected and template saves.
- Drop in failed/abandoned PDF generation requests.
