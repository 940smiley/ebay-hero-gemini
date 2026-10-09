import { AiProvider, AnalysisRequest, StructuredImageAnalysis } from '../types.ts';

export class OpenAiProvider implements AiProvider {
  id = 'openai' as const;
  name = 'OpenAI-Compatible Vision Endpoint';

  constructor(
    private readonly endpoint: string = 'http://localhost:8000/v1',
    private readonly apiKey: string = process.env.OPENAI_API_KEY || 'dummy'
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.endpoint}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async analyzeImage(req: AnalysisRequest): Promise<StructuredImageAnalysis> {
    const model = req.model || 'gpt-4o-mini';
    const cleanBase64 = req.imageBase64.includes('base64,') 
      ? req.imageBase64 
      : `data:${req.mimeType || 'image/jpeg'};base64,${req.imageBase64}`;

    const prompt = `You are an expert appraiser analyzing an inventory item. Filename: ${req.originalFilename}.
Output STRICT JSON adhering to this schema:
{
  "imageDescription": "description",
  "primaryObject": "primary object name",
  "additionalVisibleObjects": [],
  "category": "Main Category",
  "subcategory": "Subcategory or Unknown",
  "manufacturerOrBrand": "Brand or Unknown",
  "productName": "Item Title",
  "modelOrNumber": "Model or Unknown",
  "visibleText": [],
  "ocrSummary": "OCR text",
  "identifiableSubject": "Subject",
  "relevantDatesOrYear": "Year or Unknown",
  "visualConditionIndicators": [],
  "potentialDefects": [],
  "estimatedCondition": "Near Mint (NM 7)",
  "suggestedTags": [],
  "suggestedCollection": "General",
  "suggestedFolder": "Category/Subcategory",
  "suggestedFilename": "RENAMED_001.jpg",
  "confidenceScore": 80,
  "reasoning": "Reasoning",
  "isUnverified": false
}`;

    const res = await fetch(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: cleanBase64 } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: req.temperature ?? 0.2,
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI-compatible vision request failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const content = data.choices[0]?.message?.content || '{}';
    return JSON.parse(content) as StructuredImageAnalysis;
  }
}
