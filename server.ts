import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { analyzeImageWithGemini, askGeminiChat, analyzeMarketInsightsWithGemini } from './server/gemini.ts';
import { generateScriptBundle } from './server/scriptGenerator.ts';
import { POSTGRESQL_SCHEMA_SQL } from './server/databaseSchema.ts';
import { EncryptedJsonFile, getEncryptionKey } from './server/security/secretStore.ts';
import { GoogleAccountService, GoogleStoreShape, configFromEnv } from './server/google/accounts.ts';
import { createGoogleRouter, createLibraryRouter } from './server/google/routes.ts';
import { ManagedLibrary } from './server/library.ts';
import { AiService } from './server/ai/aiService.ts';
import { EbayService } from './server/ebay/ebayService.ts';
import { PluginRegistry } from './server/plugins/pluginRegistry.ts';
import { createExtendedApiRouter } from './server/routes/apiRoutes.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// High limit for processing high-res batch card photos
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// Google integrations (server-side OAuth, Drive API, Photos Picker API) + managed image library
const dataDir = path.resolve(process.env.EBAY_HERO_DATA_DIR || path.join(process.cwd(), 'data'));
const googleStore = new EncryptedJsonFile<GoogleStoreShape>(
  path.join(dataDir, 'google-accounts.enc.json'),
  () => ({ accounts: {} }),
  getEncryptionKey(dataDir),
);
const googleAccounts = new GoogleAccountService(googleStore, configFromEnv());
const library = new ManagedLibrary(path.join(dataDir, 'library'));
app.use('/api/google', createGoogleRouter({ accounts: googleAccounts, library }));
app.use('/api/library', createLibraryRouter(library));

// Extended AI, FileOps, eBay, and Plugin Architecture routers
const aiService = new AiService(dataDir);
const ebayService = new EbayService(dataDir);
const pluginRegistry = new PluginRegistry(dataDir);
app.use('/api', createExtendedApiRouter({ aiService, ebayService, pluginRegistry, library, googleAccounts }));

// 1. Health check & system diagnostics
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    system: 'eBay Hero Gemini Edition',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    nodeVersion: process.version,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// 2. Multimodal AI Analysis with Gemini Vision / Pro
app.post('/api/analyze', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType, originalFilename, model, enableThinking } = req.body;
    if (!imageBase64 || !originalFilename) {
      res.status(400).json({ error: 'Missing imageBase64 or originalFilename' });
      return;
    }

    const result = await analyzeImageWithGemini({
      imageBase64,
      mimeType: mimeType || 'image/jpeg',
      originalFilename,
      model: model || 'gemini-3.8-flash',
      enableThinking: Boolean(enableThinking),
    });

    res.json(result);
  } catch (error: any) {
    console.error('API /analyze error:', error);
    res.status(500).json({ error: error.message || 'Analysis failed' });
  }
});

// 2b. Gemini Vision Market Insights & Historical eBay Comps
app.post('/api/market-insights', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType, originalFilename, model, enableThinking, collectibleDetails } = req.body;
    const result = await analyzeMarketInsightsWithGemini({
      imageBase64,
      mimeType: mimeType || 'image/jpeg',
      originalFilename: originalFilename || 'collectible.jpg',
      model: model || 'gemini-3.8-flash',
      enableThinking: Boolean(enableThinking),
      collectibleDetails,
    });
    res.json(result);
  } catch (error: any) {
    console.error('API /api/market-insights error:', error);
    res.status(500).json({ error: error.message || 'Market insights failed' });
  }
});

// 3. Multi-turn AI Appraiser Chatbot (with thinking level & vision attachment support)
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { messages, model, enableThinking, imageAttachment } = req.body;
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Messages array is required' });
      return;
    }

    const response = await askGeminiChat(
      messages,
      model || 'gemini-3.8-flash',
      Boolean(enableThinking),
      imageAttachment
    );

    res.json(response);
  } catch (error: any) {
    console.error('API /chat error:', error);
    res.status(500).json({ error: error.message || 'Chat request failed' });
  }
});

// 4. Multi-platform Script & Audit Log Generator
app.post('/api/scripts/generate', (req: Request, res: Response) => {
  try {
    const { baseDirectory, items, createDestinationFolders, backupBeforeRename } = req.body;
    if (!baseDirectory || !items || !Array.isArray(items)) {
      res.status(400).json({ error: 'baseDirectory and items array required' });
      return;
    }

    const bundle = generateScriptBundle({
      baseDirectory,
      items,
      createDestinationFolders: createDestinationFolders !== false,
      backupBeforeRename: Boolean(backupBeforeRename),
    });

    res.json(bundle);
  } catch (error: any) {
    console.error('API /scripts/generate error:', error);
    res.status(500).json({ error: error.message || 'Script generation failed' });
  }
});

// 5. Google Drive for Desktop & System Drives Detection Endpoint
app.get('/api/drive/detect', (_req: Request, res: Response) => {
  const platform = process.platform;
  let detectedPath = 'P:\\My Drive';
  let mode: 'stream' | 'mirror' = 'stream';
  const availableMounts: Array<{ path: string; label: string; type: string }> = [];

  if (platform === 'win32') {
    // Check known Windows drive letters (P:, G:, H:, C:, F:, etc.)
    const driveLetters = ['P', 'G', 'H', 'F', 'C', 'D', 'E'];
    for (const letter of driveLetters) {
      const rootPath = `${letter}:\\`;
      const myDrivePath = `${letter}:\\My Drive`;
      const imagesPath = `${letter}:\\Images`;

      try {
        if (fs.existsSync(myDrivePath)) {
          availableMounts.push({ path: myDrivePath, label: `Google Drive (${letter}:\\My Drive)`, type: 'drive_desktop' });
          if (!detectedPath || detectedPath === 'P:\\My Drive') detectedPath = myDrivePath;
        } else if (fs.existsSync(rootPath)) {
          availableMounts.push({ path: rootPath, label: `Drive (${letter}:\\)`, type: 'local_drive' });
        }
        if (fs.existsSync(imagesPath)) {
          availableMounts.push({ path: imagesPath, label: `Computer Backup (${letter}:\\Images)`, type: 'computer_backup' });
        }
      } catch {}
    }

    // No fabricated defaults: if nothing is mounted, report an empty list and let the UI explain.
    if (availableMounts.length === 0) detectedPath = '';
  } else if (platform === 'darwin') {
    // macOS CloudStorage
    const home = process.env.HOME || '/Users/seller';
    const cloudStorage = path.join(home, 'Library', 'CloudStorage');
    detectedPath = path.join(home, 'Google Drive');
    availableMounts.push({ path: detectedPath, label: 'Google Drive (Mac)', type: 'drive_desktop' });
    try {
      if (fs.existsSync(cloudStorage)) {
        const entries = fs.readdirSync(cloudStorage);
        entries.forEach((e) => {
          if (e.toLowerCase().includes('google')) {
            const p = path.join(cloudStorage, e, 'My Drive');
            availableMounts.push({ path: p, label: `CloudStorage (${e})`, type: 'drive_desktop' });
            detectedPath = p;
          }
        });
      }
    } catch {}
    mode = 'stream';
  } else {
    // Linux
    const home = process.env.HOME || '/home/seller';
    detectedPath = path.join(home, 'GoogleDrive');
    availableMounts.push(
      { path: detectedPath, label: 'Google Drive (Linux)', type: 'drive_desktop' },
      { path: '/data/drive', label: 'Docker Mounted Volume (/data/drive)', type: 'docker_mount' }
    );
    mode = 'mirror';
  }

  res.json({
    platform,
    detectedPath,
    mode,
    availableMounts,
    commonWindowsStream: 'P:\\My Drive',
    commonComputerBackup: 'F:\\Images',
    commonWindowsMirror: 'C:\\Users\\USERNAME\\My Drive',
    commonMacStream: '~/Library/CloudStorage/GoogleDrive-user@domain.com/My Drive',
    timestamp: new Date().toISOString(),
  });
});

// 5b. Local Directory Explorer (Lists actual files in user local folders safely)
app.post('/api/local/browse', async (req: Request, res: Response) => {
  try {
    const { folderPath } = req.body;
    if (!folderPath || typeof folderPath !== 'string' || !folderPath.trim()) {
      res.json({
        exists: false,
        path: '',
        files: [],
        folders: [],
        message: 'No folder path provided.',
      });
      return;
    }

    const targetDir = path.resolve(folderPath.trim());

    // Block listing the application root itself or internal code directories
    const currentAppDir = path.resolve(process.cwd()).toLowerCase();
    const resolvedLower = targetDir.toLowerCase();
    if (resolvedLower === currentAppDir || resolvedLower.includes('node_modules') || resolvedLower.includes('.git')) {
      res.json({
        exists: false,
        path: targetDir,
        files: [],
        folders: [],
        message: 'Application source directories are excluded from photo import.',
      });
      return;
    }

    if (!fs.existsSync(targetDir)) {
      res.json({
        exists: false,
        path: targetDir,
        files: [],
        folders: [],
        message: `Directory ${targetDir} does not exist on this machine.`,
      });
      return;
    }

    const stat = fs.statSync(targetDir);
    if (!stat.isDirectory()) {
      res.status(400).json({ error: 'Provided path is not a directory' });
      return;
    }

    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.gif', '.bmp', '.tiff'];

    const subfolders: string[] = [];
    const imageFiles: Array<{ name: string; fullPath: string; size: number; modified: string }> = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name.toLowerCase().includes('node_modules')) {
        continue;
      }
      const fullPath = path.join(targetDir, entry.name);
      if (entry.isDirectory()) {
        subfolders.push(entry.name);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (imageExtensions.includes(ext)) {
          const fileStat = fs.statSync(fullPath);
          imageFiles.push({
            name: entry.name,
            fullPath,
            size: fileStat.size,
            modified: fileStat.mtime.toISOString(),
          });
        }
      }
    }

    res.json({
      exists: true,
      path: targetDir,
      files: imageFiles,
      folders: subfolders,
      totalImagesCount: imageFiles.length,
    });
  } catch (err: any) {
    console.error('Local browse error:', err);
    res.status(500).json({ error: err.message || 'Failed to read directory' });
  }
});

// 6. Database schema endpoint
app.get('/api/schema', (_req: Request, res: Response) => {
  res.type('text/plain').send(POSTGRESQL_SCHEMA_SQL);
});

// 7. Local AI Endpoint Test (Ollama / Qwen / Local OpenAI API)
app.post('/api/local-ai/test', async (req: Request, res: Response) => {
  const { endpoint, model } = req.body;
  const rawEndpoint = typeof endpoint === 'string' && endpoint.trim().length > 0
    ? endpoint.trim()
    : 'http://127.0.0.1:11434/api/tags';

  let targetUrl: string;
  try {
    const parsed = new URL(rawEndpoint, 'http://127.0.0.1');
    const allowedProtocols = new Set(['http:', 'https:']);
    const allowedHosts = new Set(['localhost', '127.0.0.1', '::1']);

    if (!allowedProtocols.has(parsed.protocol)) {
      return res.status(400).json({ success: false, message: 'Invalid endpoint protocol.' });
    }

    if (!allowedHosts.has(parsed.hostname)) {
      return res.status(400).json({ success: false, message: 'Endpoint host must be local.' });
    }

    if (parsed.username || parsed.password) {
      return res.status(400).json({ success: false, message: 'Endpoint must not include credentials.' });
    }

    targetUrl = parsed.toString();
  } catch {
    return res.status(400).json({ success: false, message: 'Invalid endpoint URL.' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const testRes = await fetch(targetUrl, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (testRes.ok) {
      const data = await testRes.json();
      res.json({ success: true, message: `Connected to local provider at ${endpoint}`, data });
    } else {
      res.json({
        success: false,
        message: `Local provider returned HTTP ${testRes.status}`,
      });
    }
  } catch (err: any) {
    res.json({
      success: false,
      message: `Could not reach ${targetUrl}: ${err.message}. Ensure Ollama or local model server is running.`,
    });
  }
});

// Start server and handle Vite integration
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // In dev: mount Vite middlewares
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In prod: serve built static files from dist
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, () => {
    console.log(`[eBay Hero Gemini Edition] Server active on port ${port} (mode: ${isProduction ? 'prod' : 'dev'})`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup failure:', err);
  process.exit(1);
});
