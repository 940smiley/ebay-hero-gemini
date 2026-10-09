import { describe, expect, it } from 'vitest';
import {
  addScope, clearSelection, deselectItems, emptySelection, isSelected, makeScope, removeScope,
  scopeCovers, selectItems, serialize, toggleItem,
} from '../src/lib/selection.ts';

const folderA = makeScope({ source: 'google_drive', folderId: 'A', recursive: false, label: 'Images' });
const treeA = makeScope({ source: 'google_drive', folderId: 'A', recursive: true, label: 'Images' });

describe('selection model', () => {
  it('selects one image and multiple images', () => {
    let s = emptySelection();
    s = selectItems(s, [{ id: 'f1', path: ['A'] }]);
    expect(isSelected(s, 'f1', ['A'])).toBe(true);
    expect(isSelected(s, 'f2', ['A'])).toBe(false);
    s = selectItems(s, [{ id: 'f2', path: ['A'] }, { id: 'f3', path: ['A', 'B'] }]);
    expect(serialize(s).included.sort()).toEqual(['f1', 'f2', 'f3']);
  });

  it('directory scope covers only direct children; recursive scope covers all descendants', () => {
    expect(scopeCovers(folderA, ['A'])).toBe(true);
    expect(scopeCovers(folderA, ['A', 'B'])).toBe(false);
    expect(scopeCovers(treeA, ['A', 'B', 'C'])).toBe(true);
    expect(scopeCovers(treeA, ['X'])).toBe(false);
    expect(scopeCovers(treeA, [])).toBe(false);
  });

  it('select-all is query-sized: covers items that were never loaded or rendered', () => {
    const s = addScope(emptySelection(), treeA);
    // 100k hypothetical files, none present in state
    for (const id of ['never-seen-1', 'never-seen-99999']) {
      expect(isSelected(s, id, ['A', 'Sports Cards', 'Baseball'])).toBe(true);
    }
    expect(Object.keys(s.included)).toHaveLength(0);
    expect(JSON.stringify(serialize(s)).length).toBeLessThan(500);
  });

  it('supports individual deselection after selecting a whole directory (exclusions)', () => {
    let s = addScope(emptySelection(), treeA);
    s = deselectItems(s, [{ id: 'bad', path: ['A', 'B'] }]);
    expect(isSelected(s, 'bad', ['A', 'B'])).toBe(false);
    expect(isSelected(s, 'good', ['A', 'B'])).toBe(true);
    expect(serialize(s).excluded).toEqual(['bad']);
    // re-selecting it removes the exclusion
    s = selectItems(s, [{ id: 'bad', path: ['A', 'B'] }]);
    expect(isSelected(s, 'bad', ['A', 'B'])).toBe(true);
    expect(serialize(s).excluded).toEqual([]);
  });

  it('deselecting an individually-included file removes it entirely', () => {
    let s = selectItems(emptySelection(), [{ id: 'x', path: ['Z'] }]);
    s = deselectItems(s, [{ id: 'x', path: ['Z'] }]);
    expect(isSelected(s, 'x', ['Z'])).toBe(false);
    expect(Object.keys(s.excluded)).toHaveLength(0); // no scope covers it, so no exclusion needed
  });

  it('adding a wider scope reclaims earlier exclusions it covers, but not unrelated ones', () => {
    let s = addScope(emptySelection(), folderA);
    s = deselectItems(s, [{ id: 'direct', path: ['A'] }]);
    s = selectItems(s, [{ id: 'other', path: ['Q'] }]);
    s = deselectItems(s, [{ id: 'other', path: ['Q'] }]);
    s = addScope(s, makeScope({ source: 'google_drive', folderId: 'Q', recursive: true, label: 'Q' }));
    s = deselectItems(s, [{ id: 'q-excl', path: ['Q', 'sub'] }]);
    s = addScope(s, treeA);
    expect(isSelected(s, 'direct', ['A'])).toBe(true); // reclaimed by the recursive scope
    expect(isSelected(s, 'q-excl', ['Q', 'sub'])).toBe(false); // untouched
  });

  it('adding the same scope twice is idempotent, and scopes can be removed', () => {
    let s = addScope(addScope(emptySelection(), treeA), treeA);
    expect(s.scopes).toHaveLength(1);
    s = removeScope(s, treeA.key);
    expect(isSelected(s, 'f', ['A'])).toBe(false);
  });

  it('toggle and clear', () => {
    let s = toggleItem(emptySelection(), { id: 'a', path: ['A'] });
    expect(isSelected(s, 'a', ['A'])).toBe(true);
    s = toggleItem(s, { id: 'a', path: ['A'] });
    expect(isSelected(s, 'a', ['A'])).toBe(false);
    s = addScope(s, treeA);
    expect(clearSelection().scopes).toHaveLength(0);
  });

  it('selection persists across navigation because it is keyed by IDs, not rendered rows', () => {
    let s = selectItems(emptySelection(), [{ id: 'p1', path: ['A'] }]);
    // "navigate" to another folder and back: state object is unchanged
    const after = selectItems(s, [{ id: 'p2', path: ['B'] }]);
    expect(isSelected(after, 'p1', ['A'])).toBe(true);
    expect(isSelected(after, 'p2', ['B'])).toBe(true);
  });
});
