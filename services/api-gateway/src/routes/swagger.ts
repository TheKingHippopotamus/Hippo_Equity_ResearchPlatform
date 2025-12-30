/**
 * Swagger UI Route
 * Serves OpenAPI documentation
 */

import { Express, Request, Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function setupSwaggerRoutes(app: Express): void {
  // Serve OpenAPI spec
  app.get('/api-docs/openapi.yaml', (req: Request, res: Response) => {
    try {
      const openApiPath = join(__dirname, '../../../docs/api/openapi.yaml');
      const openApiSpec = readFileSync(openApiPath, 'utf-8');
      res.setHeader('Content-Type', 'application/yaml');
      res.send(openApiSpec);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to load OpenAPI specification',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Serve Swagger UI HTML
  app.get('/api-docs', (req: Request, res: Response) => {
    const swaggerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Hippo Equity Research API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin:0;
      background: #fafafa;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: "/api-docs/openapi.yaml",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>
    `;
    res.send(swaggerHtml);
  });
}

