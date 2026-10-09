import { AiProvider, AnalysisRequest, StructuredImageAnalysis } from '../types.ts';

export class OllamaProvider implements AiProvider {
  id = 'ollama' as const;
  name = 'Ollama Local Multimodal';

  constructor(private readonly endpoint: string = 'http://127.0.0.1:11434') {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.endpoint}/api/tags`, { signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async analyzeImage(req: AnalysisRequest): Promise<StructuredImageAnalysis> {
    const model = req.model || 'qwen2.5-vl:7b';
    const cleanBase64 = req.imageBase64.replace(/^data:image\/[a-z0-9.+]+;base64,/, '');

    const prompt = `Analyze this collectibles/inventory image in detail. Original filename: ${req.originalFilename}.
Respond strictly in JSON matching this schema:
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
  "reasoning": "Identification reasoning",
  "isUnverified": false
}`;

    const res = await fetch(`${this.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        images: [cleanBase64],
        format: 'json',
        stream: false,
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama request failed with HTTP ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    return JSON.parse(data.response) as StructuredImageAnalysis;
  }
}
