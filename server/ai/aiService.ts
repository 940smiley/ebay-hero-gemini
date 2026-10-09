import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../security/secretStore.ts';
import { AiProvider, AnalysisRequest, StructuredImageAnalysis } from './types.ts';
import { GeminiProvider } from './providers/geminiProvider.ts';
import { OllamaProvider } from './providers/ollamaProvider.ts';
import { OpenAiProvider } from './providers/openaiProvider.ts';

export class AiService {
  private providers = new Map<string, AiProvider>();
  private cachePath: string;
  private cache = new Map<string, StructuredImageAnalysis>();

  constructor(dataDir: string = DATA_DIR) {
    this.cachePath = path.join(dataDir, 'cache', 'ai-analysis.json');
    fs.mkdirSync(path.dirname(this.cachePath), { recursive: true });
    this.loadCache();

    // Register default providers
    this.registerProvider(new GeminiProvider());
    this.registerProvider(new OllamaProvider());
    this.registerProvider(new OpenAiProvider());
  }

  registerProvider(provider: AiProvider) {
    this.providers.set(provider.id, provider);
  }

  private loadCache() {
    if (fs.existsSync(this.cachePath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.cachePath, 'utf8'));
        for (const [k, v] of Object.entries(raw)) {
          this.cache.set(k, v as StructuredImageAnalysis);
        }
      } catch (e) {
        console.warn('Could not read AI cache:', e);
      }
    }
  }

  private saveCache() {
    try {
      const obj: Record<string, StructuredImageAnalysis> = {};
      for (const [k, v] of this.cache.entries()) {
        obj[k] = v;
      }
      fs.writeFileSync(this.cachePath, JSON.stringify(obj, null, 2));
    } catch (e) {
      console.warn('Could not save AI cache:', e);
    }
  }

  private computeHash(request: AnalysisRequest): string {
    if (request.imageHash) return request.imageHash;
    return crypto.createHash('sha256').update(request.imageBase64).digest('hex');
  }

  async analyze(request: AnalysisRequest, forceRefresh = false): Promise<StructuredImageAnalysis> {
    const hash = this.computeHash(request);
    const cacheKey = `${request.provider || 'gemini'}:${request.model || 'default'}:${hash}`;

    if (!forceRefresh && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const providerId = request.provider || 'gemini';
    const provider = this.providers.get(providerId);

    if (!provider) {
      throw new Error(`AI Provider "${providerId}" is not registered.`);
    }

    try {
      const result = await provider.analyzeImage(request);
      this.validateAndNormalize(result, request.originalFilename);

      // Save to cache
      this.cache.set(cacheKey, result);
      this.saveCache();

      return result;
    } catch (err: any) {
      console.error(`AI Analysis error using provider ${providerId}:`, err);
      // Fallback heuristic if external service is unavailable or API key missing
      return this.generateFallbackAnalysis(request.originalFilename);
    }
  }

  private validateAndNormalize(res: any, originalFilename: string) {
    if (!res.primaryObject) res.primaryObject = 'Collectible Item';
    if (!res.category) res.category = 'Collectibles';
    if (!res.subcategory) res.subcategory = 'General';
    if (!res.suggestedFilename) {
      const ext = path.extname(originalFilename) || '.jpg';
      const base = path.basename(originalFilename, ext);
      res.suggestedFilename = `${base.toUpperCase()}_001${ext}`;
    }
    res.proposedFilename = res.proposedFilename || res.suggestedFilename;
    res.suggestedFilename = res.suggestedFilename || res.proposedFilename;

    if (!res.suggestedFolder) {
      res.suggestedFolder = `${res.category}/${res.subcategory}`;
    }
    res.proposedRelativeFolder = res.proposedRelativeFolder || res.suggestedFolder;
    res.suggestedFolder = res.suggestedFolder || res.proposedRelativeFolder;

    if (typeof res.confidenceScore !== 'number') res.confidenceScore = 75;
    if (!Array.isArray(res.visibleText)) res.visibleText = [];
    if (!Array.isArray(res.suggestedTags)) res.suggestedTags = [];
    if (!res.estimatedCondition) res.estimatedCondition = 'Near Mint (NM 7)';

    if (!res.ebayDraft) {
      const title = `${res.category} ${res.productName || 'Collectible'} ${res.estimatedCondition || ''}`.trim().slice(0, 80);
      res.ebayDraft = {
        title,
        subtitle: `${res.estimatedCondition || 'High Quality'} - Authentic Item`,
        primaryCategoryId: '183437',
        primaryCategoryName: res.category || 'Collectibles',
        conditionDescriptor: res.estimatedCondition || 'Used / Very Good',
        itemSpecifics: {
          Brand: res.manufacturerOrBrand || 'Unbranded',
          Type: res.primaryObject || 'Collectible',
          Category: res.category || 'Collectibles',
        },
        suggestedPriceBin: res.estimatedMarketValueUsd?.median || 19.99,
        suggestedStartingBid: res.estimatedMarketValueUsd?.low || 9.99,
        shippingPreset: 'USPS Ground Advantage Bubble Mailer + Top Loader',
        descriptionHtml: `<div><h3>${title}</h3><p>Item: ${res.productName || 'Collectible'}</p><p>Condition: ${res.estimatedCondition || 'Near Mint'}</p></div>`,
      };
    } else if (res.ebayDraft.title && res.ebayDraft.title.length > 80) {
      res.ebayDraft.title = res.ebayDraft.title.slice(0, 80);
    }
  }

  private generateFallbackAnalysis(originalFilename: string): StructuredImageAnalysis {
    const ext = path.extname(originalFilename) || '.jpg';
    const base = path.basename(originalFilename, ext);
    const isCard = /card|topps|panini|psa|pokemon|charizard/i.test(originalFilename);
    const isStamp = /stamp|postage|scott/i.test(originalFilename);

    const category = isCard ? 'Trading Cards' : isStamp ? 'Stamps' : 'Collectibles';
    const subcategory = isCard ? 'Sports Cards' : isStamp ? 'United States' : 'General';
    const suggestedFolder = `${category}/${subcategory}`;
    const suggestedFilename = `${category.toUpperCase()}_${base.toUpperCase().replace(/\s+/g, '_')}_001${ext}`;
    const title = `${category} ${base.replace(/[_-]+/g, ' ')}`.slice(0, 80);

    return {
      imageDescription: `Visual analysis of ${originalFilename}.`,
      primaryObject: isCard ? 'Trading Card' : isStamp ? 'Postage Stamp' : 'Collectible Item',
      additionalVisibleObjects: [],
      category,
      subcategory,
      manufacturerOrBrand: isCard ? 'Topps' : isStamp ? 'US Postal Service' : 'Unknown',
      productName: base.replace(/[_-]+/g, ' '),
      modelOrNumber: 'Unverified',
      visibleText: [],
      ocrSummary: 'OCR details pending high-resolution inspection',
      identifiableSubject: base,
      relevantDatesOrYear: 'Unverified',
      visualConditionIndicators: ['Clean surface', 'Inspect edges under magnification'],
      potentialDefects: [],
      estimatedCondition: 'Near Mint (NM 7)',
      suggestedTags: [category, subcategory, 'Vintage', 'Collectibles'],
      suggestedCollection: category,
      suggestedFolder,
      suggestedFilename,
      proposedFilename: suggestedFilename,
      proposedRelativeFolder: suggestedFolder,
      confidenceScore: 70,
      reasoning: 'Generated from verifiable file markers. Connect Gemini API Key for multimodal neural appraising.',
      isUnverified: true,
      estimatedMarketValueUsd: {
        low: 5.0,
        median: 12.0,
        high: 25.0,
      },
      ebayDraft: {
        title,
        subtitle: 'Authentic Collectible Item',
        primaryCategoryId: '183437',
        primaryCategoryName: category,
        conditionDescriptor: 'Near Mint (NM 7)',
        itemSpecifics: {
          Brand: isCard ? 'Topps' : isStamp ? 'USPS' : 'Unknown',
          Type: isCard ? 'Trading Card' : isStamp ? 'Stamp' : 'Collectible',
        },
        suggestedPriceBin: 19.99,
        suggestedStartingBid: 9.99,
        shippingPreset: 'USPS Ground Advantage Bubble Mailer + Top Loader',
        descriptionHtml: `<div><h3>${title}</h3><p>Condition: Near Mint (NM 7)</p></div>`,
      },
    };
  }
}
