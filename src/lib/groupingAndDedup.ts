import { ImageItem, InventoryItemGroup, ImageRole, DuplicateCandidate, ImageAssignment } from '../types/index.ts';

/**
 * Computes a simple 64-bit perceptual hash (difference hash) from an image canvas or pixel buffer.
 * For in-browser/client-side calculation or server simulation.
 */
export function calculateHammingDistance(hashA: string, hashB: string): number {
  if (!hashA || !hashB || hashA.length !== hashB.length) return 64;
  let dist = 0;
  for (let i = 0; i < hashA.length; i++) {
    const valA = parseInt(hashA[i], 16);
    const valB = parseInt(hashB[i], 16);
    let xor = valA ^ valB;
    while (xor > 0) {
      dist += xor & 1;
      xor >>= 1;
    }
  }
  return dist;
}

/**
 * Normalizes filenames to detect sequencing (e.g. IMG_001_front, IMG_001_back, scan_01, scan_02).
 */
export function extractSequenceStem(filename: string): { stem: string; suffix: string; sequenceNum: number | null } {
  const withoutExt = filename.replace(/\.[^/.]+$/, '');
  const seqMatch = withoutExt.match(/(.*?)[\s_-]?(\d+)$/);
  if (seqMatch) {
    return {
      stem: seqMatch[1].toLowerCase().trim(),
      suffix: seqMatch[2],
      sequenceNum: parseInt(seqMatch[2], 10),
    };
  }
  return {
    stem: withoutExt.toLowerCase().trim(),
    suffix: '',
    sequenceNum: null,
  };
}

/**
 * Detects likely multi-view role from filename keywords, OCR clues, and object analysis.
 */
export function inferImageRole(item: ImageItem, indexInSequence = 0): ImageRole {
  const name = (item.originalName + ' ' + (item.proposedName || '')).toLowerCase();
  const clues = (item.analysis?.conditionClues || []).join(' ').toLowerCase();
  const tags = (item.analysis?.tags || []).join(' ').toLowerCase();

  if (name.includes('front') || name.includes('obverse') || name.includes('recto')) return 'front';
  if (name.includes('back') || name.includes('rear') || name.includes('reverse') || name.includes('verso')) return 'rear';
  if (name.includes('corner') || clues.includes('corner')) return 'corner';
  if (name.includes('edge') || clues.includes('edge')) return 'surface_detail';
  if (name.includes('slab') || name.includes('case') || name.includes('holder') || name.includes('box') || name.includes('pack')) return 'packaging';
  if (name.includes('cert') || name.includes('serial') || name.includes('label')) return 'serial_number';
  if (name.includes('defect') || name.includes('crease') || name.includes('scratch') || name.includes('flaw')) return 'defect';
  if (name.includes('left')) return 'left_side';
  if (name.includes('right')) return 'right_side';
  if (name.includes('top')) return 'top';
  if (name.includes('bottom')) return 'bottom';

  // Analysis fallback
  if (item.analysis?.objectType?.toLowerCase().includes('slab') && indexInSequence === 0) return 'front';
  if (indexInSequence === 0) return 'front';
  if (indexInSequence === 1) return 'rear';
  return 'unclassified';
}

/**
 * Intelligent Image Pairing and Grouping Engine.
 * Analyzes a collection of images and groups them into multi-view items.
 */
export function autoGroupInventoryItems(items: ImageItem[], existingGroups: InventoryItemGroup[] = []): {
  groups: InventoryItemGroup[];
  unassignedItems: ImageItem[];
} {
  const existingGroupMap = new Map(existingGroups.map(g => [g.id, { ...g }]));
  const processedItemIds = new Set<string>();

  // If items already have explicit groupIds assigned, preserve them
  for (const group of existingGroups) {
    for (const assignment of group.imageAssignments) {
      processedItemIds.add(assignment.imageId);
    }
  }

  const remaining = items.filter(it => !processedItemIds.has(it.id));
  const newGroups: InventoryItemGroup[] = [];

  // 1. Group by existing item analysis card/model number or explicit title
  const modelBuckets = new Map<string, ImageItem[]>();
  for (const item of remaining) {
    const cardNum = item.analysis?.modelOrCardNumber?.trim().toLowerCase();
    const prodName = item.analysis?.productName?.trim().toLowerCase();
    const key = (cardNum && cardNum !== 'n/a') 
      ? `model:${cardNum}:${item.analysis?.yearOrEra || ''}`
      : (prodName && prodName.length > 5) 
      ? `prod:${prodName}` 
      : null;

    if (key) {
      const bucket = modelBuckets.get(key) || [];
      bucket.push(item);
      modelBuckets.set(key, bucket);
    }
  }

  // Process strong analysis buckets
  for (const [key, bucketItems] of modelBuckets.entries()) {
    if (bucketItems.length >= 2) {
      const primary = bucketItems[0];
      const title = primary.analysis?.productName || primary.proposedName.replace(/\.[^/.]+$/, '');
      const category = primary.analysis?.category || 'Collectibles';

      const assignments: ImageAssignment[] = bucketItems.map((it, idx) => ({
        imageId: it.id,
        role: inferImageRole(it, idx),
        order: idx,
        includedInEbayDraft: true,
      }));

      // High confidence for matching model/card number
      const groupId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      newGroups.push({
        id: groupId,
        title,
        category,
        subcategory: primary.analysis?.subcategory,
        estimatedCondition: primary.analysis?.estimatedCondition,
        cardOrModelNumber: primary.analysis?.modelOrCardNumber,
        primaryImageId: primary.id,
        imageAssignments: assignments,
        confidenceScore: 92,
        autoGrouped: true,
        status: 'grouped',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      bucketItems.forEach(it => processedItemIds.add(it.id));
    }
  }

  // 2. Sequential filename & timestamp grouping for pairs (e.g., IMG_1001, IMG_1002 front/rear)
  const remainingSequentials = items.filter(it => !processedItemIds.has(it.id));
  const sorted = [...remainingSequentials].sort((a, b) => a.originalName.localeCompare(b.originalName));

  let i = 0;
  while (i < sorted.length) {
    const cur = sorted[i];
    const next = sorted[i + 1];

    if (next) {
      const stemCur = extractSequenceStem(cur.originalName);
      const stemNext = extractSequenceStem(next.originalName);

      const isConsecutiveNumbers = 
        stemCur.stem === stemNext.stem && 
        stemCur.sequenceNum !== null && 
        stemNext.sequenceNum !== null && 
        Math.abs(stemNext.sequenceNum - stemCur.sequenceNum) === 1;

      const isFrontBackPair = 
        stemCur.stem.replace(/_?(front|obverse|recto)/i, '') === 
        stemNext.stem.replace(/_?(back|rear|reverse|verso)/i, '');

      if (isConsecutiveNumbers || isFrontBackPair) {
        const groupId = `group-seq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const role1 = inferImageRole(cur, 0);
        const role2 = inferImageRole(next, 1);

        newGroups.push({
          id: groupId,
          title: cur.proposedName ? cur.proposedName.replace(/\.[^/.]+$/, '') : `Item (${cur.originalName})`,
          category: cur.analysis?.category || 'Trading Cards & Collectibles',
          primaryImageId: role1 === 'front' ? cur.id : cur.id,
          imageAssignments: [
            { imageId: cur.id, role: role1, order: 0, includedInEbayDraft: true },
            { imageId: next.id, role: role2 === 'front' && role1 === 'front' ? 'rear' : role2, order: 1, includedInEbayDraft: true },
          ],
          confidenceScore: isFrontBackPair ? 95 : 82,
          autoGrouped: true,
          status: 'grouped',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        processedItemIds.add(cur.id);
        processedItemIds.add(next.id);
        i += 2;
        continue;
      }
    }

    i++;
  }

  const allGroups = [...existingGroups, ...newGroups];
  const unassigned = items.filter(it => !processedItemIds.has(it.id));

  return {
    groups: allGroups,
    unassignedItems: unassigned,
  };
}

/**
 * Deduplication Engine.
 * Detects exact SHA-256 matches and perceptual hash visual similarity.
 */
export function detectDuplicates(items: ImageItem[]): DuplicateCandidate[] {
  const duplicates: DuplicateCandidate[] = [];
  const shaMap = new Map<string, ImageItem>();

  // 1. Exact SHA-256 file duplicate detection
  for (const item of items) {
    if (item.sha256) {
      if (shaMap.has(item.sha256)) {
        const orig = shaMap.get(item.sha256)!;
        duplicates.push({
          id: `dup-sha-${orig.id}-${item.id}`,
          originalImageId: orig.id,
          duplicateImageId: item.id,
          matchType: 'exact_sha256',
          similarityScore: 100,
          status: 'pending',
          detectedAt: new Date().toISOString(),
        });
      } else {
        shaMap.set(item.sha256, item);
      }
    }
  }

  // 2. Visual pHash or Size + Filename similarity
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];

      // Exact already caught
      if (a.sha256 && b.sha256 && a.sha256 === b.sha256) continue;

      if (a.pHash && b.pHash) {
        const dist = calculateHammingDistance(a.pHash, b.pHash);
        if (dist <= 10) {
          const score = Math.round(((64 - dist) / 64) * 100);
          duplicates.push({
            id: `dup-phash-${a.id}-${b.id}`,
            originalImageId: a.id,
            duplicateImageId: b.id,
            matchType: 'visual_phash',
            similarityScore: score,
            hammingDistance: dist,
            status: 'pending',
            detectedAt: new Date().toISOString(),
          });
        }
      } else if (a.fileSize === b.fileSize && a.originalName === b.originalName && a.id !== b.id) {
        // Same file size and name from different folders
        duplicates.push({
          id: `dup-meta-${a.id}-${b.id}`,
          originalImageId: a.id,
          duplicateImageId: b.id,
          matchType: 'catalog_copy',
          similarityScore: 98,
          status: 'pending',
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  return duplicates;
}
