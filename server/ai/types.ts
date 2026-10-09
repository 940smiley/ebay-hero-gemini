/**
 * AI Subsystem Types and Structured Output Schema.
 */

export interface AnalysisRequest {
  imageBase64: string;
  mimeType: string;
  originalFilename: string;
  imageHash?: string;
  provider?: 'gemini' | 'ollama' | 'openai';
  model?: string;
  temperature?: number;
  enableThinking?: boolean;
  pluginPromptExtension?: string;
}

export type ConditionGrade = 
  | 'Gem Mint / PSA 10 Candidate' 
  | 'Mint / PSA 9' 
  | 'Near Mint-Mint (NM-MT 8)' 
  | 'Near Mint (NM 7)' 
  | 'Excellent-Mint (EX-MT 6)' 
  | 'Very Good (VG 3-4)' 
  | 'Played / Good' 
  | 'Damaged / Filler' 
  | 'Graded Slab';

export interface StructuredImageAnalysis {
  imageDescription: string;
  primaryObject: string;
  additionalVisibleObjects: string[];
  category: string;
  subcategory: string;
  manufacturerOrBrand: string;
  productName: string;
  modelOrNumber: string;
  visibleText: string[];
  ocrSummary: string;
  identifiableSubject: string;
  relevantDatesOrYear: string;
  visualConditionIndicators: string[];
  potentialDefects: string[];
  estimatedCondition: ConditionGrade;
  suggestedTags: string[];
  suggestedCollection: string;
  suggestedFolder: string;
  suggestedFilename: string;
  confidenceScore: number; // 0 - 100
  reasoning: string;
  isUnverified: boolean;
  estimatedMarketValueUsd?: {
    low: number;
    median: number;
    high: number;
  };
  pluginData?: Record<string, any>;
}

export interface AiProvider {
  id: 'gemini' | 'ollama' | 'openai';
  name: string;
  isAvailable(): Promise<boolean>;
  analyzeImage(request: AnalysisRequest): Promise<StructuredImageAnalysis>;
}
