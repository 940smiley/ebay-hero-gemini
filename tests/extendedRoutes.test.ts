import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AiService } from '../server/ai/aiService.ts';
import { EbayService } from '../server/ebay/ebayService.ts';
import { PluginRegistry } from '../server/plugins/pluginRegistry.ts';
import { createExtendedApiRouter } from '../server/routes/apiRoutes.ts';

const CSRF_HEADERS = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'ebay-hero',
};

let server: http.Server;
let base: string;
let tmpDir: string;

function startServer() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ebh-ext-routes-'));
  const aiService = new AiService(tmpDir);
  const ebayService = new EbayService(tmpDir);
  const pluginRegistry = new PluginRegistry(tmpDir);

  const app = express();
  app.use('/api', createExtendedApiRouter({ aiService, ebayService, pluginRegistry }));

  return new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      resolve();
    });
  });
}

beforeEach(async () => {
  await startServer();
});

afterEach(() => {
  return new Promise<void>((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
});

describe('Extended API Routes over HTTP', () => {
  it('enforces CSRF protection on POST routes', async () => {
    const res = await fetch(`${base}/api/ebay/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: 'id', clientSecret: 'sec' }),
    });
    expect(res.status).toBe(403);
  });

  describe('Plugins API', () => {
    it('lists installed plugins with active custom fields', async () => {
      const res = await fetch(`${base}/api/plugins`, { headers: { 'X-Requested-With': 'ebay-hero' } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.plugins).toHaveLength(2);
      expect(data.plugins.map((p: any) => p.id)).toContain('stamplicity');
      expect(data.plugins.map((p: any) => p.id)).toContain('cardops');
      expect(data.activeCustomFields.length).toBeGreaterThan(0);
    });

    it('toggles plugin activation state', async () => {
      const toggleRes = await fetch(`${base}/api/plugins/stamplicity/toggle`, {
        method: 'POST',
        headers: CSRF_HEADERS,
        body: JSON.stringify({ enabled: false }),
      });
      expect(toggleRes.status).toBe(200);
      const data = await toggleRes.json();
      expect(data.enabled).toBe(false);

      const stamplicity = data.plugins.find((p: any) => p.id === 'stamplicity');
      expect(stamplicity.enabled).toBe(false);
    });

    it('runs plugin diagnostics', async () => {
      const res = await fetch(`${base}/api/plugins/diagnostics`, { headers: { 'X-Requested-With': 'ebay-hero' } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.diagnostics).toHaveLength(2);
      expect(data.diagnostics[0].status).toBe('ok');
    });
  });

  describe('eBay Developer & CSV API', () => {
    it('retrieves status and saves credentials securely', async () => {
      const status1 = await (await fetch(`${base}/api/ebay/status`, { headers: { 'X-Requested-With': 'ebay-hero' } })).json();
      expect(status1.isConfigured).toBe(false);

      const saveRes = await fetch(`${base}/api/ebay/credentials`, {
        method: 'POST',
        headers: CSRF_HEADERS,
        body: JSON.stringify({
          clientId: 'ebay-app-123',
          clientSecret: 'secret-xyz-456',
          environment: 'sandbox',
        }),
      });
      expect(saveRes.status).toBe(200);

      const status2 = await (await fetch(`${base}/api/ebay/status`, { headers: { 'X-Requested-With': 'ebay-hero' } })).json();
      expect(status2.isConfigured).toBe(true);
      expect(status2.environment).toBe('sandbox');
    });

    it('tests connection endpoint', async () => {
      const res = await fetch(`${base}/api/ebay/test`, {
        method: 'POST',
        headers: CSRF_HEADERS,
      });
      expect(res.status).toBe(200);
      const result = await res.json();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
    });

    it('lists listing templates', async () => {
      const res = await fetch(`${base}/api/ebay/templates`, { headers: { 'X-Requested-With': 'ebay-hero' } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.templates.length).toBeGreaterThan(0);
      expect(data.templates.map((t: any) => t.id)).toContain('trading-cards-standard');
    });

    it('validates CSV rows and detects violations', async () => {
      const invalidRow = {
        action: 'Add',
        title: '', // Missing title
        category: '', // Missing category
        description: 'Test',
        conditionId: '3000',
        format: 'FixedPrice',
        buyItNowPrice: 0, // Missing price
        quantity: 1,
        duration: 'GTC',
        location: 'US',
        shippingService: 'USPS',
        shippingCost: 5,
        dispatchTimeMax: 1,
        returnsAcceptedOption: 'ReturnsAccepted',
        customLabelSku: 'SKU-001',
        itemSpecifics: {},
      };

      const res = await fetch(`${base}/api/ebay/csv/validate`, {
        method: 'POST',
        headers: CSRF_HEADERS,
        body: JSON.stringify({ rows: [invalidRow] }),
      });

      expect(res.status).toBe(200);
      const report = await res.json();
      expect(report.valid).toBe(false);
      expect(report.missingRequiredFields.length).toBeGreaterThan(0);
      expect(report.missingRequiredFields.some((f: any) => f.field === '*Title')).toBe(true);
    });

    it('exports official File Exchange CSV format with C: specifics', async () => {
      const row = {
        action: 'Add',
        title: '1999 Pokemon Charizard Holo PSA 9',
        category: '183454',
        description: '<p>Authentic Gem</p>',
        conditionId: '2750',
        format: 'FixedPrice',
        buyItNowPrice: 250.00,
        quantity: 1,
        duration: 'GTC',
        location: 'United States',
        shippingService: 'USPSGroundAdvantage',
        shippingCost: 4.95,
        dispatchTimeMax: 1,
        returnsAcceptedOption: 'ReturnsAccepted',
        customLabelSku: 'CARD-001',
        itemSpecifics: {
          'Graded': 'Yes',
          'Professional Grader': 'PSA',
          'Grade': '9',
        },
      };

      const res = await fetch(`${base}/api/ebay/csv/export`, {
        method: 'POST',
        headers: CSRF_HEADERS,
        body: JSON.stringify({ rows: [row] }),
      });

      expect(res.status).toBe(200);
      const csv = await res.text();
      expect(csv).toContain('*Action(SiteID=US|Country=US|Currency=USD|Version=1193');
      expect(csv).toContain('C:Graded');
      expect(csv).toContain('C:Professional Grader');
      expect(csv).toContain('CARD-001');
      expect(csv).toContain('1999 Pokemon Charizard Holo PSA 9');
    });
  });

  describe('FileOps Engine API', () => {
    it('generates a rename plan with conflict resolution', async () => {
      const items = [
        {
          id: '1',
          originalFilename: 'img1.jpg',
          originalPath: 'in/img1.jpg',
          category: 'Cards',
          description: 'Charizard',
          date: '1999',
        },
        {
          id: '2',
          originalFilename: 'img2.jpg',
          originalPath: 'in/img2.jpg',
          category: 'Cards',
          description: 'Charizard',
          date: '1999',
        },
      ];

      const res = await fetch(`${base}/api/fileops/plan`, {
        method: 'POST',
        headers: CSRF_HEADERS,
        body: JSON.stringify({
          items,
          renameConfig: {
            template: '{category}_{description}_{date}',
            caseConvention: 'UPPER_SNAKE',
            collisionStrategy: 'append_number',
            preserveExtension: true,
            dateFormat: 'YYYYMMDD',
            numberPadding: 3,
          },
          dirConfig: {
            rootDirectory: path.join(tmpDir, 'out'),
            pattern: '{category}',
            createFolders: true,
          },
        }),
      });

      expect(res.status).toBe(200);
      const plan = await res.json();
      expect(plan.operations).toHaveLength(2);
      expect(plan.operations[0].proposedFilename).toBe('CARDS_CHARIZARD_1999.jpg');
      expect(plan.operations[0].conflict).toBe(false);
      expect(plan.operations[1].conflict).toBe(true);
      expect(plan.operations[1].conflictResolvedName).toBe('CARDS_CHARIZARD_1999_002.jpg');
    });
  });
});
