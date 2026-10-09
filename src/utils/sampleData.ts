import { ImageItem } from '../types/index.ts';

// Helper to generate SVG Data URI placeholder illustrations for collectibles
function createCollectibleSvg(title: string, subtitle: string, badge: string, bgGradient: [string, string], iconType: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgGradient[0]}"/>
        <stop offset="100%" stop-color="${bgGradient[1]}"/>
      </linearGradient>
      <linearGradient id="foil" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.2)"/>
        <stop offset="50%" stop-color="rgba(255,255,255,0.0)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0.25)"/>
      </linearGradient>
    </defs>
    <rect width="600" height="800" rx="28" fill="url(#bg)"/>
    <rect x="20" y="20" width="560" height="760" rx="20" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
    
    <!-- Slab header / Brand band -->
    <rect x="40" y="40" width="520" height="90" rx="12" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.15)"/>
    <text x="60" y="80" font-family="system-ui, sans-serif" font-weight="800" font-size="24" fill="#ffffff">${title.slice(0, 32)}</text>
    <text x="60" y="110" font-family="system-ui, sans-serif" font-weight="600" font-size="16" fill="#94a3b8">${subtitle}</text>
    
    <!-- Grade badge -->
    <rect x="440" y="55" width="100" height="60" rx="8" fill="#e11d48"/>
    <text x="490" y="94" font-family="system-ui, sans-serif" font-weight="900" font-size="24" fill="#ffffff" text-anchor="middle">${badge}</text>

    <!-- Card Inner Illustration Frame -->
    <rect x="50" y="160" width="500" height="500" rx="16" fill="rgba(15,23,42,0.6)" stroke="rgba(255,255,255,0.1)"/>
    <circle cx="300" cy="380" r="140" fill="rgba(255,255,255,0.05)" />
    
    <text x="300" y="370" font-family="system-ui, sans-serif" font-weight="900" font-size="44" fill="#f8fafc" text-anchor="middle">${iconType}</text>
    <text x="300" y="420" font-family="system-ui, sans-serif" font-weight="600" font-size="18" fill="#38bdf8" text-anchor="middle">AUTHENTIC INSPECTED ITEM</text>
    <text x="300" y="450" font-family="system-ui, sans-serif" font-weight="500" font-size="14" fill="#64748b" text-anchor="middle">CERT #84920491 • GEMINI VISION VERIFIED</text>
    
    <!-- Holographic shimmer overlay -->
    <rect x="50" y="160" width="500" height="500" rx="16" fill="url(#foil)"/>

    <!-- Bottom barcode & specifics -->
    <rect x="60" y="690" width="480" height="50" rx="8" fill="rgba(0,0,0,0.5)"/>
    <text x="80" y="722" font-family="monospace" font-size="15" fill="#a7f3d0">ITEM SPECIFICS ID: EBAY-HERO-VAULT-${Math.abs(title.length * 918)}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const INITIAL_SAMPLE_ITEMS: ImageItem[] = [
  {
    id: 'item-001',
    originalName: 'IMG_20261008_142319_raw.jpg',
    originalPath: 'C:/Users/Seller/My Drive/Incoming/IMG_20261008_142319_raw.jpg',
    fileSize: 4210900,
    mimeType: 'image/jpeg',
    previewUrl: createCollectibleSvg('POKEMON CHARIZARD', '1999 Base Set 4/102 Holo Rare', 'PSA 9', ['#7f1d1d', '#b91c1c'], '🔥 CHARIZARD'),
    proposedName: '1999_POKEMON_BASE_SET_CHARIZARD_4-102_HOLO_PSA9_001.jpg',
    proposedFolder: 'Inventory/Trading Cards/Pokemon/Base Set',
    status: 'pending',
    confidence: 98,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    analysis: {
      objectType: 'Trading Card Slab',
      category: 'Trading Cards',
      subcategory: 'Pokemon TCG',
      brandOrManufacturer: 'Wizards of the Coast / Nintendo',
      productName: 'Charizard Base Set Holo Rare',
      modelOrCardNumber: '4/102',
      yearOrEra: '1999',
      conditionClues: [
        'Holographic foil pattern clean with zero visible spiderweb micro-scratches',
        'Centering 52/48 front, 55/45 back within PSA 9 mint parameters',
        'Corner radius crisp, minor silvering speck on upper left rear edge',
      ],
      estimatedCondition: 'Mint / PSA 9',
      gradingDetails: {
        grader: 'PSA',
        gradeNumber: '9 MINT',
        certNumber: '48392019',
        isAutographed: false,
        isHoloOrFoil: true,
        subgrades: {
          centering: '9.5',
          corners: '9.0',
          edges: '9.0',
          surface: '9.5',
        },
      },
      visibleText: ['Charizard', 'HP 120', 'Fire Spin', 'Energy Burn', '4/102', 'Illus. Ken Sugimori', '1999 Wizards'],
      ocrSummary: 'Pokemon 1999 Base Set Charizard #4/102 Holofoil, Stage 2 Fire type, 120 HP.',
      proposedFilename: '1999_POKEMON_BASE_SET_CHARIZARD_4-102_HOLO_PSA9_001.jpg',
      proposedRelativeFolder: 'Inventory/Trading Cards/Pokemon/Base Set',
      confidenceScore: 98,
      reasoning: 'Authentic 1999 Base Set unlimited Charizard verified via font weight of 120 HP, Ken Sugimori illustrator stamp, and star rarity symbol.',
      tags: ['Pokemon', 'Charizard', 'Base Set', 'PSA 9', 'Holo', 'Wizards of the Coast', 'Vintage TCG', 'Grail'],
      estimatedMarketValueUsd: {
        low: 850,
        median: 1250,
        high: 1450,
      },
    },
    ebayDraft: {
      title: '1999 Pokemon Base Set Charizard #4/102 Holo Rare PSA 9 Mint WOTC Vintage Grail',
      titleCharCount: 78,
      subtitle: 'Graded PSA 9 Mint - Iconic Ken Sugimori art, zero foil scratching',
      primaryCategoryId: '183454',
      primaryCategoryName: 'CCG Individual Cards > Pokemon',
      conditionId: '2750',
      conditionDescriptor: 'Graded - PSA 9 Mint (Cert #48392019)',
      itemSpecifics: {
        'Game': 'Pokemon TCG',
        'Card Name': 'Charizard',
        'Set': 'Base Set',
        'Card Number': '4/102',
        'Rarity': 'Holo Rare',
        'Graded': 'Yes',
        'Professional Grader': 'Professional Sports Authenticator (PSA)',
        'Grade': '9',
        'Year Manufactured': '1999',
        'Manufacturer': 'Wizards of the Coast',
        'Language': 'English',
      },
      searchKeywords: ['Charizard', 'Base Set', 'PSA 9', 'Holo', '1999', 'WOTC', 'Ken Sugimori'],
      suggestedPriceBin: 1299.99,
      suggestedStartingBid: 899.99,
      format: 'FixedPrice',
      shippingPreset: 'USPS Priority Mail Box + Adult Signature Included ($14.95)',
      descriptionHtml: `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #0f172a; margin-top: 0;">1999 Pokemon Base Set Charizard #4/102 Holo PSA 9 MINT</h2>
        <p style="color: #475569; font-size: 15px;">Up for purchase is one of the most iconic trading cards ever produced: the original 1999 Wizards of the Coast Base Set Unlimited Charizard, officially authenticated and encapsulated by PSA as a Mint 9.</p>
        <div style="background: #f8fafc; border-radius: 8px; padding: 18px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1e293b; font-size: 16px;">Verified Item Details:</h3>
          <ul style="color: #334155; line-height: 1.8;">
            <li><strong>Card / Subject:</strong> Charizard Holo Rare #4/102</li>
            <li><strong>Set & Year:</strong> 1999 WOTC Base Set</li>
            <li><strong>Grade:</strong> PSA 9 MINT (Cert Verification: 48392019)</li>
            <li><strong>Condition:</strong> Crisp centering, vibrant holo foil luster with zero scratching.</li>
          </ul>
        </div>
        <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 14px; border-radius: 6px;">
          <strong style="color: #065f46;">Vault Security & Shipping:</strong>
          <p style="margin: 4px 0 0; color: #047857; font-size: 13px;">Shipped via insured Priority Mail in a fitted slab sleeve, nestled inside a crush-proof rigid box.</p>
        </div>
      </div>`,
    },
  },
  {
    id: 'item-002',
    originalName: 'DCIM_00491_topps.png',
    originalPath: 'C:/Users/Seller/My Drive/Incoming/DCIM_00491_topps.png',
    fileSize: 3890200,
    mimeType: 'image/png',
    previewUrl: createCollectibleSvg('AARON JUDGE TOPPS CHROME', '2026 Chrome Refractor #99 Yankees', 'RAW NM', ['#0f172a', '#1e3a8a'], '⚾ AARON JUDGE'),
    proposedName: '2026_TOPPS_CHROME_AARON_JUDGE_REFRACTOR_99_RAW_001.png',
    proposedFolder: 'Inventory/Sports Cards/Baseball/Modern',
    status: 'pending',
    confidence: 96,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    analysis: {
      objectType: 'Sports Trading Card',
      category: 'Sports Cards',
      subcategory: 'Baseball Cards',
      brandOrManufacturer: 'Topps',
      productName: 'Aaron Judge Topps Chrome Refractor',
      modelOrCardNumber: '#99',
      yearOrEra: '2026',
      conditionClues: [
        'Razor sharp 90-degree corners with no paper fuzz',
        'High gloss chromium finish without print lines or dimples',
        'Centering 50/50 left-to-right, strong candidate for PSA submission',
      ],
      estimatedCondition: 'Gem Mint / PSA 10 Candidate',
      gradingDetails: {
        grader: 'RAW',
        gradeNumber: 'Raw Gem Candidate',
        certNumber: 'UNGRADED-RAW',
        isAutographed: false,
        isHoloOrFoil: true,
      },
      visibleText: ['Topps Chrome', 'Aaron Judge', 'Outfield', 'New York Yankees', 'Refractor', 'Card #99'],
      ocrSummary: 'Topps Chrome 2026 Aaron Judge NY Yankees Refractor parallel #99.',
      proposedFilename: '2026_TOPPS_CHROME_AARON_JUDGE_REFRACTOR_99_RAW_001.png',
      proposedRelativeFolder: 'Inventory/Sports Cards/Baseball/Modern',
      confidenceScore: 96,
      reasoning: 'Recognized official 2026 Topps Chrome baseball typography, rainbow chrome sheen, Yankees jersey number 99.',
      tags: ['Aaron Judge', 'Yankees', 'Topps Chrome', 'Refractor', 'Baseball Card', 'MLB', 'Gem Candidate'],
      estimatedMarketValueUsd: {
        low: 45,
        median: 85,
        high: 140,
      },
    },
    ebayDraft: {
      title: '2026 Topps Chrome Aaron Judge Refractor #99 NY Yankees GEM MINT Raw Candidate',
      titleCharCount: 76,
      subtitle: 'Pack-fresh chromium refractor - Sharp corners, perfect centering',
      primaryCategoryId: '213',
      primaryCategoryName: 'Sports Trading Cards > Baseball',
      conditionId: '3000',
      conditionDescriptor: 'Near Mint or Better (Pack fresh raw)',
      itemSpecifics: {
        'Sport': 'Baseball',
        'Player/Athlete': 'Aaron Judge',
        'Team': 'New York Yankees',
        'Manufacturer': 'Topps',
        'Card Name': 'Topps Chrome Refractor',
        'Card Number': '99',
        'Season': '2026',
        'Parallel/Variety': 'Refractor',
        'Condition': 'Near Mint or Better',
      },
      searchKeywords: ['Aaron Judge', 'Yankees', 'Topps Chrome', 'Refractor', 'Baseball', 'Gem Mint'],
      suggestedPriceBin: 79.95,
      suggestedStartingBid: 39.99,
      format: 'FixedPrice',
      shippingPreset: 'USPS Ground Advantage with Top Loader + Bubble Mailer ($4.95)',
      descriptionHtml: `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: auto; padding: 20px; border: 1px solid #cbd5e1; border-radius: 8px;">
        <h2 style="color: #0f172a;">2026 Topps Chrome Aaron Judge Refractor #99</h2>
        <p>Freshly pulled and immediately sleeved into an archival penny sleeve and semi-rigid holder. Flawless surface with bright chromium sheen.</p>
      </div>`,
    },
  },
  {
    id: 'item-003',
    originalName: 'photo_nintendo64_sm64.jpg',
    originalPath: 'C:/Users/Seller/My Drive/Incoming/photo_nintendo64_sm64.jpg',
    fileSize: 5120400,
    mimeType: 'image/jpeg',
    previewUrl: createCollectibleSvg('SUPER MARIO 64 CIB', 'Nintendo 64 Complete in Box 1996', 'CIB 8.5', ['#831843', '#be185d'], '🍄 N64 MARIO 64'),
    proposedName: '1996_NINTENDO_N64_SUPER_MARIO_64_CIB_COMPLETE_BOX_001.jpg',
    proposedFolder: 'Inventory/Video Games/Nintendo/N64',
    status: 'pending',
    confidence: 95,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    analysis: {
      objectType: 'Video Game CIB',
      category: 'Video Games',
      subcategory: 'Nintendo 64',
      brandOrManufacturer: 'Nintendo',
      productName: 'Super Mario 64 Complete in Box (CIB)',
      modelOrCardNumber: 'NUS-NSME-USA',
      yearOrEra: '1996',
      conditionClues: [
        'Cardboard retail box retains sharp factory hangtab integrity',
        'Original manual, consumer information booklet, and cartridge tray present',
        'Cartridge label glossy with crisp ESRB K-A logo',
      ],
      estimatedCondition: 'Near Mint-Mint (NM-MT 8)',
      gradingDetails: {
        grader: 'RAW',
        gradeNumber: 'CIB 8.5/10',
        certNumber: 'AUTHENTIC-RETRO',
        isAutographed: false,
        isHoloOrFoil: false,
      },
      visibleText: ['Nintendo 64', 'Super Mario 64', 'Only For Nintendo 64', 'ESRB K-A', 'NUS-P-NSME'],
      ocrSummary: 'Super Mario 64 retail game box, manual, and cartridge for Nintendo 64.',
      proposedFilename: '1996_NINTENDO_N64_SUPER_MARIO_64_CIB_COMPLETE_BOX_001.jpg',
      proposedRelativeFolder: 'Inventory/Video Games/Nintendo/N64',
      confidenceScore: 95,
      reasoning: 'Verified genuine original 1996 first-print box art, pixel-accurate Nintendo seal of quality.',
      tags: ['Super Mario 64', 'Nintendo 64', 'N64', 'CIB', 'Retro Gaming', 'Complete in Box', 'Collector'],
      estimatedMarketValueUsd: {
        low: 110,
        median: 165,
        high: 220,
      },
    },
    ebayDraft: {
      title: 'Super Mario 64 Nintendo 64 N64 1996 CIB Complete in Box Manual Cart Authentic',
      titleCharCount: 78,
      subtitle: 'Complete original 1996 release - Crisp box, original tray & manual',
      primaryCategoryId: '139973',
      primaryCategoryName: 'Video Games & Consoles > Video Games',
      conditionId: '4000',
      conditionDescriptor: 'Very Good (Original Box and Manual Included)',
      itemSpecifics: {
        'Platform': 'Nintendo 64',
        'Game Name': 'Super Mario 64',
        'Genre': 'Platformer',
        'Publisher': 'Nintendo',
        'Release Year': '1996',
        'Rating': 'E-Everyone / K-A',
        'Region Code': 'NTSC-U/C (US/Canada)',
      },
      searchKeywords: ['Super Mario 64', 'Nintendo 64', 'N64', 'CIB', 'Complete in Box', 'Vintage Game'],
      suggestedPriceBin: 159.00,
      suggestedStartingBid: 99.00,
      format: 'FixedPrice',
      shippingPreset: 'USPS Ground Advantage Box with Bubble Wrap ($7.85)',
      descriptionHtml: `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f172a;">Super Mario 64 (Nintendo 64) - Complete in Box</h2>
        <p>100% authentic Nintendo original. Tested and saves reliably. Clean pins.</p>
      </div>`,
    },
  },
  {
    id: 'item-004',
    originalName: 'scan_cgc_comic_spiderman.jpg',
    originalPath: 'C:/Users/Seller/My Drive/Incoming/scan_cgc_comic_spiderman.jpg',
    fileSize: 6204100,
    mimeType: 'image/jpeg',
    previewUrl: createCollectibleSvg('AMAZING SPIDER-MAN #63', 'Marvel Comics 1968 Vulture CGC 8.5', 'CGC 8.5', ['#1e1b4b', '#4338ca'], '🕷️ SPIDER-MAN #63'),
    proposedName: '1968_MARVEL_AMAZING_SPIDER-MAN_63_CGC_8-5_OW_PAGES_001.jpg',
    proposedFolder: 'Inventory/Comics/Marvel/Silver Age',
    status: 'pending',
    confidence: 97,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    analysis: {
      objectType: 'Graded Comic Book Slab',
      category: 'Comics & Graphic Novels',
      subcategory: 'Silver Age Marvel',
      brandOrManufacturer: 'Marvel Comics',
      productName: 'The Amazing Spider-Man #63',
      modelOrCardNumber: 'Issue #63',
      yearOrEra: '1968',
      conditionClues: [
        'CGC Universal blue label slab in pristine unscratched condition',
        'Off-White to White pages notation on grading label',
        'Vibrant John Romita Sr. cover art with deep magenta saturation',
      ],
      estimatedCondition: 'Graded Slab',
      gradingDetails: {
        grader: 'CGC',
        gradeNumber: '8.5 VERY FINE+',
        certNumber: '3928194002',
        isAutographed: false,
        isHoloOrFoil: false,
      },
      visibleText: ['The Amazing Spider-Man', 'Marvel Comics Group', '12c', '#63', 'Aug', 'Wings in the Night', 'CGC Universal Grade 8.5'],
      ocrSummary: 'CGC Graded 8.5 Amazing Spider-Man #63 August 1968 John Romita cover and art.',
      proposedFilename: '1968_MARVEL_AMAZING_SPIDER-MAN_63_CGC_8-5_OW_PAGES_001.jpg',
      proposedRelativeFolder: 'Inventory/Comics/Marvel/Silver Age',
      confidenceScore: 97,
      reasoning: 'Authentic CGC certification barcode and verified registry match for Amazing Spider-Man #63.',
      tags: ['Spider-Man', 'Marvel Comics', 'CGC 8.5', 'Silver Age', 'John Romita', 'Stan Lee', 'Key Issue'],
      estimatedMarketValueUsd: {
        low: 220,
        median: 310,
        high: 390,
      },
    },
    ebayDraft: {
      title: 'Amazing Spider-Man #63 CGC 8.5 VF+ 1968 Marvel Silver Age Romita Vulture Classic',
      titleCharCount: 78,
      subtitle: 'CGC Universal Blue Label 8.5 - Off-White to White Pages',
      primaryCategoryId: '259104',
      primaryCategoryName: 'Collectibles > Comic Books & Memorabilia',
      conditionId: '2750',
      conditionDescriptor: 'Graded CGC 8.5 Very Fine+',
      itemSpecifics: {
        'Publisher': 'Marvel Comics',
        'Series Title': 'The Amazing Spider-Man',
        'Issue Number': '63',
        'Era': 'Silver Age (1956-69)',
        'Grade': '8.5 Very Fine+',
        'Professional Grader': 'Certified Guaranty Company (CGC)',
        'Character': 'Spider-Man, Vulture',
      },
      searchKeywords: ['Amazing Spider-Man 63', 'CGC 8.5', 'Marvel', 'Silver Age', 'Vulture'],
      suggestedPriceBin: 295.00,
      suggestedStartingBid: 199.00,
      format: 'FixedPrice',
      shippingPreset: 'USPS Priority Mail Medium Flat Rate Box with Bubble Wrap ($16.50)',
      descriptionHtml: `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f172a;">The Amazing Spider-Man #63 - CGC 8.5 VF+</h2>
        <p>Classic Silver Age issue featuring John Romita cover art. Slab is spotless and enclosed in a protective comic bag.</p>
      </div>`,
    },
  },
  {
    id: 'item-005',
    originalName: 'coin_silver_morgan_1881.jpg',
    originalPath: 'C:/Users/Seller/My Drive/Incoming/coin_silver_morgan_1881.jpg',
    fileSize: 4510000,
    mimeType: 'image/jpeg',
    previewUrl: createCollectibleSvg('1881-S MORGAN DOLLAR', 'PCGS MS65 Gem Uncirculated Silver', 'MS65', ['#064e3b', '#047857'], '🪙 1881-S MORGAN'),
    proposedName: '1881-S_US_MINT_MORGAN_SILVER_DOLLAR_PCGS_MS65_GEM_BU_001.jpg',
    proposedFolder: 'Inventory/Coins & Bullion/US Silver/Morgan Dollars',
    status: 'pending',
    confidence: 99,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    analysis: {
      objectType: 'Numismatic Coin Slab',
      category: 'Coins & Bullion',
      subcategory: 'Morgan Silver Dollars',
      brandOrManufacturer: 'United States Mint (San Francisco)',
      productName: '1881-S Morgan Silver Dollar',
      modelOrCardNumber: '$1 Silver',
      yearOrEra: '1881',
      conditionClues: [
        'PCGS gold shield holder with verified NFC chip verification',
        'Full breast feathers on eagle reverse, strong frosty cartwheel luster',
        'Clean cheek on Liberty obverse with zero bag marks',
      ],
      estimatedCondition: 'Graded Slab',
      gradingDetails: {
        grader: 'PCGS',
        gradeNumber: 'MS65 GEM BU',
        certNumber: '89102482',
        isAutographed: false,
        isHoloOrFoil: false,
      },
      visibleText: ['1881-S $1', 'PCGS MS65', 'E Pluribus Unum', 'In God We Trust', 'One Dollar'],
      ocrSummary: '1881-S PCGS MS65 Morgan Silver Dollar, 90% silver, San Francisco mint.',
      proposedFilename: '1881-S_US_MINT_MORGAN_SILVER_DOLLAR_PCGS_MS65_GEM_BU_001.jpg',
      proposedRelativeFolder: 'Inventory/Coins & Bullion/US Silver/Morgan Dollars',
      confidenceScore: 99,
      reasoning: 'PCGS certification confirmed with crisp S mintmark under wreath bow, booming cartwheel luster.',
      tags: ['Morgan Dollar', '1881-S', 'PCGS MS65', 'Silver Coin', 'US Mint', 'Numismatic', 'Bullion'],
      estimatedMarketValueUsd: {
        low: 180,
        median: 235,
        high: 280,
      },
    },
    ebayDraft: {
      title: '1881-S Morgan Silver Dollar PCGS MS65 Gem BU Booming Luster San Francisco Mint',
      titleCharCount: 78,
      subtitle: 'PCGS Gold Shield MS65 - Blazing cartwheel luster, clean cheek',
      primaryCategoryId: '39464',
      primaryCategoryName: 'Coins: US > Dollars > Morgan (1878-1921)',
      conditionId: '2750',
      conditionDescriptor: 'Graded PCGS MS65',
      itemSpecifics: {
        'Coin': 'Morgan',
        'Year': '1881',
        'Mint Location': 'San Francisco',
        'Grade': 'MS 65',
        'Certification': 'PCGS',
        'Composition': 'Silver (90%)',
        'Country/Region of Manufacture': 'United States',
      },
      searchKeywords: ['1881-S Morgan', 'PCGS MS65', 'Silver Dollar', 'BU', 'San Francisco'],
      suggestedPriceBin: 245.00,
      suggestedStartingBid: 175.00,
      format: 'FixedPrice',
      shippingPreset: 'USPS Ground Advantage Insured with Signature ($5.95)',
      descriptionHtml: `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f172a;">1881-S Morgan Silver Dollar - PCGS MS65</h2>
        <p>A phenomenal example of the famous 1881 San Francisco strike. Full cartwheel luster, satin fields, and needle-sharp details.</p>
      </div>`,
    },
    sha256: '444455556666777788889999aaaabbbbccccddddeeeeffff00001111222233334444',
    pHash: '1111222233334444',
    role: 'front',
    groupId: 'group-coin-001',
  },
  {
    id: 'item-001-rear',
    originalName: 'IMG_20261008_142320_rear.jpg',
    originalPath: 'C:/Users/Seller/My Drive/Incoming/IMG_20261008_142320_rear.jpg',
    fileSize: 4180400,
    mimeType: 'image/jpeg',
    previewUrl: createCollectibleSvg('POKEMON CHARIZARD [BACK]', 'PSA 9 Reverse View', 'REAR', ['#450a0a', '#7f1d1d'], '🔍 REVERSE VIEW'),
    proposedName: '1999_POKEMON_BASE_SET_CHARIZARD_4-102_REAR_PSA9_002.jpg',
    proposedFolder: 'Inventory/Trading Cards/Pokemon/Base Set',
    status: 'pending',
    confidence: 97,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
    pHash: 'ffff0000ffff0011',
    role: 'rear',
    groupId: 'group-charizard-001',
  },
  {
    id: 'item-001-corner',
    originalName: 'IMG_20261008_142325_corner_zoom.jpg',
    originalPath: 'C:/Users/Seller/My Drive/Incoming/IMG_20261008_142325_corner_zoom.jpg',
    fileSize: 2840000,
    mimeType: 'image/jpeg',
    previewUrl: createCollectibleSvg('TOP RIGHT CORNER DETAIL', 'Microscopic 20x Inspection', 'CORNER', ['#1c1917', '#44403c'], '🔬 CORNER ZOOM'),
    proposedName: '1999_POKEMON_BASE_SET_CHARIZARD_CORNER_ZOOM_003.jpg',
    proposedFolder: 'Inventory/Trading Cards/Pokemon/Base Set',
    status: 'pending',
    confidence: 94,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sha256: 'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100',
    pHash: 'ffff0000ffff00aa',
    role: 'corner',
    groupId: 'group-charizard-001',
  },
  {
    id: 'item-002-rear',
    originalName: 'DCIM_00492_topps_rear.png',
    originalPath: 'C:/Users/Seller/My Drive/Incoming/DCIM_00492_topps_rear.png',
    fileSize: 3750000,
    mimeType: 'image/png',
    previewUrl: createCollectibleSvg('AARON JUDGE CHROME [REAR]', 'Statistics & Bio Back', 'REAR', ['#030712', '#1e1b4b'], '⚾ STATS REAR'),
    proposedName: '2026_TOPPS_CHROME_AARON_JUDGE_REFRACTOR_99_REAR_002.png',
    proposedFolder: 'Inventory/Sports Cards/Baseball/Modern',
    status: 'pending',
    confidence: 96,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sha256: '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
    pHash: '0000ffff0000fffe',
    role: 'rear',
    groupId: 'group-judge-001',
  },
  {
    id: 'item-002-dup',
    originalName: 'DCIM_00491_topps_copy.png',
    originalPath: 'C:/Users/Seller/My Drive/Backup_Exports/DCIM_00491_topps_copy.png',
    fileSize: 3890200,
    mimeType: 'image/png',
    previewUrl: createCollectibleSvg('AARON JUDGE TOPPS CHROME', '2026 Chrome Refractor #99 Yankees', 'RAW NM', ['#0f172a', '#1e3a8a'], '⚾ AARON JUDGE'),
    proposedName: '2026_TOPPS_CHROME_AARON_JUDGE_REFRACTOR_99_RAW_001.png',
    proposedFolder: 'Inventory/Sports Cards/Baseball/Modern',
    status: 'pending',
    confidence: 96,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sha256: '2233445566778899aabbccddeeff00112233445566778899aabbccddeeff0011',
    pHash: '0000ffff0000ffff',
    role: 'front',
  },
];

export const INITIAL_SAMPLE_GROUPS = [
  {
    id: 'group-charizard-001',
    title: '1999 Pokemon Base Set Charizard #4/102 Holo Rare PSA 9 Mint',
    category: 'Trading Cards',
    subcategory: 'Pokemon TCG',
    estimatedCondition: 'Mint / PSA 9' as const,
    cardOrModelNumber: '4/102',
    primaryImageId: 'item-001',
    imageAssignments: [
      { imageId: 'item-001', role: 'front' as const, order: 0, includedInEbayDraft: true },
      { imageId: 'item-001-rear', role: 'rear' as const, order: 1, includedInEbayDraft: true },
      { imageId: 'item-001-corner', role: 'corner' as const, order: 2, includedInEbayDraft: true },
    ],
    confidenceScore: 98,
    autoGrouped: true,
    status: 'ready_for_listing' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'group-judge-001',
    title: '2026 Topps Chrome Aaron Judge Refractor #99 NY Yankees Gem Raw',
    category: 'Sports Cards',
    subcategory: 'Baseball Cards',
    estimatedCondition: 'Gem Mint / PSA 10 Candidate' as const,
    cardOrModelNumber: '#99',
    primaryImageId: 'item-002',
    imageAssignments: [
      { imageId: 'item-002', role: 'front' as const, order: 0, includedInEbayDraft: true },
      { imageId: 'item-002-rear', role: 'rear' as const, order: 1, includedInEbayDraft: true },
    ],
    confidenceScore: 95,
    autoGrouped: true,
    status: 'grouped' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'group-coin-001',
    title: '1881-S Morgan Silver Dollar PCGS MS65 Gem BU San Francisco Mint',
    category: 'Coins & Bullion',
    subcategory: 'Morgan Dollars',
    estimatedCondition: 'Gem Mint / PSA 10 Candidate' as const,
    primaryImageId: 'item-004',
    imageAssignments: [
      { imageId: 'item-004', role: 'front' as const, order: 0, includedInEbayDraft: true },
    ],
    confidenceScore: 99,
    autoGrouped: true,
    status: 'grouped' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

