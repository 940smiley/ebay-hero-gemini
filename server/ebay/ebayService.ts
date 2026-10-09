import path from 'node:path';
import { EncryptedJsonFile, DATA_DIR, getEncryptionKey } from '../security/secretStore.ts';
import { 
  EbayCredentials, 
  EbayListingTemplate, 
  EbayListingRow, 
  CsvValidationResult 
} from './types.ts';

const DEFAULT_TEMPLATES: EbayListingTemplate[] = [
  {
    id: 'trading-cards-standard',
    name: 'Trading Cards & Slabs (PSA/Raw)',
    category: 'trading_cards',
    titlePattern: '{year} {brand} {subject} #{model} {condition}',
    defaultCategoryId: '213', // Sports Mem, Cards & Fan Shop > Cards
    defaultCategoryName: 'Trading Cards',
    defaultConditionId: '3000', // Used / Like New
    format: 'FixedPrice',
    defaultDurationDays: 30,
    shippingPreset: 'USPS Standard Envelope for Eligible Cards',
    dispatchTimeMax: 1,
    returnsAccepted: true,
    returnPeriodDays: 30,
    defaultDescriptionHtml: `<h3>{title}</h3>
<p>Authentic collectible card, carefully inspected and stored in a penny sleeve & top loader in a smoke-free environment.</p>
<h4>Item Details:</h4>
<ul>
  <li><strong>Brand / Set:</strong> {brand}</li>
  <li><strong>Player / Subject:</strong> {subject}</li>
  <li><strong>Card Number:</strong> {model}</li>
  <li><strong>Year:</strong> {year}</li>
  <li><strong>Condition:</strong> {condition}</li>
</ul>
<p><em>Ships securely with rigid cardboard reinforcement and bubble wrap protection.</em></p>`,
    itemSpecificRules: {
      'Card Name': '{subject}',
      'Manufacturer': '{brand}',
      'Set': '{subcategory}',
      'Card Number': '{model}',
      'Season': '{year}',
    },
  },
  {
    id: 'stamps-standard',
    name: 'Vintage & Commemorative Stamps',
    category: 'stamps',
    titlePattern: '{country} Vintage Stamp {year} {subject} #{catalog_number}',
    defaultCategoryId: '260', // Stamps
    defaultCategoryName: 'Stamps',
    defaultConditionId: '3000',
    format: 'FixedPrice',
    defaultDurationDays: 30,
    shippingPreset: 'USPS First Class Envelope with Rigid Glassine',
    dispatchTimeMax: 1,
    returnsAccepted: true,
    returnPeriodDays: 30,
    defaultDescriptionHtml: `<h3>{title}</h3>
<p>Vintage postage stamp for philatelic collections. Stored in archival glassine protector.</p>
<h4>Philatelic Specifications:</h4>
<ul>
  <li><strong>Country / Region:</strong> {country}</li>
  <li><strong>Issue Year:</strong> {year}</li>
  <li><strong>Denomination:</strong> {denomination}</li>
  <li><strong>Scott / Catalog Number:</strong> {catalog_number}</li>
  <li><strong>Condition / Hinge:</strong> {condition}</li>
</ul>`,
    itemSpecificRules: {
      'Country/Region of Manufacture': '{country}',
      'Year of Issue': '{year}',
      'Topic': '{subject}',
      'Grade': '{condition}',
    },
  },
  {
    id: 'general-collectibles',
    name: 'General Collectibles & Memorabilia',
    category: 'collectibles',
    titlePattern: '{year} Vintage {brand} {subject} {model}',
    defaultCategoryId: '1', // Collectibles
    defaultCategoryName: 'Collectibles',
    defaultConditionId: '3000',
    format: 'FixedPrice',
    defaultDurationDays: 30,
    shippingPreset: 'USPS Ground Advantage with Tracking',
    dispatchTimeMax: 1,
    returnsAccepted: true,
    returnPeriodDays: 30,
    defaultDescriptionHtml: `<h3>{title}</h3>
<p>Genuine vintage collectible item. Please examine high-resolution photos for exact cosmetic condition.</p>
<ul>
  <li><strong>Item:</strong> {subject}</li>
  <li><strong>Maker:</strong> {brand}</li>
  <li><strong>Era / Year:</strong> {year}</li>
  <li><strong>Condition:</strong> {condition}</li>
</ul>`,
    itemSpecificRules: {
      'Brand': '{brand}',
      'Type': '{category}',
    },
  },
];

export class EbayService {
  private store: EncryptedJsonFile<{ credentials?: EbayCredentials; templates: EbayListingTemplate[] }>;

  constructor(dataDir: string = DATA_DIR) {
    const credPath = path.join(dataDir, 'ebay-config.enc.json');
    this.store = new EncryptedJsonFile(
      credPath,
      () => ({ templates: DEFAULT_TEMPLATES }),
      getEncryptionKey(dataDir)
    );
  }

  getPublicStatus() {
    const data = this.store.read();
    const creds = data.credentials;

    return {
      isConfigured: Boolean(creds?.clientId && creds?.clientSecret),
      environment: creds?.environment || 'sandbox',
      clientIdConfigured: Boolean(creds?.clientId),
      hasDevId: Boolean(creds?.devId),
      hasRuName: Boolean(creds?.ruName),
      hasUserOAuth: Boolean(creds?.accessToken),
      tokenExpiresIn: creds?.tokenExpiresAt ? Math.round((creds.tokenExpiresAt - Date.now()) / 1000) : null,
      lastConnectedAt: creds?.lastConnectedAt || null,
      lastValidatedAt: creds?.lastValidatedAt || null,
      templatesCount: data.templates.length,
    };
  }

  saveCredentials(creds: {
    clientId: string;
    clientSecret: string;
    environment: 'sandbox' | 'production';
    devId?: string;
    ruName?: string;
  }) {
    const data = this.store.read();
    data.credentials = {
      ...(data.credentials || {}),
      clientId: creds.clientId.trim(),
      clientSecret: creds.clientSecret.trim(),
      environment: creds.environment,
      devId: creds.devId?.trim(),
      ruName: creds.ruName?.trim(),
      lastValidatedAt: new Date().toISOString(),
    };
    this.store.write(data);
    return this.getPublicStatus();
  }

  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    const data = this.store.read();
    const creds = data.credentials;

    if (!creds?.clientId || !creds?.clientSecret) {
      return {
        success: false,
        message: 'eBay Client ID and Client Secret are not configured.',
      };
    }

    const host = creds.environment === 'sandbox'
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.ebay.com';

    try {
      // Test Application Token generation via eBay OAuth endpoint
      const authHeader = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
      const response = await fetch(`${host}/identity/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${authHeader}`,
        },
        body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
      });

      if (response.ok) {
        const tokenData = await response.json();
        creds.lastConnectedAt = new Date().toISOString();
        this.store.write(data);

        return {
          success: true,
          message: `Successfully connected to eBay ${creds.environment.toUpperCase()} endpoint! Application token acquired.`,
          details: {
            environment: creds.environment,
            expiresIn: tokenData.expires_in,
          },
        };
      } else {
        const errText = await response.text();
        return {
          success: false,
          message: `eBay returned HTTP ${response.status}: ${errText}`,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Network error connecting to eBay: ${err.message}`,
      };
    }
  }

  getTemplates(): EbayListingTemplate[] {
    return this.store.read().templates;
  }

  saveTemplate(template: EbayListingTemplate): EbayListingTemplate {
    const data = this.store.read();
    const idx = data.templates.findIndex(t => t.id === template.id);
    if (idx >= 0) {
      data.templates[idx] = template;
    } else {
      data.templates.push(template);
    }
    this.store.write(data);
    return template;
  }

  deleteTemplate(id: string) {
    const data = this.store.read();
    data.templates = data.templates.filter(t => t.id !== id);
    this.store.write(data);
  }

  /**
   * Generates a listing draft title adhering to eBay's strict 80-character limit.
   */
  generateTitle(pattern: string, vars: Record<string, string | undefined>): string {
    let title = pattern;
    for (const [k, v] of Object.entries(vars)) {
      title = title.replace(new RegExp(`\\{${k}\\}`, 'gi'), v || '');
    }
    title = title.replace(/\{[a-z0-9_-]+\}/gi, '').replace(/\s+/g, ' ').trim();
    if (title.length > 80) {
      title = title.slice(0, 80).trim();
    }
    return title;
  }

  /**
   * Pre-export validation for eBay File Exchange CSV rows.
   */
  validateCsvRows(rows: EbayListingRow[]): CsvValidationResult {
    const missing: CsvValidationResult['missingRequiredFields'] = [];
    const warnings: CsvValidationResult['warnings'] = [];

    rows.forEach((row, idx) => {
      const rowIndex = idx + 1;
      const sku = row.customLabelSku || `Row-${rowIndex}`;

      if (!row.title || !row.title.trim()) {
        missing.push({ rowIndex, sku, field: '*Title', message: 'Title is mandatory' });
      } else if (row.title.length > 80) {
        warnings.push({ rowIndex, sku, field: '*Title', message: `Title exceeds 80 characters (${row.title.length})` });
      }

      if (!row.category) {
        missing.push({ rowIndex, sku, field: '*Category', message: 'Category ID is mandatory' });
      }

      if (!row.description) {
        missing.push({ rowIndex, sku, field: '*Description', message: 'Description is mandatory' });
      }

      if (!row.format) {
        missing.push({ rowIndex, sku, field: '*Format', message: 'Format (FixedPrice or Auction) is mandatory' });
      }

      if (row.format === 'FixedPrice' && (!row.buyItNowPrice || row.buyItNowPrice <= 0)) {
        missing.push({ rowIndex, sku, field: '*BuyItNowPrice', message: 'Buy It Now price required for FixedPrice format' });
      }

      if (row.format === 'Auction' && (!row.startPrice || row.startPrice <= 0)) {
        missing.push({ rowIndex, sku, field: '*StartPrice', message: 'Start price required for Auction format' });
      }

      if (!row.quantity || row.quantity < 1) {
        missing.push({ rowIndex, sku, field: '*Quantity', message: 'Quantity must be >= 1' });
      }
    });

    return {
      valid: missing.length === 0,
      totalRows: rows.length,
      missingRequiredFields: missing,
      warnings,
    };
  }

  /**
   * Generates official eBay File Exchange compliant CSV text.
   * Standard header: Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8)
   */
  generateFileExchangeCsv(rows: EbayListingRow[]): string {
    const staticHeaders = [
      '*Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8)',
      'CustomLabel',
      '*Category',
      '*Title',
      '*Description',
      '*ConditionID',
      '*Format',
      '*StartPrice',
      '*BuyItNowPrice',
      '*Quantity',
      '*Duration',
      'ImmediatePayRequired',
      '*Location',
      'ShippingType',
      'ShippingService-1:Option',
      'ShippingService-1:Cost',
      '*DispatchTimeMax',
      '*ReturnsAcceptedOption',
      'PicURL',
    ];

    // Collect all dynamic item specifics headers (prefixed with C:)
    const specificKeysSet = new Set<string>();
    rows.forEach(r => {
      Object.keys(r.itemSpecifics || {}).forEach(k => specificKeysSet.add(k));
    });
    const specificKeys = Array.from(specificKeysSet).sort();
    const dynamicHeaders = specificKeys.map(k => `C:${k}`);

    const allHeaders = [...staticHeaders, ...dynamicHeaders];

    const escapeCsv = (val: any) => {
      if (val === undefined || val === null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines: string[] = [];
    lines.push(allHeaders.map(escapeCsv).join(','));

    for (const r of rows) {
      const rowValues = [
        r.action || 'Add',
        r.customLabelSku || '',
        r.category || '',
        r.title || '',
        r.description || '',
        r.conditionId || '3000',
        r.format || 'FixedPrice',
        r.startPrice !== undefined ? r.startPrice.toFixed(2) : '',
        r.buyItNowPrice !== undefined ? r.buyItNowPrice.toFixed(2) : '',
        String(r.quantity || 1),
        r.duration || 'GTC',
        '0',
        r.location || 'United States',
        'Flat',
        r.shippingService || 'USPSGroundAdvantage',
        r.shippingCost !== undefined ? r.shippingCost.toFixed(2) : '0.00',
        String(r.dispatchTimeMax || 1),
        r.returnsAcceptedOption || 'ReturnsAccepted',
        r.picUrl || '',
      ];

      for (const k of specificKeys) {
        rowValues.push(r.itemSpecifics?.[k] || '');
      }

      lines.push(rowValues.map(escapeCsv).join(','));
    }

    return lines.join('\r\n');
  }
}
