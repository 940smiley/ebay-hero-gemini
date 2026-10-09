import { describe, expect, it, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PluginRegistry } from '../server/plugins/pluginRegistry.ts';

describe('Modular Plugin Architecture', () => {
  let tmpDir: string;
  let registry: PluginRegistry;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ebh-plugins-'));
    registry = new PluginRegistry(tmpDir);
  });

  it('initializes with Stamplicity and CardOps installed and enabled', () => {
    const list = registry.listPlugins();
    expect(list.length).toBeGreaterThanOrEqual(2);
    const stamplicity = list.find(p => p.id === 'stamplicity');
    const cardops = list.find(p => p.id === 'cardops');

    expect(stamplicity).toBeDefined();
    expect(stamplicity?.name).toBe('Stamplicity');
    expect(stamplicity?.enabled).toBe(true);
    expect(stamplicity?.customFieldsCount).toBeGreaterThan(5);

    expect(cardops).toBeDefined();
    expect(cardops?.name).toBe('CardOps');
    expect(cardops?.enabled).toBe(true);
  });

  it('can enable and disable a plugin without losing its configuration', () => {
    registry.setEnabled('stamplicity', false);
    expect(registry.isEnabled('stamplicity')).toBe(false);

    // Active custom fields should not include Stamplicity's country field
    const activeFields = registry.getActiveCustomFields();
    expect(activeFields.some(f => f.key === 'country')).toBe(false);
    expect(activeFields.some(f => f.key === 'playerOrCharacter')).toBe(true); // Cardops still active

    // Re-enable
    registry.setEnabled('stamplicity', true);
    expect(registry.isEnabled('stamplicity')).toBe(true);
    const restoredFields = registry.getActiveCustomFields();
    expect(restoredFields.some(f => f.key === 'country')).toBe(true);
  });

  it('gathers active prompt extensions dynamically for AI appraiser', () => {
    const prompt = registry.getActivePromptExtensions();
    expect(prompt).toContain('STAMPLICITY');
    expect(prompt).toContain('CARDOPS');

    registry.setEnabled('stamplicity', false);
    const singlePrompt = registry.getActivePromptExtensions();
    expect(singlePrompt).not.toContain('STAMPLICITY');
    expect(singlePrompt).toContain('CARDOPS');
  });

  it('runs diagnostics reporting healthy status for all modules', () => {
    const diag = registry.runDiagnostics();
    expect(diag).toHaveLength(2);
    expect(diag.every(d => d.status === 'ok')).toBe(true);
  });
});
