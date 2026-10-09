import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { 
  RenameTemplateConfig, 
  DirectoryTemplateConfig, 
  ProposedFileOperation, 
  OperationManifest 
} from './types.ts';

export class SafePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SafePathError';
  }
}

export class FileOrganizer {
  /**
   * Sanitizes a string for safe usage in a filename.
   * Strips forbidden OS characters (\ / : * ? " < > | and control chars) while preserving Unicode and spaces.
   */
  static sanitizeFilename(name: string): string {
    return name
      .replace(/[\\/:*?"<>|\x00-\x1F\x7F]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Applies case style conventions.
   */
  static applyCaseConvention(str: string, convention: RenameTemplateConfig['caseConvention']): string {
    if (convention === 'preserve') return str;
    const words = str.match(/[\p{L}\p{N}]+/gu) || [str];

    switch (convention) {
      case 'UPPER_SNAKE':
        return words.map(w => w.toUpperCase()).join('_');
      case 'lower_snake':
        return words.map(w => w.toLowerCase()).join('_');
      case 'kebab-case':
        return words.map(w => w.toLowerCase()).join('-');
      case 'Title Case':
        return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      default:
        return str;
    }
  }

  /**
   * Renders a filename from a template string with given variables.
   */
  static renderFilename(
    template: string,
    vars: Record<string, string | number | undefined>,
    sequenceNum: number,
    config: RenameTemplateConfig,
    originalExtension: string
  ): string {
    const now = new Date();
    const dateFormatted = config.dateFormat === 'YYYY-MM-DD'
      ? now.toISOString().slice(0, 10)
      : config.dateFormat === 'YYYY'
      ? String(now.getFullYear())
      : now.toISOString().slice(0, 10).replace(/-/g, '');

    const padding = config.numberPadding || 3;
    const seqStr = String(sequenceNum).padStart(padding, '0');

    let rendered = template;
    const allVars: Record<string, string> = {
      date: dateFormatted,
      sequence: seqStr,
      ...Object.fromEntries(
        Object.entries(vars).map(([k, v]) => [k, v !== undefined ? String(v) : ''])
      ),
    };

    for (const [key, val] of Object.entries(allVars)) {
      const regex = new RegExp(`\\{${key}\\}`, 'gi');
      rendered = rendered.replace(regex, val);
    }

    // Clean remaining unreplaced template braces
    rendered = rendered.replace(/\{[a-z0-9_-]+\}/gi, '').trim();

    // Sanitize and apply case convention
    const ext = config.preserveExtension ? (originalExtension.startsWith('.') ? originalExtension : `.${originalExtension}`) : '';
    const cleanBase = this.sanitizeFilename(rendered);
    const cased = this.applyCaseConvention(cleanBase, config.caseConvention);

    return `${cased || 'ITEM_' + seqStr}${ext}`;
  }

  /**
   * Renders a directory path pattern from variables.
   */
  static renderDirectoryPath(pattern: string, vars: Record<string, string | undefined>): string {
    let rendered = pattern;
    for (const [k, v] of Object.entries(vars)) {
      const regex = new RegExp(`\\{${k}\\}`, 'gi');
      rendered = rendered.replace(regex, v ? this.sanitizeFilename(v) : 'General');
    }
    rendered = rendered.replace(/\{[a-z0-9_-]+\}/gi, 'General');
    return path.normalize(rendered).replace(/^[\/\\]+/, '');
  }

  /**
   * Generates a preview plan with collision detection without touching files on disk.
   */
  static generatePlan(
    items: Array<{
      id: string;
      originalPath: string;
      originalFilename: string;
      vars: Record<string, any>;
      confidence?: number;
      reason?: string;
    }>,
    renameConfig: RenameTemplateConfig,
    dirConfig: DirectoryTemplateConfig
  ): OperationManifest {
    const baseDir = path.resolve(dirConfig.rootDirectory);
    const operations: ProposedFileOperation[] = [];
    const plannedPaths = new Set<string>();

    items.forEach((item, index) => {
      const ext = path.extname(item.originalFilename) || '.jpg';
      const itemVars = (item as any).vars || (item as any);
      let proposedName = this.renderFilename(
        renameConfig.template,
        itemVars,
        index + 1,
        renameConfig,
        ext
      );

      const relDir = this.renderDirectoryPath(dirConfig.pattern, itemVars);
      let targetFullPath = path.resolve(baseDir, relDir, proposedName);

      // Verify safe path: target must not escape base directory
      const rel = path.relative(baseDir, targetFullPath);
      if (rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new SafePathError(`Security violation: Proposed path "${targetFullPath}" escapes authorized root "${baseDir}"`);
      }

      let conflict = false;
      let conflictResolvedName: string | undefined;

      // Check collision against other planned files or existing filesystem files
      const lowerPath = targetFullPath.toLowerCase();
      if (plannedPaths.has(lowerPath) || fs.existsSync(targetFullPath)) {
        conflict = true;
        if (renameConfig.collisionStrategy === 'append_number') {
          let counter = 2;
          let candidateName = '';
          let candidatePath = '';
          do {
            const baseWithoutExt = path.basename(proposedName, ext);
            candidateName = `${baseWithoutExt}_${String(counter).padStart(3, '0')}${ext}`;
            candidatePath = path.resolve(baseDir, relDir, candidateName);
            counter++;
          } while (plannedPaths.has(candidatePath.toLowerCase()) || fs.existsSync(candidatePath));

          conflictResolvedName = candidateName;
          targetFullPath = candidatePath;
        } else if (renameConfig.collisionStrategy === 'timestamp') {
          const ts = Date.now();
          const baseWithoutExt = path.basename(proposedName, ext);
          conflictResolvedName = `${baseWithoutExt}_${ts}${ext}`;
          targetFullPath = path.resolve(baseDir, relDir, conflictResolvedName);
        }
      }

      plannedPaths.add(targetFullPath.toLowerCase());

      operations.push({
        id: item.id,
        originalPath: item.originalPath,
        originalFilename: item.originalFilename,
        proposedFilename: conflictResolvedName || proposedName,
        proposedRelativeDirectory: relDir,
        proposedFullPath: targetFullPath,
        confidence: item.confidence ?? 80,
        reason: item.reason || 'AI categorization based on visual features',
        conflict,
        conflictResolvedName,
        status: 'pending',
      });
    });

    return {
      manifestId: `manifest-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      createdAt: new Date().toISOString(),
      baseDirectory: baseDir,
      operations,
      dryRun: true,
      totalFiles: operations.length,
      approvedCount: 0,
      rejectedCount: 0,
      executedCount: 0,
      failedCount: 0,
      rollbackLog: [],
    };
  }

  /**
   * Deterministically executes an approved manifest.
   * Never silently overwrites files.
   */
  static async executeManifest(
    manifest: OperationManifest,
    approvedOperationIds: Set<string>,
    createFolders = true
  ): Promise<OperationManifest> {
    const updated = { ...manifest, dryRun: false, executedAt: new Date().toISOString() };
    const baseDir = path.resolve(manifest.baseDirectory);

    for (const op of updated.operations) {
      if (!approvedOperationIds.has(op.id)) {
        op.status = 'rejected';
        updated.rejectedCount++;
        continue;
      }

      op.status = 'approved';
      updated.approvedCount++;

      try {
        const sourcePath = path.resolve(op.originalPath);
        const targetPath = path.resolve(op.proposedFullPath);

        // Security check
        const rel = path.relative(baseDir, targetPath);
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
          throw new SafePathError(`Target path escapes base directory: ${targetPath}`);
        }

        if (!fs.existsSync(sourcePath)) {
          op.status = 'failed';
          updated.failedCount++;
          continue;
        }

        if (fs.existsSync(targetPath)) {
          throw new Error(`Target file already exists (preventing overwrite): ${targetPath}`);
        }

        if (createFolders) {
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        }

        // Perform atomic rename/move
        fs.renameSync(sourcePath, targetPath);
        op.status = 'executed';
        updated.executedCount++;

        // Append to rollback log
        updated.rollbackLog.push({
          originalPath: sourcePath,
          movedPath: targetPath,
          restored: false,
        });
      } catch (err: any) {
        op.status = 'failed';
        updated.failedCount++;
        console.error(`Failed to execute operation for ${op.originalFilename}:`, err);
      }
    }

    return updated;
  }

  /**
   * Reverses an executed manifest using the rollback log.
   */
  static async rollbackManifest(manifest: OperationManifest): Promise<OperationManifest> {
    const updated = { ...manifest };

    for (const entry of updated.rollbackLog) {
      if (entry.restored) continue;
      try {
        if (fs.existsSync(entry.movedPath)) {
          fs.mkdirSync(path.dirname(entry.originalPath), { recursive: true });
          fs.renameSync(entry.movedPath, entry.originalPath);
          entry.restored = true;
        }
      } catch (err) {
        console.error(`Rollback error restoring ${entry.movedPath} -> ${entry.originalPath}:`, err);
      }
    }

    // Update operation statuses to rolled_back
    for (const op of updated.operations) {
      if (op.status === 'executed') {
        op.status = 'rolled_back';
      }
    }

    return updated;
  }
}
