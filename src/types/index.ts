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

export interface GradingDetails {
  grader?: 'PSA' | 'BGS' | 'CGC' | 'SGC' | 'PCGS' | 'NGC' | 'RAW' | 'OTHER';
  gradeNumber?: string;
  certNumber?: string;
  isAutographed?: boolean;
  isHoloOrFoil?: boolean;
  subgrades?: {
    centering?: string;
    corners?: string;
    edges?: string;
    surface?: string;
  };
}

export interface ImageAnalysis {
  objectType: string;
  category: string;
  subcategory: string;
  brandOrManufacturer: string;
  productName: string;
  modelOrCardNumber: string;
  yearOrEra: string;
  conditionClues: string[];
  estimatedCondition: ConditionGrade;
  gradingDetails?: GradingDetails;
  visibleText: string[];
  ocrSummary: string;
  proposedFilename: string;
  proposedRelativeFolder: string;
  confidenceScore: number; // 0 - 100
  reasoning: string;
  tags: string[];
  estimatedMarketValueUsd: {
    low: number;
    median: number;
    high: number;
  };
  blurScore?: number; // 0-100, <45 is blurry
  isBlurry?: boolean;
  isDuplicate?: boolean;
  duplicateGroup?: string;
}

export interface EbayListingDraft {
  title: string; // strict 80 char target
  titleCharCount: number;
  subtitle: string;
  primaryCategoryId: string;
  primaryCategoryName: string;
  conditionId: string;
  conditionDescriptor: string;
  itemSpecifics: Record<string, string>;
  searchKeywords: string[];
  suggestedPriceBin: number;
  suggestedStartingBid: number;
  format: 'FixedPrice' | 'Auction';
  shippingPreset: string;
  descriptionHtml: string;
}

export interface ImageItem {
  id: string;
  originalName: string;
  originalPath: string;
  fileSize: number;
  mimeType: string;
  previewUrl: string;
  proposedName: string;
  proposedFolder: string;
  status: 'pending' | 'analyzing' | 'approved' | 'rejected' | 'executed' | 'error';
  errorMessage?: string;
  confidence: number;
  analysis?: ImageAnalysis;
  ebayDraft?: EbayListingDraft;
  selectedForBatch?: boolean;
  createdAt: string;
  updatedAt: string;
  // Quality & duplicates
  blurScore?: number;
  isBlurry?: boolean;
  isDuplicate?: boolean;
  duplicateOfId?: string;
  sourceType?: 'google_photos' | 'google_drive' | 'local_folder' | 'network_share' | 'external_drive' | 'project_library';
  sourceLocation?: string;
}

export interface FolderRule {
  pattern: string; // e.g. "Inventory/{Category}/{Subcategory}"
  caseStyle: 'UPPER_SNAKE' | 'lower_snake' | 'kebab-case' | 'Title Case' | 'CamelCase';
  numberPadding: number;
  prefixYear: boolean;
  preserveExtension: boolean;
  sanitizeChars: boolean;
}

export interface BatchProgress {
  jobId: string;
  total: number;
  processed: number;
  approved: number;
  rejected: number;
  failed: number;
  inProgress: boolean;
  isPaused: boolean;
  currentFilename?: string;
  checkpointIndex: number;
}

export interface DriveSyncConfig {
  mode: 'stream' | 'mirror' | 'custom';
  platform: 'windows' | 'mac' | 'linux';
  detectedPath: string;
  customPath: string;
  activePath: string;
  libraryName: string;
  autoSyncEnabled: boolean;
  mountLetter?: string; // e.g. 'P:' or 'G:'
  computerBackupPath?: string; // e.g. 'F:\Images'
}

export interface AnalysisToggles {
  ocr: boolean;
  objectDetection: boolean;
  faceDetection: boolean;
  barcode: boolean;
  qr: boolean;
  tradingCard: boolean;
  coin: boolean;
  comic: boolean;
  electronics: boolean;
  vehicle: boolean;
  pet: boolean;
  document: boolean;
}

export interface RenamingSettings {
  template: string; // e.g. "{category}_{description}_{date}"
  collisionStrategy: 'append_number' | 'skip' | 'timestamp' | 'prompt';
  caseConvention: 'UPPER_SNAKE' | 'lower_snake' | 'kebab-case' | 'Title Case';
  preserveDate: boolean;
  maxLength: number;
}

export interface InventoryCustomFields {
  skuPrefix: string;
  defaultCondition: string;
  defaultLocation: string;
  trackCostBasis: boolean;
  customFieldsList: string[];
}

export interface EbaySettings {
  defaultShippingPreset: string;
  returnPolicy: string;
  titleTemplate: string;
  pricingStrategy: 'fixed_bin' | 'auction_start' | 'hybrid';
  auctionDurationDays: number;
  autoAcceptOffers: boolean;
  internationalShipping: boolean;
}

export interface AdvancedPerformanceSettings {
  workerThreads: number;
  memoryLimitMb: number;
  gpuAcceleration: boolean;
  loggingLevel: 'debug' | 'info' | 'warn' | 'error';
  cacheTtlMinutes: number;
  blurSensitivity: number; // 0-100
}

export interface AiSettings {
  provider: 'gemini' | 'ollama' | 'openai' | 'anthropic' | 'openrouter' | 'qwen' | 'custom';
  geminiModel: 'gemini-3.8-flash' | 'gemini-3.1-pro-preview';
  visionModel?: string;
  ocrModel?: string;
  temperature?: number;
  contextLimit?: number;
  enableThinking: boolean;
  thinkingLevel: 'HIGH' | 'LOW';
  localEndpoint: string;
  localModelName: string;
  batchConcurrency: number;
  analysisToggles?: AnalysisToggles;
  renamingSettings?: RenamingSettings;
  inventorySettings?: InventoryCustomFields;
  ebaySettings?: EbaySettings;
  performanceSettings?: AdvancedPerformanceSettings;
}

export interface ScriptBundle {
  powershell: string;
  bash: string;
  python: string;
  batch: string;
  rollbackPowershell: string;
  rollbackBash: string;
  renameLogJson: string;
  rollbackLogJson: string;
  auditLogJson: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  imageAttachment?: string;
  thoughtProcess?: string;
  error?: boolean;
}

export interface AuditRecord {
  timestamp: string;
  action: 'analyze' | 'rename' | 'move' | 'rollback' | 'export';
  imageId: string;
  originalName: string;
  newName: string;
  originalPath: string;
  newPath: string;
  status: 'success' | 'reverted' | 'failed';
  performedBy: string;
}

export type PhotoSourceType = 
  | 'google_photos' 
  | 'google_drive' 
  | 'local_folder' 
  | 'network_share' 
  | 'external_drive' 
  | 'project_library';

export type DriveScopeType = 
  | 'my_drive' 
  | 'shared_drives' 
  | 'shared_with_me' 
  | 'computers';

export interface DriveFolderTreeItem {
  id: string;
  name: string;
  scope: DriveScopeType;
  parentId?: string;
  children?: DriveFolderTreeItem[];
  iconType?: 'my_drive' | 'shared_drive' | 'shared_with_me' | 'computer' | 'folder';
  computerName?: string;
  originalLocalPath?: string; // e.g. "F:\Images"
}

export interface SmartCollection {
  id: string;
  name: string;
  description: string;
  icon: string;
  filter: (item: ImageItem) => boolean;
}
