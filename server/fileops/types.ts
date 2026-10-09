/**
 * Types for File Renaming, Directory Organization, and Atomic Rollbacks.
 */

export interface RenameTemplateConfig {
  template: string; // e.g. "{category}_{description}_{date}"
  caseConvention: 'UPPER_SNAKE' | 'lower_snake' | 'kebab-case' | 'Title Case' | 'preserve';
  collisionStrategy: 'append_number' | 'skip' | 'timestamp' | 'error';
  preserveExtension: boolean;
  dateFormat: 'YYYYMMDD' | 'YYYY-MM-DD' | 'YYYY';
  numberPadding: number; // e.g. 3 -> "001"
}

export interface DirectoryTemplateConfig {
  rootDirectory: string;
  pattern: string; // e.g. "{category}/{subcategory}/{year}"
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
