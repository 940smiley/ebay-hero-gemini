/**
 * eBay Integration, Listing Templates, and CSV Types.
 */

export interface EbayCredentials {
  clientId: string;
  clientSecret: string;
  environment: 'sandbox' | 'production';
  devId?: string;
  ruName?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  lastConnectedAt?: string;
  lastValidatedAt?: string;
}

export interface EbayListingTemplate {
  id: string;
  name: string;
  category: 'collectibles' | 'trading_cards' | 'stamps' | 'coins' | 'electronics' | 'custom';
  titlePattern: string; // e.g. "{year} {brand} {player} #{number} {condition}"
  defaultCategoryId: string;
  defaultCategoryName: string;
  defaultConditionId: string;
  format: 'FixedPrice' | 'Auction';
  defaultDurationDays: number;
  shippingPreset: string;
  dispatchTimeMax: number;
  returnsAccepted: boolean;
  returnPeriodDays: number;
  paymentPolicy?: string;
  defaultDescriptionHtml: string;
  itemSpecificRules: Record<string, string>; // specific key -> value or template token
}

export interface EbayListingRow {
  action: 'Add' | 'Revise' | 'End' | 'VerifyAdd';
  category: string;
  title: string;
  description: string;
  conditionId: string;
  format: 'FixedPrice' | 'Auction';
  startPrice?: number;
  buyItNowPrice?: number;
  quantity: number;
  duration: string;
  location: string;
  shippingService: string;
  shippingCost: number;
  dispatchTimeMax: number;
  returnsAcceptedOption: 'ReturnsAccepted' | 'ReturnsNotAccepted';
  customLabelSku: string;
  picUrl?: string;
  itemSpecifics: Record<string, string>;
}

export interface CsvValidationResult {
  valid: boolean;
  totalRows: number;
  missingRequiredFields: Array<{
    rowIndex: number;
    sku: string;
    field: string;
    message: string;
  }>;
  warnings: Array<{
    rowIndex: number;
    sku: string;
    field: string;
    message: string;
  }>;
}
