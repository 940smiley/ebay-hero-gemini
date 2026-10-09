import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../security/secretStore.ts';
import { PluginExtension } from './types.ts';
import { StamplicityPlugin } from './stamplicity/index.ts';
import { CardOpsPlugin } from './cardops/index.ts';

export class PluginRegistry {
  private plugins = new Map<string, PluginExtension>();
  private stateFilePath: string;
  private enabledState: Record<string, boolean> = {};

  constructor(dataDir: string = DATA_DIR) {
    this.stateFilePath = path.join(dataDir, 'plugin-state.json');
    fs.mkdirSync(dataDir, { recursive: true });
    this.loadState();

    // Register built-in specialized plugins
    this.register(StamplicityPlugin);
    this.register(CardOpsPlugin);
  }

  private loadState() {
    if (fs.existsSync(this.stateFilePath)) {
      try {
        this.enabledState = JSON.parse(fs.readFileSync(this.stateFilePath, 'utf8'));
      } catch (err) {
        console.warn('Could not read plugin state, using defaults:', err);
      }
    }
  }

  private saveState() {
    try {
      fs.writeFileSync(this.stateFilePath, JSON.stringify(this.enabledState, null, 2));
    } catch (err) {
      console.warn('Could not write plugin state:', err);
    }
  }

  register(plugin: PluginExtension) {
    this.plugins.set(plugin.manifest.id, plugin);
    if (this.enabledState[plugin.manifest.id] === undefined) {
      this.enabledState[plugin.manifest.id] = plugin.manifest.enabledByDefault;
      this.saveState();
    }
  }

  listPlugins(): Array<PluginExtension['manifest'] & { enabled: boolean; customFieldsCount: number }> {
    return Array.from(this.plugins.values()).map(p => ({
      ...p.manifest,
      enabled: this.isEnabled(p.manifest.id),
      customFieldsCount: p.customFields.length,
    }));
  }

  getPlugin(id: string): PluginExtension | undefined {
    return this.plugins.get(id);
  }

  isEnabled(id: string): boolean {
    return Boolean(this.enabledState[id]);
  }

  setEnabled(id: string, enabled: boolean): boolean {
    if (!this.plugins.has(id)) {
      throw new Error(`Plugin "${id}" not found.`);
    }
    this.enabledState[id] = enabled;
    this.saveState();
    return enabled;
  }

  /**
   * Returns merged custom fields across all enabled plugins.
   */
  getActiveCustomFields() {
    const fields: PluginExtension['customFields'] = [];
    for (const [id, plugin] of this.plugins.entries()) {
      if (this.isEnabled(id)) {
        fields.push(...plugin.customFields);
      }
    }
    return fields;
  }

  /**
   * Gathers active domain prompt instructions from all enabled plugins.
   */
  getActivePromptExtensions(): string {
    const lines: string[] = [];
    for (const [id, plugin] of this.plugins.entries()) {
      if (this.isEnabled(id) && plugin.analysisPromptExtension) {
        lines.push(`--- ${plugin.manifest.name.toUpperCase()} DOMAIN RULES ---\n${plugin.analysisPromptExtension}`);
      }
    }
    return lines.join('\n\n');
  }

  runDiagnostics(): Array<{ pluginId: string; name: string; status: 'ok' | 'warning' | 'error'; message: string }> {
    const results = [];
    for (const [id, p] of this.plugins.entries()) {
      const enabled = this.isEnabled(id);
      results.push({
        pluginId: id,
        name: p.manifest.name,
        status: 'ok' as const,
        message: enabled ? `Plugin active with ${p.customFields.length} custom metadata fields.` : 'Plugin currently disabled (data preserved).',
      });
    }
    return results;
  }
}
