/**
 * Formal Modular Plugin System Interfaces.
 */

export interface PluginManifest {
  id: string; // e.g. "stamplicity", "cardops"
  name: string;
  version: string;
  description: string;
  author: string;
  icon: string;
  category: 'collectibles' | 'trading_cards' | 'philately' | 'numismatics' | 'general';
  dependencies?: string[];
  enabledByDefault: boolean;
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
