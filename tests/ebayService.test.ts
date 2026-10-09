import { describe, expect, it, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EbayService } from '../server/ebay/ebayService.ts';
import { EbayListingRow } from '../server/ebay/types.ts';

describe('EbayService & CSV Generation', () => {
  let tmpDir: string;
  let service: EbayService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ebh-ebay-'));
    service = new EbayService(tmpDir);
  });

  it('generates titles strictly within eBay 80-character limit', () => {
    const longPattern = '{brand} {player} {set} Ultra Rare Holographic Refractor Gem Mint PSA 10 Candidate Superlative Edition';
    const title = service.generateTitle(longPattern, {
      brand: 'Topps Chrome 2024',
      player: 'Jackson Holliday',
      set: 'Refractor Rookie Auto',
    });

    expect(title.length).toBeLessThanOrEqual(80);
    expect(title).toContain('Topps Chrome');
  });

  it('validates CSV rows and catches missing mandatory fields', () => {
    const invalidRows: EbayListingRow[] = [
      {
        action: 'Add',
        category: '213',
        title: '', // Missing title!
        description: 'Nice card',
        conditionId: '3000',
        format: 'FixedPrice',
        buyItNowPrice: 25.0,
        quantity: 1,
        duration: 'GTC',
        location: 'US',
        shippingService: 'Standard',
        shippingCost: 1.0,
        dispatchTimeMax: 1,
        returnsAcceptedOption: 'ReturnsAccepted',
        customLabelSku: 'CARD-001',
        itemSpecifics: {},
      },
      {
        action: 'Add',
        category: '213',
        title: 'Valid Card Title',
        description: 'Nice card',
        conditionId: '3000',
        format: 'FixedPrice',
        buyItNowPrice: 0, // Missing price!
        quantity: 1,
        duration: 'GTC',
        location: 'US',
        shippingService: 'Standard',
        shippingCost: 1.0,
        dispatchTimeMax: 1,
        returnsAcceptedOption: 'ReturnsAccepted',
        customLabelSku: 'CARD-002',
        itemSpecifics: {},
      },
    ];

    const validation = service.validateCsvRows(invalidRows);
    expect(validation.valid).toBe(false);
    expect(validation.missingRequiredFields).toHaveLength(2);
    expect(validation.missingRequiredFields[0].field).toBe('*Title');
    expect(validation.missingRequiredFields[1].field).toBe('*BuyItNowPrice');
  });

  it('generates official File Exchange CSV with exact required headers and dynamic C: item specifics', () => {
    const validRows: EbayListingRow[] = [
      {
        action: 'Add',
        category: '213',
        title: '2023 Topps Shohei Ohtani #17 Gem Mint',
        description: '<p>Great condition.</p>',
        conditionId: '3000',
        format: 'FixedPrice',
        buyItNowPrice: 45.99,
        quantity: 1,
        duration: 'GTC',
        location: 'US',
        shippingService: 'USPSGroundAdvantage',
        shippingCost: 4.50,
        dispatchTimeMax: 1,
        returnsAcceptedOption: 'ReturnsAccepted',
        customLabelSku: 'SHO-17',
        picUrl: 'https://example.com/card.jpg',
        itemSpecifics: {
          'Player': 'Shohei Ohtani',
          'Grade': 'PSA 10',
          'Card Number': '17',
        },
      },
    ];

    const csv = service.generateFileExchangeCsv(validRows);
    expect(csv).toContain('*Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8)');
    expect(csv).toContain('*Title');
    expect(csv).toContain('*BuyItNowPrice');
    expect(csv).toContain('C:Player');
    expect(csv).toContain('C:Grade');
    expect(csv).toContain('C:Card Number');
    expect(csv).toContain('2023 Topps Shohei Ohtani #17 Gem Mint');
    expect(csv).toContain('45.99');
    expect(csv).toContain('SHO-17');
  });

  it('works independently of connected credentials (public status reported safely)', () => {
    const status = service.getPublicStatus();
    expect(status.isConfigured).toBe(false);
    expect(status.templatesCount).toBeGreaterThan(0);
  });
});
