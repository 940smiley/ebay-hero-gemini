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

export type ImageRole = 
  | 'front' 
  | 'rear' 
  | 'left_side' 
  | 'right_side' 
  | 'top' 
  | 'bottom' 
  | 'corner' 
  | 'surface_detail' 
  | 'text_label' 
  | 'serial_number' 
  | 'packaging' 
  | 'defect' 
  | 'other' 
  | 'unclassified';

export interface ImageCropArea {
  x: number;
  y: number;
  width: number;
  height: number;
  aspectPreset?: 'free' | '1:1' | '4:3' | '16:9' | 'card_2.5_3.5' | 'slab';
}

export interface ImageAdjustments {
  brightness: number; // -100 to 100, default 0
  contrast: number; // -100 to 100, default 0
  exposure: number; // -100 to 100, default 0
  saturation: number; // -100 to 100, default 0
  sharpness: number; // 0 to 100, default 0
}

export interface ImageEditRevision {
  id: string;
  imageId: string;
  rotation: number; // 0, 90, 180, 270
  straightenAngle: number; // -45 to +45 deg
  flipH: boolean;
  flipV: boolean;
  crop?: ImageCropArea;
  adjustments: ImageAdjustments;
  updatedAt: string;
}

export interface ImageAssignment {
  imageId: string;
  role: ImageRole;
  order: number;
  notes?: string;
  includedInEbayDraft?: boolean;
}

export interface InventoryItemGroup {
  id: string;
  title: string;
  category: string;
  subcategory?: string;
  estimatedCondition?: ConditionGrade;
  cardOrModelNumber?: string;
  primaryImageId: string;
  imageAssignments: ImageAssignment[];
  confidenceScore: number;
  autoGrouped: boolean;
  status: 'draft' | 'grouped' | 'ready_for_listing' | 'listed' | 'sold';
  ebayListingDraft?: EbayListingDraft;
  createdAt: string;
  updatedAt: string;
}

export interface DuplicateCandidate {
  id: string;
  originalImageId: string;
  duplicateImageId: string;
  matchType: 'exact_sha256' | 'visual_phash' | 'catalog_copy';
  similarityScore: number; // 0 - 100
  hammingDistance?: number;
  status: 'pending' | 'resolved_merged' | 'resolved_kept_both' | 'resolved_assigned_view' | 'resolved_discarded';
  detectedAt: string;
}

export type SocialPlatform = 'facebook' | 'instagram' | 'tiktok' | 'twitter' | 'pinterest' | 'youtube_shorts';

export interface SocialMediaPost {
  platform: SocialPlatform;
  title: string;
  caption: string;
  hashtags: string[];
  callToAction: string;
  recommendedAspectRatio: string;
  characterCount: number;
  characterLimit: number;
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
  sha256?: string;
  pHash?: string;
  role?: ImageRole;
  groupId?: string;
  editRevision?: ImageEditRevision;
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

// ==========================================
// Plugin Architecture Types
// ==========================================
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  icon: string;
  category: 'collectibles' | 'trading_cards' | 'philately' | 'numismatics' | 'general';
  dependencies?: string[];
  enabledByDefault: boolean;
  enabled?: boolean;
}

export interface CustomFieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean' | 'date';
  options?: string[];
  placeholder?: string;
  required?: boolean;
}

export interface PluginExtension {
  manifest: PluginManifest;
  customFields: CustomFieldDefinition[];
  analysisPromptExtension: string;
  filenameTemplate: string;
  directoryTemplate: string;
  listingTitlePattern: string;
  defaultEbayCategoryId: string;
  defaultItemSpecifics: Record<string, string>;
  supportedCategories: string[];
}

export interface PluginDiagnosticItem {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  fieldsCount: number;
  healthy: boolean;
  issues: string[];
}

// ==========================================
// eBay Integration & CSV Types
// ==========================================
export interface EbayCredentials {
  clientId: string;
  clientSecret: string;
  environment: 'sandbox' | 'production';
  devId?: string;
  ruName?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  lastConnectedAt?: string;
  lastValidatedAt?: string;
}

export interface EbayListingTemplate {
  id: string;
  name: string;
  category: 'collectibles' | 'trading_cards' | 'stamps' | 'coins' | 'electronics' | 'custom';
  titlePattern: string;
  defaultCategoryId: string;
  defaultCategoryName: string;
  defaultConditionId: string;
  format: 'FixedPrice' | 'Auction';
  defaultDurationDays: number;
  shippingPreset: string;
  dispatchTimeMax: number;
  returnsAccepted: boolean;
  returnPeriodDays: number;
  paymentPolicy?: string;
  defaultDescriptionHtml: string;
  itemSpecificRules: Record<string, string>;
}

export interface EbayListingRow {
  action: 'Add' | 'Revise' | 'End' | 'VerifyAdd';
  category: string;
  title: string;
  description: string;
  conditionId: string;
  format: 'FixedPrice' | 'Auction';
  startPrice?: number;
  buyItNowPrice?: number;
  quantity: number;
  duration: string;
  location: string;
  shippingService: string;
  shippingCost: number;
  dispatchTimeMax: number;
  returnsAcceptedOption: 'ReturnsAccepted' | 'ReturnsNotAccepted';
  customLabelSku: string;
  picUrl?: string;
  itemSpecifics: Record<string, string>;
}

export interface CsvValidationResult {
  valid: boolean;
  totalRows: number;
  missingRequiredFields: Array<{
    rowIndex: number;
    sku: string;
    field: string;
    message: string;
  }>;
  warnings: Array<{
    rowIndex: number;
    sku: string;
    field: string;
    message: string;
  }>;
}

// ==========================================
// File Renaming & Organization Types
// ==========================================
export interface RenameTemplateConfig {
  template: string;
  caseConvention: 'UPPER_SNAKE' | 'lower_snake' | 'kebab-case' | 'Title Case' | 'preserve';
  collisionStrategy: 'append_number' | 'skip' | 'timestamp' | 'error';
  preserveExtension: boolean;
  dateFormat: 'YYYYMMDD' | 'YYYY-MM-DD' | 'YYYY';
  numberPadding: number;
}

export interface DirectoryTemplateConfig {
  rootDirectory: string;
  pattern: string;
  createFolders: boolean;
}

export interface ProposedFileOperation {
  id: string;
  originalPath: string;
  originalFilename: string;
  proposedFilename: string;
  proposedRelativeDirectory: string;
  proposedFullPath: string;
  sha256?: string;
  confidence: number;
  reason: string;
  conflict: boolean;
  conflictResolvedName?: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed' | 'rolled_back';
}

export interface OperationManifest {
  manifestId: string;
  createdAt: string;
  executedAt?: string;
  baseDirectory: string;
  operations: ProposedFileOperation[];
  dryRun: boolean;
  totalFiles: number;
  approvedCount: number;
  rejectedCount: number;
  executedCount: number;
  failedCount: number;
  rollbackLog: Array<{
    originalPath: string;
    movedPath: string;
    restored: boolean;
  }>;
}
