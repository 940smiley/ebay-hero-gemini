import { describe, expect, it } from 'vitest';
import { 
  autoGroupInventoryItems, 
  detectDuplicates, 
  calculateHammingDistance, 
  inferImageRole, 
  extractSequenceStem 
} from '../src/lib/groupingAndDedup.ts';
import { generateAllSocialPosts, generateSocialPost } from '../src/lib/socialMedia.ts';
import { ImageItem } from '../src/types/index.ts';

describe('Intelligent Image Grouping & Pairing', () => {
  it('extracts sequential stems from numbered filenames', () => {
    expect(extractSequenceStem('IMG_001.jpg')).toEqual({ stem: 'img', suffix: '001', sequenceNum: 1 });
    expect(extractSequenceStem('scan-card-04.png')).toEqual({ stem: 'scan-card', suffix: '04', sequenceNum: 4 });
    expect(extractSequenceStem('single_photo.jpg')).toEqual({ stem: 'single_photo', suffix: '', sequenceNum: null });
  });

  it('infers multi-view roles from filenames and condition clues', () => {
    const itemFront: ImageItem = {
      id: '1', originalName: 'Pikachu_front.jpg', originalPath: '', fileSize: 100, mimeType: 'image/jpeg',
      previewUrl: '', proposedName: 'Pikachu_front.jpg', proposedFolder: '', status: 'pending', confidence: 90,
      createdAt: '', updatedAt: ''
    };
    expect(inferImageRole(itemFront)).toBe('front');

    const itemBack: ImageItem = {
      id: '2', originalName: 'Pikachu_rear_scan.jpg', originalPath: '', fileSize: 100, mimeType: 'image/jpeg',
      previewUrl: '', proposedName: '', proposedFolder: '', status: 'pending', confidence: 90,
      createdAt: '', updatedAt: ''
    };
    expect(inferImageRole(itemBack)).toBe('rear');

    const itemCorner: ImageItem = {
      id: '3', originalName: 'corner_top_left.jpg', originalPath: '', fileSize: 100, mimeType: 'image/jpeg',
      previewUrl: '', proposedName: '', proposedFolder: '', status: 'pending', confidence: 90,
      createdAt: '', updatedAt: ''
    };
    expect(inferImageRole(itemCorner)).toBe('corner');
  });

  it('automatically groups sequential front and back photos into an inventory item', () => {
    const items: ImageItem[] = [
      {
        id: 'img1', originalName: 'MichaelJordan_front.jpg', originalPath: '', fileSize: 200, mimeType: 'image/jpeg',
        previewUrl: '', proposedName: '1986_Fleer_Michael_Jordan_front.jpg', proposedFolder: 'Basketball',
        status: 'pending', confidence: 95, createdAt: '', updatedAt: '',
        analysis: {
          category: 'Basketball Cards', modelOrCardNumber: '#57', productName: '1986 Fleer Michael Jordan Rookie',
          objectType: 'Trading Card', subcategory: 'Vintage', brandOrManufacturer: 'Fleer', yearOrEra: '1986',
          conditionClues: [], estimatedCondition: 'Near Mint (NM 7)', visibleText: [], ocrSummary: '',
          proposedFilename: '', proposedRelativeFolder: '', confidenceScore: 95, reasoning: '', tags: [],
          estimatedMarketValueUsd: { low: 2000, median: 2500, high: 3000 }
        }
      },
      {
        id: 'img2', originalName: 'MichaelJordan_back.jpg', originalPath: '', fileSize: 210, mimeType: 'image/jpeg',
        previewUrl: '', proposedName: '1986_Fleer_Michael_Jordan_back.jpg', proposedFolder: 'Basketball',
        status: 'pending', confidence: 95, createdAt: '', updatedAt: '',
        analysis: {
          category: 'Basketball Cards', modelOrCardNumber: '#57', productName: '1986 Fleer Michael Jordan Rookie',
          objectType: 'Trading Card', subcategory: 'Vintage', brandOrManufacturer: 'Fleer', yearOrEra: '1986',
          conditionClues: [], estimatedCondition: 'Near Mint (NM 7)', visibleText: [], ocrSummary: '',
          proposedFilename: '', proposedRelativeFolder: '', confidenceScore: 95, reasoning: '', tags: [],
          estimatedMarketValueUsd: { low: 2000, median: 2500, high: 3000 }
        }
      },
      {
        id: 'img3', originalName: 'RandomStamps.jpg', originalPath: '', fileSize: 150, mimeType: 'image/jpeg',
        previewUrl: '', proposedName: 'US_Airmail_Stamp.jpg', proposedFolder: 'Stamps',
        status: 'pending', confidence: 80, createdAt: '', updatedAt: ''
      }
    ];

    const result = autoGroupInventoryItems(items);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].imageAssignments).toHaveLength(2);
    expect(result.groups[0].title).toBe('1986 Fleer Michael Jordan Rookie');
    expect(result.groups[0].confidenceScore).toBeGreaterThanOrEqual(85);
    expect(result.unassignedItems).toHaveLength(1);
    expect(result.unassignedItems[0].id).toBe('img3');
  });
});

describe('Smart Deduplication Engine', () => {
  it('detects exact duplicates via matching SHA-256 hash', () => {
    const items: ImageItem[] = [
      {
        id: 'a1', originalName: 'Card1.jpg', originalPath: '/folderA/Card1.jpg', fileSize: 500, mimeType: 'image/jpeg',
        previewUrl: '', proposedName: '', proposedFolder: '', status: 'pending', confidence: 90,
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        createdAt: '', updatedAt: ''
      },
      {
        id: 'a2', originalName: 'Card1_copy.jpg', originalPath: '/folderB/Card1_copy.jpg', fileSize: 500, mimeType: 'image/jpeg',
        previewUrl: '', proposedName: '', proposedFolder: '', status: 'pending', confidence: 90,
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        createdAt: '', updatedAt: ''
      }
    ];

    const dups = detectDuplicates(items);
    expect(dups).toHaveLength(1);
    expect(dups[0].matchType).toBe('exact_sha256');
    expect(dups[0].similarityScore).toBe(100);
  });

  it('detects visual similarity via perceptual hash Hamming distance', () => {
    expect(calculateHammingDistance('ffff0000ffff0000', 'ffff0000ffff0000')).toBe(0);
    expect(calculateHammingDistance('ffff0000ffff0000', 'ffff0000ffff0001')).toBe(1);

    const items: ImageItem[] = [
      {
        id: 'v1', originalName: 'ScanA.jpg', originalPath: '', fileSize: 400, mimeType: 'image/jpeg',
        previewUrl: '', proposedName: '', proposedFolder: '', status: 'pending', confidence: 90,
        pHash: 'ffff0000ffff0000', createdAt: '', updatedAt: ''
      },
      {
        id: 'v2', originalName: 'ScanA_compressed.jpg', originalPath: '', fileSize: 350, mimeType: 'image/jpeg',
        previewUrl: '', proposedName: '', proposedFolder: '', status: 'pending', confidence: 90,
        pHash: 'ffff0000ffff0003', createdAt: '', updatedAt: ''
      }
    ];

    const dups = detectDuplicates(items);
    expect(dups).toHaveLength(1);
    expect(dups[0].matchType).toBe('visual_phash');
    expect(dups[0].hammingDistance).toBe(2);
    expect(dups[0].similarityScore).toBeGreaterThanOrEqual(90);
  });
});

describe('Social Media Marketing Automation', () => {
  it('generates customized posts for all target platforms with character limits respected', () => {
    const item: ImageItem = {
      id: 's1', originalName: 'Charizard.jpg', originalPath: '', fileSize: 300, mimeType: 'image/jpeg',
      previewUrl: '', proposedName: '1999_Base_Set_Charizard_PSA_9.jpg', proposedFolder: '',
      status: 'approved', confidence: 98, createdAt: '', updatedAt: '',
      ebayDraft: {
        title: '1999 Pokemon Base Set 1st Edition Shadowless Charizard #4 Holo Rare PSA 9 Mint',
        titleCharCount: 78, subtitle: '', primaryCategoryId: '183454', primaryCategoryName: 'Pokemon TCG Cards',
        conditionId: '2750', conditionDescriptor: 'PSA 9 Mint Graded', itemSpecifics: {}, searchKeywords: [],
        suggestedPriceBin: 14500, suggestedStartingBid: 9999, format: 'FixedPrice', shippingPreset: 'Express Insured',
        descriptionHtml: '<p>Verified PSA 9 Mint</p>'
      },
      analysis: {
        objectType: 'Pokemon Card', category: 'Trading Cards', subcategory: 'Pokemon', brandOrManufacturer: 'Wizards of the Coast',
        productName: '1999 Base Set Charizard', modelOrCardNumber: '4/102', yearOrEra: '1999', conditionClues: ['PSA 9 slab'],
        estimatedCondition: 'Mint / PSA 9', visibleText: [], ocrSummary: '', proposedFilename: '', proposedRelativeFolder: '',
        confidenceScore: 98, reasoning: '', tags: ['Charizard', 'Holo', 'PSA 9'],
        estimatedMarketValueUsd: { low: 12000, median: 14500, high: 16000 },
        gradingDetails: { grader: 'PSA', gradeNumber: '9' }
      }
    };

    const posts = generateAllSocialPosts({
      title: item.ebayDraft!.title,
      category: item.ebayDraft!.primaryCategoryName,
      condition: 'PSA 9 Mint',
      price: 14500,
      grade: '9',
      grader: 'PSA',
      year: '1999',
      brand: 'Wizards of the Coast',
      ebayUrl: 'https://ebay.us/item-listing'
    });

    expect(posts.twitter.characterCount).toBeLessThanOrEqual(280);
    expect(posts.instagram.hashtags.length).toBeGreaterThan(5);
    expect(posts.facebook.caption).toContain('14500.00');
    expect(posts.tiktok.recommendedAspectRatio).toContain('9:16');
    expect(posts.pinterest.recommendedAspectRatio).toContain('2:3');
    expect(posts.youtube_shorts.title.length).toBeLessThanOrEqual(100);
  });
});
