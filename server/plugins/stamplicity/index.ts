import { PluginExtension } from '../types.ts';

export const StamplicityPlugin: PluginExtension = {
  manifest: {
    id: 'stamplicity',
    name: 'Stamplicity',
    version: '1.2.0',
    description: 'Transform eBay Hero into a specialized philatelic inventory and stamp appraisal platform with Scott catalog references, perforation notes, and watermark tracking.',
    author: 'eBay Hero Philately Group',
    icon: 'Mail',
    category: 'philately',
    enabledByDefault: true,
  },
  customFields: [
    { key: 'country', label: 'Country / Issuing Authority', type: 'text', placeholder: 'United States, Great Britain, Germany' },
    { key: 'stampType', label: 'Stamp Type', type: 'select', options: ['Definitive', 'Commemorative', 'Airmail', 'Special Delivery', 'Revenue / Fiscal', 'Postage Due', 'Semi-Postal'] },
    { key: 'denomination', label: 'Face Value / Denomination', type: 'text', placeholder: '5c, 1d, 2.50 Fr' },
    { key: 'issueYear', label: 'Year of Issue', type: 'number', placeholder: '1938' },
    { key: 'catalogNumber', label: 'Catalog Number (Scott/SG/Michel)', type: 'text', placeholder: 'Scott #C13, SG #450' },
    { key: 'perforation', label: 'Perforation Gauge', type: 'text', placeholder: 'Perf 11 x 10.5, Imperforate' },
    { key: 'watermark', label: 'Watermark Notes', type: 'text', placeholder: 'Single-line USPS, Crown CA, None' },
    { key: 'gumCondition', label: 'Gum Condition', type: 'select', options: ['Mint Never Hinged (MNH)', 'Mint Lightly Hinged (MLH)', 'Mint Hinged (MH)', 'Used / Cancelled', 'No Gum / Regummed'] },
    { key: 'centeringGrade', label: 'Philatelic Centering Grade', type: 'select', options: ['Superb (98)', 'XF-Superb (95)', 'Extra Fine (90)', 'Very Fine (80)', 'Fine (70)', 'Average (50)'] },
    { key: 'albumLocation', label: 'Album / Stockbook Location', type: 'text', placeholder: 'Stockbook A, Page 12' },
  ],
  analysisPromptExtension: `STAMPLICITY PHILATELIC FOCUS:
If this image is a postage or revenue stamp:
1. Identify issuing country and visible denomination/currency.
2. Note whether a cancellation mark (CDS, wavy line, slogan) is visible or if the stamp appears unused.
3. Assess centering margins (equal borders vs off-center).
4. Extract visible issue year or commemorative topic (e.g. Olympics, Washington Bicentennial, Graf Zeppelin).
5. Suggest Scott or international catalog numbering conventions if recognizable, but if uncertain flag as Unknown. Never invent catalog numbers.`,
  filenameTemplate: '{country}_{stampType}_{denomination}_{catalogNumber}_{sequence}',
  directoryTemplate: 'Stamps/{country}/{stampType}',
  listingTitlePattern: '{country} {issueYear} {denomination} {subject} #{catalogNumber} {gumCondition}',
  defaultEbayCategoryId: '260', // eBay Stamps
  defaultItemSpecifics: {
    'Country/Region of Manufacture': '{country}',
    'Year of Issue': '{issueYear}',
    'Grade': '{centeringGrade}',
    'Certification': 'Uncertified',
    'Quality': '{gumCondition}',
  },
  supportedCategories: ['Stamps', 'Philately', 'Postage Stamps', 'First Day Covers'],
};
