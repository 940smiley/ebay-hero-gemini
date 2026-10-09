import { DriveClient, DriveImage, DriveScopeSummary } from './drive.ts';
import type { SerializedSelection } from '../../src/lib/selection.ts';

export interface ResolvedSelectionSummary extends DriveScopeSummary {
  truncated: boolean;
}

/**
 * Turns a serialized selection (scopes + individual ids - exclusions) into a de-duplicated stream of real Drive images.
 * Enumeration follows API pagination to the end, so counts never depend on what the UI has rendered.
 */
export async function* resolveDriveSelection(
  client: DriveClient,
  sel: SerializedSelection,
  opts: { signal?: AbortSignal; maxFiles?: number } = {},
): AsyncGenerator<{ image: DriveImage; folderPath: string }> {
  const excluded = new Set(sel.excluded);
  const emitted = new Set<string>();
  const maxFiles = opts.maxFiles ?? 50000;
  let count = 0;

  for (const scope of sel.scopes) {
    if (scope.source !== 'google_drive') continue;
    const isRoot = scope.folderId === 'root';
    for await (const e of client.walkImages({
      folderId: isRoot ? undefined : scope.folderId,
      driveId: scope.driveId,
      recursive: scope.recursive,
      signal: opts.signal,
    })) {
      if (e.kind !== 'image' || excluded.has(e.image.id) || emitted.has(e.image.id)) continue;
      emitted.add(e.image.id);
      if (++count > maxFiles) return;
      yield { image: e.image, folderPath: e.folderPath || scope.label };
    }
  }

  // Individually picked files not already covered by a scope
  const rest = sel.included.filter((id) => !emitted.has(id) && !excluded.has(id));
  const concurrency = 5;
  for (let i = 0; i < rest.length; i += concurrency) {
    if (opts.signal?.aborted) return;
    const metas = await Promise.all(rest.slice(i, i + concurrency).map((id) => client.getFileMeta(id).catch(() => null)));
    for (const image of metas) {
      if (!image || emitted.has(image.id)) continue;
      emitted.add(image.id);
      if (++count > maxFiles) return;
      yield { image, folderPath: '' };
    }
  }
}

export async function summarizeDriveSelection(client: DriveClient, sel: SerializedSelection, signal?: AbortSignal): Promise<ResolvedSelectionSummary> {
  const s: ResolvedSelectionSummary = { files: 0, folders: 0, totalBytes: 0, bytesUnknownFiles: 0, unsupported: 0, duplicates: 0, truncated: false };
  const md5 = new Set<string>();
  const maxFiles = 50000;

  // folders: count descendant directories of recursive scopes
  for (const scope of sel.scopes) {
    if (scope.source !== 'google_drive' || !scope.recursive) continue;
    for await (const e of client.walkImages({ folderId: scope.folderId === 'root' ? undefined : scope.folderId, driveId: scope.driveId, recursive: true, signal })) {
      if (e.kind === 'folder') s.folders++;
    }
    s.folders++; // the scope root itself
  }

  for await (const { image } of resolveDriveSelection(client, sel, { signal, maxFiles })) {
    if (!image.supported) { s.unsupported++; continue; }
    s.files++;
    if (image.size === undefined) s.bytesUnknownFiles++;
    else s.totalBytes += image.size;
    if (image.md5Checksum) {
      if (md5.has(image.md5Checksum)) s.duplicates++;
      else md5.add(image.md5Checksum);
    }
  }
  s.truncated = s.files + s.unsupported >= maxFiles;
  return s;
}
