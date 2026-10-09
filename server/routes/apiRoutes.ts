import express, { Router, Request, Response } from 'express';
import { AiService } from '../ai/aiService.ts';
import { FileOrganizer } from '../fileops/fileOrganizer.ts';
import { EbayService } from '../ebay/ebayService.ts';
import { PluginRegistry } from '../plugins/pluginRegistry.ts';
import { requireCsrfHeader } from '../google/routes.ts';

export interface ApiRoutesDeps {
  aiService: AiService;
  ebayService: EbayService;
  pluginRegistry: PluginRegistry;
}

export function createExtendedApiRouter(deps: ApiRoutesDeps): Router {
  const router = express.Router();
  const { aiService, ebayService, pluginRegistry } = deps;

  router.use(express.json({ limit: '60mb' }));
  router.use(requireCsrfHeader);

  // ==========================================
  // 1. AI Intelligent Appraiser & Analysis
  // ==========================================
  router.post('/ai/analyze', async (req: Request, res: Response) => {
    try {
      const { imageBase64, mimeType, originalFilename, provider, model, temperature, enableThinking } = req.body;
      if (!imageBase64 || !originalFilename) {
        res.status(400).json({ error: 'Missing imageBase64 or originalFilename' });
        return;
      }

      // Automatically inject active domain prompt extensions from enabled plugins (Stamplicity, CardOps, etc.)
      const pluginPromptExtension = pluginRegistry.getActivePromptExtensions();

      const analysis = await aiService.analyze({
        imageBase64,
        mimeType: mimeType || 'image/jpeg',
        originalFilename,
        provider: provider || 'gemini',
        model,
        temperature,
        enableThinking: Boolean(enableThinking),
        pluginPromptExtension,
      });

      res.json(analysis);
    } catch (err: any) {
      console.error('AI analyze error:', err);
      res.status(500).json({ error: err.message || 'AI analysis failed' });
    }
  });

  // ==========================================
  // 2. File Renaming & Organization Engine
  // ==========================================
  router.post('/fileops/plan', (req: Request, res: Response) => {
    try {
      const { items, renameConfig, dirConfig } = req.body;
      if (!items || !renameConfig || !dirConfig) {
        res.status(400).json({ error: 'items, renameConfig, and dirConfig are required.' });
        return;
      }

      const plan = FileOrganizer.generatePlan(items, renameConfig, dirConfig);
      res.json(plan);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Planning failed' });
    }
  });

  router.post('/fileops/execute', async (req: Request, res: Response) => {
    try {
      const { manifest, approvedIds, createFolders } = req.body;
      if (!manifest || !Array.isArray(approvedIds)) {
        res.status(400).json({ error: 'manifest and approvedIds array are required.' });
        return;
      }

      const executed = await FileOrganizer.executeManifest(
        manifest,
        new Set(approvedIds),
        createFolders !== false
      );
      res.json(executed);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Execution failed' });
    }
  });

  router.post('/fileops/rollback', async (req: Request, res: Response) => {
    try {
      const { manifest } = req.body;
      if (!manifest) {
        res.status(400).json({ error: 'manifest is required for rollback.' });
        return;
      }

      const rolledBack = await FileOrganizer.rollbackManifest(manifest);
      res.json(rolledBack);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Rollback failed' });
    }
  });

  // ==========================================
  // 3. eBay Developer & CSV Integrations
  // ==========================================
  router.get('/ebay/status', (_req: Request, res: Response) => {
    res.json(ebayService.getPublicStatus());
  });

  router.post('/ebay/credentials', (req: Request, res: Response) => {
    try {
      const { clientId, clientSecret, environment, devId, ruName } = req.body;
      if (!clientId || !clientSecret) {
        res.status(400).json({ error: 'clientId and clientSecret are required.' });
        return;
      }

      const updated = ebayService.saveCredentials({
        clientId,
        clientSecret,
        environment: environment === 'production' ? 'production' : 'sandbox',
        devId,
        ruName,
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/ebay/test', async (_req: Request, res: Response) => {
    const result = await ebayService.testConnection();
    res.json(result);
  });

  router.get('/ebay/templates', (_req: Request, res: Response) => {
    res.json({ templates: ebayService.getTemplates() });
  });

  router.post('/ebay/templates', (req: Request, res: Response) => {
    const template = req.body;
    if (!template || !template.id || !template.name) {
      res.status(400).json({ error: 'Invalid template structure' });
      return;
    }
    const saved = ebayService.saveTemplate(template);
    res.json({ template: saved });
  });

  router.post('/ebay/csv/validate', (req: Request, res: Response) => {
    const { rows } = req.body;
    if (!Array.isArray(rows)) {
      res.status(400).json({ error: 'rows array is required' });
      return;
    }
    const validation = ebayService.validateCsvRows(rows);
    res.json(validation);
  });

  router.post('/ebay/csv/export', (req: Request, res: Response) => {
    const { rows, filename } = req.body;
    if (!Array.isArray(rows)) {
      res.status(400).json({ error: 'rows array is required' });
      return;
    }

    const csvContent = ebayService.generateFileExchangeCsv(rows);
    const downloadName = filename || `ebay_file_exchange_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    res.send(csvContent);
  });

  // ==========================================
  // 4. Modular Plugins Management
  // ==========================================
  router.get('/plugins', (_req: Request, res: Response) => {
    res.json({
      plugins: pluginRegistry.listPlugins(),
      activeCustomFields: pluginRegistry.getActiveCustomFields(),
    });
  });

  router.post('/plugins/:id/toggle', (req: Request, res: Response) => {
    try {
      const { enabled } = req.body;
      const state = pluginRegistry.setEnabled(req.params.id, Boolean(enabled));
      res.json({
        id: req.params.id,
        enabled: state,
        plugins: pluginRegistry.listPlugins(),
        activeCustomFields: pluginRegistry.getActiveCustomFields(),
      });
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  router.get('/plugins/diagnostics', (_req: Request, res: Response) => {
    res.json({ diagnostics: pluginRegistry.runDiagnostics() });
  });

  return router;
}
