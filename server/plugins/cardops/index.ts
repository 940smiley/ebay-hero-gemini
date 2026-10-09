import { PluginExtension } from '../types.ts';

export const CardOpsPlugin: PluginExtension = {
  manifest: {
    id: 'cardops',
    name: 'CardOps',
    version: '2.1.0',
    description: 'Transform eBay Hero into a specialized sports card and TCG collection management system with slab cert tracking, parallel variation detection, and raw vs graded card workflows.',
    author: 'eBay Hero CardOps Team',
    icon: 'Trophy',
    category: 'trading_cards',
    enabledByDefault: true,
  },
  customFields: [
    { key: 'sportOrGame', label: 'Sport or Game', type: 'select', options: ['Baseball', 'Basketball', 'Football', 'Hockey', 'Soccer', 'Pokemon', 'Magic: The Gathering', 'Yu-Gi-Oh!', 'Other TCG'] },
    { key: 'playerOrCharacter', label: 'Player or Character', type: 'text', placeholder: 'Shohei Ohtani, Michael Jordan, Charizard' },
    { key: 'cardYear', label: 'Card Year / Release', type: 'number', placeholder: '2023' },
    { key: 'cardSet', label: 'Card Set / Product Line', type: 'text', placeholder: 'Topps Chrome, Panini Prizm, Base Set' },
    { key: 'cardNumber', label: 'Card Number', type: 'text', placeholder: '#17, #4/102' },
    { key: 'parallelOrVariation', label: 'Parallel / Variation / Insert', type: 'text', placeholder: 'Refractor, Silver Prizm, 1st Edition, Holo' },
    { key: 'printRun', label: 'Serial Number / Print Run', type: 'text', placeholder: '15/99, 1/1, Unnumbered' },
    { key: 'isGraded', label: 'Graded Slab vs Raw', type: 'select', options: ['Graded Slab', 'Raw / Ungraded', 'Authentic Altered', 'Graded Authentic Only'] },
    { key: 'grader', label: 'Grading Company', type: 'select', options: ['PSA', 'BGS', 'CGC', 'SGC', 'TAG', 'Raw / None'] },
    { key: 'gradeNumeric', label: 'Grade Score', type: 'text', placeholder: '10, 9.5, 9, 8.5' },
    { key: 'certNumber', label: 'Certification / Serial Number', type: 'text', placeholder: '78491024' },
    { key: 'boxOrBinderLocation', label: 'Storage Box / Binder Slot', type: 'text', placeholder: 'Box 1 - Graded Slabs Row 2' },
  ],
  analysisPromptExtension: `CARDOPS TRADING CARD & SLAB FOCUS:
1. Determine whether the card is Raw or encapsulated in a graded slab (PSA, BGS, CGC, SGC).
2. If graded in a slab: read the label company, grade number, subgrades, and verification barcode/cert number.
3. If raw: inspect 60/40 or 50/50 centering, corner sharpness, and edge silvering.
4. Distinguish base cards from parallels (refractors, prism, cracked ice, foil, holographic).
5. Extract player/character name, team, set name, year, and card number.
*Note: eBay's proprietary scan-a-card feature is restricted to native eBay mobile apps. CardOps provides this neural appraiser model as a modular, open replacement.*`,
  filenameTemplate: '{sportOrGame}_{playerOrCharacter}_{cardSet}_{cardNumber}_{grader}_{gradeNumeric}_{sequence}',
  directoryTemplate: 'Cards/{sportOrGame}/{cardSet}',
  listingTitlePattern: '{cardYear} {cardSet} {playerOrCharacter} #{cardNumber} {parallelOrVariation} {grader} {gradeNumeric}',
  defaultEbayCategoryId: '213', // eBay Trading Cards
  defaultItemSpecifics: {
    'Sport': '{sportOrGame}',
    'Player/Athlete': '{playerOrCharacter}',
    'Season': '{cardYear}',
    'Manufacturer': '{cardSet}',
    'Card Number': '{cardNumber}',
    'Parallel/Variety': '{parallelOrVariation}',
    'Professional Grader': '{grader}',
    'Grade': '{gradeNumeric}',
  },
  supportedCategories: ['Trading Cards', 'Sports Cards', 'Pokemon', 'Magic The Gathering', 'Collectible Cards'],
};
