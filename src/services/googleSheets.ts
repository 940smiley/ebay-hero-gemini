import { ImageItem } from '../types/index.ts';

export interface SheetCreationResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  rowsCount: number;
}

export async function createOrUpdateInventorySheet(
  accessToken: string,
  items: ImageItem[],
  customTitle?: string
): Promise<SheetCreationResult> {
  const sheetTitle = customTitle || `eBay Hero Inventory & Listings (${new Date().toLocaleDateString()})`;

  // Mandatory user confirmation dialog before creating or modifying user's Google Sheets
  const confirmed = window.confirm(
    `Create a new Google Sheet "${sheetTitle}" in your Google Drive with ${items.length} collectibles inventory records?\n\nThis will write structured columns for eBay titles, condition grades, and market values.`
  );
  if (!confirmed) {
    throw new Error('Operation cancelled by user.');
  }

  // 1. Create the new Spreadsheet
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: sheetTitle,
      },
    }),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`Google Sheets creation failed (${createRes.status}): ${errorText}`);
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // 2. Prepare header row and item data rows
  const headers = [
    'Item ID',
    'Original Photo Filename',
    'Intelligent Filename (Gemini Vision)',
    'Target Sync Folder',
    'Category',
    'Subcategory',
    'Product / Subject Name',
    'Year / Era',
    'Condition Grade',
    'Grader (PSA/BGS/CGC/RAW)',
    'Cert Number',
    'Est Value Low ($)',
    'Est Value Med ($)',
    'Est Value High ($)',
    'eBay Title (80 Char Max)',
    'Buy It Now Price ($)',
    'Starting Bid ($)',
    'Shipping Logistics',
    'Status',
  ];

  const rows = items.map((it) => {
    const a = it.analysis;
    const e = it.ebayDraft;
    return [
      it.id,
      it.originalName,
      it.proposedName,
      it.proposedFolder,
      a?.category || 'Collectibles',
      a?.subcategory || 'General',
      a?.productName || it.proposedName,
      a?.yearOrEra || '',
      a?.estimatedCondition || 'Near Mint',
      a?.gradingDetails?.grader || 'RAW',
      a?.gradingDetails?.certNumber || 'N/A',
      a?.estimatedMarketValueUsd?.low || 0,
      a?.estimatedMarketValueUsd?.median || 0,
      a?.estimatedMarketValueUsd?.high || 0,
      e?.title || it.proposedName.slice(0, 80),
      e?.suggestedPriceBin || 0,
      e?.suggestedStartingBid || 0,
      e?.shippingPreset || 'USPS Ground Advantage',
      it.status.toUpperCase(),
    ];
  });

  const valuesPayload = [headers, ...rows];

  // 3. Write data to Sheet
  const appendRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: 'Sheet1!A1',
        majorDimension: 'ROWS',
        values: valuesPayload,
      }),
    }
  );

  if (!appendRes.ok) {
    const appendError = await appendRes.text();
    console.warn('Could not populate initial values in Sheet1:', appendError);
  }

  return {
    spreadsheetId,
    spreadsheetUrl,
    title: sheetTitle,
    rowsCount: items.length,
  };
}
