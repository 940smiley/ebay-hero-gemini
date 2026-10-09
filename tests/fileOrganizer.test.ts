import { describe, expect, it, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FileOrganizer, SafePathError } from '../server/fileops/fileOrganizer.ts';
import { RenameTemplateConfig, DirectoryTemplateConfig } from '../server/fileops/types.ts';

describe('FileOrganizer Engine', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ebh-organizer-'));
  });

  const renameCfg: RenameTemplateConfig = {
    template: '{category}_{brand}_{model}_{sequence}',
    caseConvention: 'UPPER_SNAKE',
    collisionStrategy: 'append_number',
    preserveExtension: true,
    dateFormat: 'YYYYMMDD',
    numberPadding: 3,
  };

  const dirCfg: DirectoryTemplateConfig = {
    rootDirectory: '',
    pattern: '{category}/{subcategory}',
    createFolders: true,
  };

  it('renders templates with variable substitutions and case styling', () => {
    const rendered = FileOrganizer.renderFilename(
      '{year}_{sport}_{player}_{card_number}_{sequence}',
      {
        year: 2023,
        sport: 'Baseball',
        player: 'Shohei Ohtani',
        card_number: 'SO-1',
      },
      1,
      { ...renameCfg, caseConvention: 'UPPER_SNAKE' },
      '.jpg'
    );

    expect(rendered).toBe('2023_BASEBALL_SHOHEI_OHTANI_SO_1_001.jpg');
  });

  it('preserves Unicode characters and sanitizes illegal OS chars', () => {
    const rendered = FileOrganizer.renderFilename(
      '{title}',
      { title: 'Pokémon: Charizard (リザードン) / 1st Ed?' },
      1,
      { ...renameCfg, caseConvention: 'preserve' },
      '.png'
    );

    expect(rendered).toContain('Pokémon');
    expect(rendered).toContain('リザードン');
    expect(rendered).not.toContain(':');
    expect(rendered).not.toContain('?');
    expect(rendered).not.toContain('/');
    expect(rendered.endsWith('.png')).toBe(true);
  });

  it('detects collisions and resolves them with suffix numbering', () => {
    dirCfg.rootDirectory = tmpDir;
    const items = [
      {
        id: '1',
        originalPath: path.join(tmpDir, 'photo1.jpg'),
        originalFilename: 'photo1.jpg',
        vars: { category: 'Cards', brand: 'Topps', model: 'T1' },
      },
      {
        id: '2',
        originalPath: path.join(tmpDir, 'photo2.jpg'),
        originalFilename: 'photo2.jpg',
        vars: { category: 'Cards', brand: 'Topps', model: 'T1' },
      },
    ];

    const plan = FileOrganizer.generatePlan(
      items,
      { ...renameCfg, template: '{brand}_{model}' }, // identical names
      dirCfg
    );

    expect(plan.operations).toHaveLength(2);
    expect(plan.operations[0].proposedFilename).toBe('TOPPS_T1.jpg');
    expect(plan.operations[1].conflict).toBe(true);
    expect(plan.operations[1].proposedFilename).toBe('TOPPS_T1_002.jpg');
  });

  it('enforces directory security bounds and throws SafePathError if path escapes root', () => {
    dirCfg.rootDirectory = tmpDir;
    const malicious = [
      {
        id: 'evil',
        originalPath: path.join(tmpDir, 'test.jpg'),
        originalFilename: 'test.jpg',
        vars: { category: '../../etc', subcategory: 'secret' },
      },
    ];

    expect(() => {
      FileOrganizer.generatePlan(malicious, renameCfg, dirCfg);
    }).toThrow(SafePathError);
  });

  it('deterministically executes an approved manifest and executes rollback', async () => {
    dirCfg.rootDirectory = tmpDir;
    const src1 = path.join(tmpDir, 'input1.jpg');
    fs.writeFileSync(src1, 'dummy image content');

    const items = [
      {
        id: 'op1',
        originalPath: src1,
        originalFilename: 'input1.jpg',
        vars: { category: 'Stamps', brand: 'USPS', model: 'Airmail' },
      },
    ];

    const plan = FileOrganizer.generatePlan(items, renameCfg, dirCfg);
    const targetExpected = plan.operations[0].proposedFullPath;

    // Execute
    const executed = await FileOrganizer.executeManifest(plan, new Set(['op1']));
    expect(executed.executedCount).toBe(1);
    expect(fs.existsSync(src1)).toBe(false);
    expect(fs.existsSync(targetExpected)).toBe(true);
    expect(fs.readFileSync(targetExpected, 'utf8')).toBe('dummy image content');

    // Rollback
    const rolledBack = await FileOrganizer.rollbackManifest(executed);
    expect(rolledBack.operations[0].status).toBe('rolled_back');
    expect(fs.existsSync(src1)).toBe(true);
    expect(fs.existsSync(targetExpected)).toBe(false);
  });
});
