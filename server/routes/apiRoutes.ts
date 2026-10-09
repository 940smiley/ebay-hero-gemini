import express, { Router, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { AiService } from '../ai/aiService.ts';
import { FileOrganizer } from '../fileops/fileOrganizer.ts';
import { EbayService } from '../ebay/ebayService.ts';
import { PluginRegistry } from '../plugins/pluginRegistry.ts';
import { requireCsrfHeader } from '../google/routes.ts';
import { ManagedLibrary } from '../library.ts';
import { GoogleAccountService } from '../google/accounts.ts';
import { serverLogger, ServerLogLevel } from '../logger.ts';
import { analyzeMarketInsightsWithGemini } from '../gemini.ts';

export interface ApiRoutesDeps {
  aiService: AiService;
  ebayService: EbayService;
  pluginRegistry: PluginRegistry;
  library?: ManagedLibrary;
  googleAccounts?: GoogleAccountService;
}

export function createExtendedApiRouter(deps: ApiRoutesDeps): Router {
  const router = express.Router();
  const { aiService, ebayService, pluginRegistry, library, googleAccounts } = deps;

  router.use(express.json({ limit: '60mb' }));
  router.use(requireCsrfHeader);

  // ==========================================
  // 1. AI Intelligent Appraiser & Analysis
  // ==========================================
  router.post('/ai/analyze', async (req: Request, res: Response) => {
    const opId = serverLogger.generateId('ai-op');
    try {
      const { imageBase64, mimeType, originalFilename, provider, model, temperature, enableThinking, assetId } = req.body;
      if (!imageBase64 && !assetId) {
        res.status(400).json({ error: 'Missing imageBase64 or assetId' });
        return;
      }

      let resolvedBase64 = imageBase64 || '';
      let resolvedMimeType = mimeType || 'image/jpeg';

      // Resolve library files into actual base64 image bytes from disk
      const libraryMatch = resolvedBase64.match(/\/api\/library\/([a-zA-Z0-9_\-]+)\/file/) || (assetId ? [null, assetId] : null);
      if (libraryMatch && library) {
        const libId = libraryMatch[1];
        const rec = library.get(libId);
        if (rec) {
          const fPath = library.filePath(rec);
          if (fs.existsSync(fPath)) {
            const buf = fs.readFileSync(fPath);
            resolvedBase64 = `data:${rec.mimeType};base64,${buf.toString('base64')}`;
            resolvedMimeType = rec.mimeType;
            serverLogger.debug('Gemini Vision', 'library_resolved_base64', `Resolved image from library ${libId} (${buf.length} bytes)`, {
              operationId: opId,
              details: { mimeType: resolvedMimeType, size: buf.length },
            });
          }
        }
      }

      serverLogger.info('Gemini Vision', 'analyze_request', `Initiating AI analysis for ${originalFilename}`, {
        operationId: opId,
        provider: provider || 'gemini',
        details: { model, mimeType: resolvedMimeType },
      });

      // Automatically inject active domain prompt extensions from enabled plugins
      const pluginPromptExtension = pluginRegistry.getActivePromptExtensions();

      const startTime = Date.now();
      const analysis = await aiService.analyze({
        imageBase64: resolvedBase64,
        mimeType: resolvedMimeType,
        originalFilename: originalFilename || 'unknown_item.jpg',
        provider: provider || 'gemini',
        model,
        temperature,
        enableThinking: Boolean(enableThinking),
        pluginPromptExtension,
      });

      const durationMs = Date.now() - startTime;
      serverLogger.info('Gemini Vision', 'analyze_success', `Analysis completed for ${originalFilename} in ${durationMs}ms`, {
        operationId: opId,
        durationMs,
        details: { category: analysis.category, confidence: analysis.confidenceScore },
      });

      res.json(analysis);
    } catch (err: any) {
      serverLogger.error('Gemini Vision', 'analyze_error', `Analysis failed: ${err.message}`, {
        operationId: opId,
        details: { error: err.message },
      });
      res.status(500).json({ error: err.message || 'AI analysis failed' });
    }
  });

  // ==========================================
  // 1b. Gemini Vision Market Insights & Historical eBay Comps
  // ==========================================
  router.post('/ai/market-insights', async (req: Request, res: Response) => {
    const opId = serverLogger.generateId('market-insights-op');
    try {
      const { imageBase64, mimeType, originalFilename, model, enableThinking, assetId, collectibleDetails } = req.body;

      let resolvedBase64 = imageBase64 || '';
      let resolvedMimeType = mimeType || 'image/jpeg';

      // Resolve library files into actual base64 image bytes from disk if needed
      const libraryMatch = resolvedBase64.match(/\/api\/library\/([a-zA-Z0-9_\-]+)\/file/) || (assetId ? [null, assetId] : null);
      if (libraryMatch && library) {
        const libId = libraryMatch[1];
        const rec = library.get(libId);
        if (rec) {
          const fPath = library.filePath(rec);
          if (fs.existsSync(fPath)) {
            const buf = fs.readFileSync(fPath);
            resolvedBase64 = `data:${rec.mimeType};base64,${buf.toString('base64')}`;
            resolvedMimeType = rec.mimeType;
          }
        }
      }

      serverLogger.info('Gemini Vision', 'market_insights_request', `Generating Market Insights for ${originalFilename || 'collectible'}`, {
        operationId: opId,
        details: { model: model || 'gemini-3.8-flash' },
      });

      const startTime = Date.now();
      const insights = await analyzeMarketInsightsWithGemini({
        imageBase64: resolvedBase64,
        mimeType: resolvedMimeType,
        originalFilename: originalFilename || 'collectible.jpg',
        model: model || 'gemini-3.8-flash',
        enableThinking: Boolean(enableThinking),
        collectibleDetails,
      });

      const durationMs = Date.now() - startTime;
      serverLogger.info('Gemini Vision', 'market_insights_success', `Generated Market Insights in ${durationMs}ms`, {
        operationId: opId,
        durationMs,
        details: { recommendedPriceBin: insights.recommendedPriceBin },
      });

      res.json(insights);
    } catch (err: any) {
      serverLogger.error('Gemini Vision', 'market_insights_error', `Market insights failed: ${err.message}`, {
        operationId: opId,
        details: { error: err.message },
      });
      res.status(500).json({ error: err.message || 'Market insights failed' });
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

  // ==========================================
  // 5. Diagnostics Logging & Health Suite
  // ==========================================
  router.get('/diagnostics/logs', (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit) || 200, 1000);
    const level = req.query.level as ServerLogLevel | undefined;
    res.json({ logs: serverLogger.getEntries(limit, level) });
  });

  router.post('/diagnostics/client-log', (req: Request, res: Response) => {
    const { level, subsystem, event, message, operationId, details } = req.body;
    if (level && subsystem && event && message) {
      serverLogger.log(level, subsystem, event, message, { operationId, details });
    }
    res.json({ ok: true });
  });

  router.get('/diagnostics/health', async (_req: Request, res: Response) => {
    const results: Array<{
      id: string;
      name: string;
      category: 'Auth' | 'Drive' | 'Photos' | 'Gemini' | 'Storage' | 'Rendering';
      status: 'PASS' | 'FAIL' | 'WARNING';
      message: string;
      remediation?: string;
      details?: any;
    }> = [];

    // 1. Google OAuth Client Credentials
    const status = googleAccounts?.publicStatus();
    if (status?.configured) {
      results.push({
        id: 'oauth-config',
        name: 'Google OAuth Client Credentials',
        category: 'Auth',
        status: 'PASS',
        message: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are properly configured.',
      });
    } else {
      results.push({
        id: 'oauth-config',
        name: 'Google OAuth Client Credentials',
        category: 'Auth',
        status: 'FAIL',
        message: 'Google OAuth client credentials are missing in the local environment.',
        remediation: 'Provide GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env or Google Cloud Console settings.',
      });
    }

    // 2. Active User Account & Token
    const acct = googleAccounts?.getActiveAccount();
    if (acct) {
      if (acct.refreshToken) {
        results.push({
          id: 'active-account',
          name: 'Google User Authentication & Refresh Token',
          category: 'Auth',
          status: 'PASS',
          message: `Connected as ${acct.email} with encrypted offline refresh token.`,
        });
      } else {
        results.push({
          id: 'active-account',
          name: 'Google User Authentication & Refresh Token',
          category: 'Auth',
          status: 'WARNING',
          message: `Connected as ${acct.email}, but offline refresh token is missing.`,
          remediation: 'Click Disconnect and Reconnect in Settings with prompt=consent to acquire a persistent refresh token.',
        });
      }
    } else {
      results.push({
        id: 'active-account',
        name: 'Google User Authentication & Refresh Token',
        category: 'Auth',
        status: 'WARNING',
        message: 'No Google account is currently connected.',
        remediation: 'Click Connect Google Account in Settings to grant Drive and Photos permissions.',
      });
    }

    // 3. Google Drive Scopes
    if (acct && googleAccounts?.hasScope(acct, 'drive')) {
      results.push({
        id: 'drive-api',
        name: 'Google Drive API & Scopes',
        category: 'Drive',
        status: 'PASS',
        message: 'Google Drive authorization scope granted.',
      });
    } else {
      results.push({
        id: 'drive-api',
        name: 'Google Drive API & Scopes',
        category: 'Drive',
        status: acct ? 'FAIL' : 'WARNING',
        message: acct ? 'Google Drive permission not granted for active account.' : 'Awaiting account connection.',
        remediation: 'Grant drive.readonly or drive permission on the Google OAuth consent screen.',
      });
    }

    // 4. Google Photos Picker API
    if (acct && googleAccounts?.hasScope(acct, 'photos')) {
      results.push({
        id: 'photos-api',
        name: 'Google Photos Picker API & Permissions',
        category: 'Photos',
        status: 'PASS',
        message: 'Google Photos Picker scope (photospicker.mediaitems.readonly) granted.',
      });
    } else {
      results.push({
        id: 'photos-api',
        name: 'Google Photos Picker API & Permissions',
        category: 'Photos',
        status: acct ? 'FAIL' : 'WARNING',
        message: acct ? 'Google Photos Picker permission not granted.' : 'Awaiting account connection.',
        remediation: 'Grant photospicker.mediaitems.readonly on the Google OAuth consent screen.',
      });
    }

    // 5. Gemini Vision Engine
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey.trim().length > 10) {
      results.push({
        id: 'gemini-vision',
        name: 'Google Gemini Vision AI Engine',
        category: 'Gemini',
        status: 'PASS',
        message: 'GEMINI_API_KEY is configured. Ready for multimodal high-resolution analysis.',
      });
    } else {
      results.push({
        id: 'gemini-vision',
        name: 'Google Gemini Vision AI Engine',
        category: 'Gemini',
        status: 'WARNING',
        message: 'GEMINI_API_KEY is not defined. Fallback heuristic analysis will be used.',
        remediation: 'Add GEMINI_API_KEY to your .env file to enable multimodal neural grading.',
      });
    }

    // 6. Managed Image Library Storage
    try {
      if (library) {
        // Test write & read on data/library directory
        const testFile = path.join(process.cwd(), 'data', 'library', '.health-probe');
        fs.writeFileSync(testFile, 'ok');
        fs.unlinkSync(testFile);
        results.push({
          id: 'library-storage',
          name: 'Managed Image Library Storage',
          category: 'Storage',
          status: 'PASS',
          message: 'Read/write disk operations verified on data/library.',
        });
      } else {
        results.push({
          id: 'library-storage',
          name: 'Managed Image Library Storage',
          category: 'Storage',
          status: 'WARNING',
          message: 'Library instance was not injected into router.',
        });
      }
    } catch (e: any) {
      results.push({
        id: 'library-storage',
        name: 'Managed Image Library Storage',
        category: 'Storage',
        status: 'FAIL',
        message: `Storage permission test failed: ${e.message}`,
        remediation: 'Ensure data/library directory has write permissions on this PC.',
      });
    }

    res.json({ results });
  });

  return router;
}
