/**
 * Scope-based selection model.
 *
 * A selection is the union of:
 *   - scopes:   "everything directly in folder X" or "everything under folder X (recursive)"
 *   - included: individually picked item IDs
 * minus:
 *   - excluded: individually de-selected IDs (each remembers its folder path so a later,
 *               wider scope can reclaim it).
 *
 * Nothing here depends on which thumbnails are rendered or loaded, so selecting an entire
 * 50,000-file tree is a single small object. The *count* of a scope is resolved by the
 * provider (server enumerates with pagination), never by counting rendered rows.
 *
 * Pure & dependency-free so it can be unit-tested and shared by browser and server.
 */

export type SelectionSource = 'google_drive' | 'google_photos' | 'local';

export interface SelectionScope {
  /** Stable key: `${source}:${folderId}:${recursive ? 'r' : 'd'}` */
  key: string;
  source: SelectionSource;
  folderId: string;
  driveId?: string;
  recursive: boolean;
  /** Real name returned by the provider, for display only. */
  label: string;
}

export interface SelectionState {
  scopes: SelectionScope[];
  included: Record<string, true>;
  /** id -> ancestor folder IDs (root..parent) at the time of exclusion */
  excluded: Record<string, string[]>;
}

export interface SerializedSelection {
  scopes: SelectionScope[];
  included: string[];
  excluded: string[];
}

export const emptySelection = (): SelectionState => ({ scopes: [], included: {}, excluded: {} });

export function makeScope(input: Omit<SelectionScope, 'key'>): SelectionScope {
  return { ...input, key: `${input.source}:${input.folderId}:${input.recursive ? 'r' : 'd'}` };
}

/**
 * Does `scope` cover an item whose ancestor folder IDs (root first, direct parent last) are `path`?
 */
export function scopeCovers(scope: SelectionScope, path: readonly string[]): boolean {
  if (path.length === 0) return false;
  return scope.recursive ? path.includes(scope.folderId) : path[path.length - 1] === scope.folderId;
}

export function isSelected(state: SelectionState, id: string, path: readonly string[]): boolean {
  if (id in state.excluded) return false;
  if (id in state.included) return true;
  return state.scopes.some((s) => scopeCovers(s, path));
}

function coveredByScope(state: SelectionState, path: readonly string[]) {
  return state.scopes.some((s) => scopeCovers(s, path));
}

/** Select specific items. Clears any exclusion for them. */
export function selectItems(state: SelectionState, items: ReadonlyArray<{ id: string; path: readonly string[] }>): SelectionState {
  const included = { ...state.included };
  const excluded = { ...state.excluded };
  for (const it of items) {
    delete excluded[it.id];
    if (!coveredByScope(state, it.path)) included[it.id] = true;
    else delete included[it.id];
  }
  return { ...state, included, excluded };
}

/** Deselect specific items; if a scope covers them they become explicit exclusions. */
export function deselectItems(state: SelectionState, items: ReadonlyArray<{ id: string; path: readonly string[] }>): SelectionState {
  const included = { ...state.included };
  const excluded = { ...state.excluded };
  for (const it of items) {
    delete included[it.id];
    if (coveredByScope(state, it.path)) excluded[it.id] = [...it.path];
  }
  return { ...state, included, excluded };
}

export function toggleItem(state: SelectionState, item: { id: string; path: readonly string[] }): SelectionState {
  return isSelected(state, item.id, item.path) ? deselectItems(state, [item]) : selectItems(state, [item]);
}

/**
 * Add a folder scope ("select all in this folder [and subfolders]").
 * Individually included items now covered by the scope are folded into it, and exclusions it covers are cleared
 * (the user asked for *all* files, so earlier deselections inside this scope are reset).
 */
export function addScope(state: SelectionState, scope: SelectionScope): SelectionState {
  if (state.scopes.some((s) => s.key === scope.key)) return state;
  const next: SelectionState = { ...state, scopes: [...state.scopes, scope], included: { ...state.included }, excluded: { ...state.excluded } };
  for (const [id, path] of Object.entries(state.excluded)) {
    if (scopeCovers(scope, path)) delete next.excluded[id];
  }
  return next;
}

export function removeScope(state: SelectionState, key: string): SelectionState {
  return { ...state, scopes: state.scopes.filter((s) => s.key !== key) };
}

export function clearSelection(): SelectionState {
  return emptySelection();
}

export function serialize(state: SelectionState): SerializedSelection {
  return { scopes: state.scopes, included: Object.keys(state.included), excluded: Object.keys(state.excluded) };
}

export function hasAnySelection(state: SelectionState): boolean {
  return state.scopes.length > 0 || Object.keys(state.included).length > 0;
}

/** Counts that are knowable without contacting the provider. */
export function describe(state: SelectionState) {
  return {
    scopeCount: state.scopes.length,
    recursiveScopeCount: state.scopes.filter((s) => s.recursive).length,
    individualCount: Object.keys(state.included).length,
    exclusionCount: Object.keys(state.excluded).length,
  };
}
