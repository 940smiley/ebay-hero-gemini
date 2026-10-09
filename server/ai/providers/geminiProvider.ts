import { GoogleGenAI } from '@google/genai';
import { AiProvider, AnalysisRequest, StructuredImageAnalysis } from '../types.ts';

export class GeminiProvider implements AiProvider {
  id = 'gemini' as const;
  name = 'Google Gemini';

  private getClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not defined.');
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  async analyzeImage(req: AnalysisRequest): Promise<StructuredImageAnalysis> {
    const ai = this.getClient();
    const model = req.model || 'gemini-3.8-flash';

    const systemInstruction = `You are eBay Hero - an advanced AI engine for inventory intelligence, collectibles identification, and e-commerce cataloging.
Analyze the image with precision. Distinguish between facts visible in the image and AI-generated inferences.
If an exact detail (such as issue date, catalog number, denomination, or authenticity) cannot reliably be determined from the image, explicitly set it to "Unknown" or "Unverified" and flag isUnverified: true.
Do NOT fabricate numbers, dates, or grades that cannot be read directly or verified from visible markings.`;

    const prompt = `Analyze this image in detail and produce a structured catalog assessment.
${req.pluginPromptExtension ? `\nDomain Extension Instructions:\n${req.pluginPromptExtension}\n` : ''}

Original filename: ${req.originalFilename}

Return STRICT JSON matching this schema:
{
  "imageDescription": "Concise factual description of what is visible",
  "primaryObject": "Name of main object",
  "additionalVisibleObjects": ["other items in frame"],
  "category": "Main category (e.g. Stamps, Trading Cards, Coins, Comics, Electronics)",
  "subcategory": "Specific subcategory or Unknown",
  "manufacturerOrBrand": "Maker/Publisher/Brand or Unknown",
  "productName": "Model, title, or character",
  "modelOrNumber": "Identifiable model number, card number, or catalog reference if visible",
  "visibleText": ["list of legible text snippets extracted via OCR"],
  "ocrSummary": "Summary of extracted text",
  "identifiableSubject": "Main subject (e.g. player name, landmark, character)",
  "relevantDatesOrYear": "Visible date or era, or Unknown",
  "visualConditionIndicators": ["factual observations on centering, corners, edges, wear"],
  "potentialDefects": ["creases, tears, stains, pinholes, scratches, or none visible"],
  "estimatedCondition": "One of: Gem Mint / PSA 10 Candidate | Mint / PSA 9 | Near Mint-Mint (NM-MT 8) | Near Mint (NM 7) | Excellent-Mint (EX-MT 6) | Very Good (VG 3-4) | Played / Good | Damaged / Filler | Graded Slab",
  "suggestedTags": ["tag1", "tag2", "tag3"],
  "suggestedCollection": "Suggested collection grouping",
  "suggestedFolder": "Category/Subcategory",
  "suggestedFilename": "SUGGESTED_NAME_001.jpg",
  "proposedFilename": "SUGGESTED_NAME_001.jpg",
  "proposedRelativeFolder": "Category/Subcategory",
  "confidenceScore": 85,
  "reasoning": "Reasoning explaining why this item was identified as such",
  "isUnverified": false,
  "estimatedMarketValueUsd": {
    "low": 10.0,
    "median": 15.0,
    "high": 25.0
  },
  "ebayDraft": {
    "title": "Strictly up to 80 chars high-converting listing title",
    "subtitle": "Subtitle highlights",
    "primaryCategoryId": "183437",
    "primaryCategoryName": "Collectibles",
    "conditionDescriptor": "Near Mint (NM 7)",
    "itemSpecifics": {
      "Brand": "Maker or Publisher",
      "Type": "Item type",
      "Era": "Year or Era"
    },
    "suggestedPriceBin": 25.0,
    "suggestedStartingBid": 9.99,
    "shippingPreset": "USPS Ground Advantage Bubble Mailer + Top Loader",
    "descriptionHtml": "<div>Clean responsive item description HTML</div>"
  }
}`;

    const cleanBase64 = req.imageBase64.replace(/^data:image\/[a-z0-9.+]+;base64,/, '');

    const contents = [
      { text: prompt },
      {
        inlineData: {
          mimeType: req.mimeType || 'image/jpeg',
          data: cleanBase64,
        },
      },
    ];

    const config: any = {
      systemInstruction,
      responseMimeType: 'application/json',
      temperature: req.temperature ?? 0.2,
    };

    if (req.enableThinking && model.includes('pro')) {
      config.thinkingConfig = { thinkingBudget: 2048 };
    }

    const response = await ai.models.generateContent({
      model,
      contents,
      config,
    });

    const text = response.text || '';
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim();
    const parsed = JSON.parse(cleaned) as StructuredImageAnalysis;
    if (parsed.ebayDraft && parsed.ebayDraft.title && parsed.ebayDraft.title.length > 80) {
      parsed.ebayDraft.title = parsed.ebayDraft.title.slice(0, 80);
    }
    return parsed;
  }
}
