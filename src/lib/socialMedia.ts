import { ImageItem, InventoryItemGroup, SocialPlatform, SocialMediaPost } from '../types/index.ts';

interface ItemListingContext {
  title: string;
  category: string;
  condition: string;
  price?: number;
  grade?: string;
  grader?: string;
  year?: string;
  brand?: string;
  ebayUrl?: string;
}

export function extractContextFromItem(item: ImageItem, group?: InventoryItemGroup): ItemListingContext {
  const analysis = item.analysis;
  const draft = item.ebayDraft;
  const title = draft?.title || group?.title || analysis?.productName || item.proposedName.replace(/\.[^/.]+$/, '');
  const category = draft?.primaryCategoryName || group?.category || analysis?.category || 'Collectibles';
  const condition = analysis?.estimatedCondition || 'Near Mint';
  const price = draft?.suggestedPriceBin || analysis?.estimatedMarketValueUsd?.median || 49.99;
  const grade = analysis?.gradingDetails?.gradeNumber;
  const grader = analysis?.gradingDetails?.grader;
  const year = analysis?.yearOrEra;
  const brand = analysis?.brandOrManufacturer;

  return {
    title,
    category,
    condition,
    price,
    grade,
    grader,
    year,
    brand,
    ebayUrl: 'https://ebay.us/item-listing',
  };
}

export function generateSocialPost(ctx: ItemListingContext, platform: SocialPlatform): SocialMediaPost {
  const gradeStr = ctx.grader && ctx.grade ? `${ctx.grader} ${ctx.grade}` : null;
  const priceFormatted = ctx.price ? `$${ctx.price.toFixed(2)}` : 'Best Offer';

  switch (platform) {
    case 'facebook': {
      const caption = `🔥 AVAILABLE NOW ON EBAY: ${ctx.title}!\n\n` +
        `Collector Highlights:\n` +
        `• Condition: ${gradeStr ? `${gradeStr} Graded` : ctx.condition}\n` +
        `• Category: ${ctx.category}\n` +
        (ctx.year ? `• Year/Era: ${ctx.year}\n` : '') +
        (ctx.brand ? `• Manufacturer: ${ctx.brand}\n` : '') +
        `• Current Price: ${priceFormatted}\n\n` +
        `Shipped securely with tracking and bubble-mailer protection. Don't miss out on adding this to your collection!\n\n` +
        `👉 View the verified eBay listing here: ${ctx.ebayUrl}`;

      const hashtags = ['#eBaySeller', '#Collectibles', '#TradingCards', '#CardCollector', '#GrailHunt'];
      return {
        platform: 'facebook',
        title: `Facebook Marketplace & Post: ${ctx.title}`,
        caption: `${caption}\n\n${hashtags.join(' ')}`,
        hashtags,
        callToAction: 'Click the link to view the official eBay listing',
        recommendedAspectRatio: '1:1 Square or 4:5 Portrait',
        characterCount: caption.length,
        characterLimit: 2000,
      };
    }

    case 'instagram': {
      const hashtags = [
        '#cardcollector', '#thehobby', '#sportscards', '#pokemoncommunity', 
        '#grading', '#psacard', '#whodoyoucollect', '#ebayfinds', 
        '#collectibles', '#cardfam', '#grail', '#cardshow', '#invest'
      ];
      const caption = `✨ Grail Alert! Just listed: ${ctx.title} 🔥\n\n` +
        `Swipe through for high-res centering, corners, and surface details. 🔍\n\n` +
        `📋 Item Specs:\n` +
        `▸ Condition: ${gradeStr || ctx.condition}\n` +
        `▸ Price: ${priceFormatted}\n` +
        `▸ Fast & Secure Shipping Guaranteed 📦\n\n` +
        `🔗 Link in bio to grab this before it's gone!\n\n` +
        hashtags.join(' ');

      return {
        platform: 'instagram',
        title: `Instagram Feed / Carousel: ${ctx.title}`,
        caption,
        hashtags,
        callToAction: 'Link in bio to purchase on eBay',
        recommendedAspectRatio: '1:1 or 4:5 Vertical Carousel',
        characterCount: caption.length,
        characterLimit: 2200,
      };
    }

    case 'tiktok': {
      const hashtags = ['#thehobby', '#cards', '#ebayfinds', '#collectibles', '#unboxing', '#grail'];
      const caption = `Look at this beauty! 🤯 ${ctx.title} just dropped on eBay. ` +
        `${gradeStr ? `Graded ${gradeStr}!` : `Condition: ${ctx.condition}`} ` +
        `Link in bio to check current price and snag it! 🏃💨 ${hashtags.join(' ')}`;

      return {
        platform: 'tiktok',
        title: `TikTok Video Caption: ${ctx.title}`,
        caption,
        hashtags,
        callToAction: 'Check link in bio for eBay listing',
        recommendedAspectRatio: '9:16 Vertical Full Screen',
        characterCount: caption.length,
        characterLimit: 2200,
      };
    }

    case 'twitter': {
      const hashtags = ['#TheHobby', '#eBay', '#CardCollector'];
      // Max 280 chars
      const text = `🔥 NEW LISTING: ${ctx.title.slice(0, 80)}\n\n` +
        `Condition: ${gradeStr || ctx.condition}\n` +
        `Price: ${priceFormatted}\n\n` +
        `Bid or Buy it Now 👇\n${ctx.ebayUrl} ${hashtags.join(' ')}`;

      return {
        platform: 'twitter',
        title: `X (Twitter) Post: ${ctx.title}`,
        caption: text,
        hashtags,
        callToAction: 'Click the link to view on eBay',
        recommendedAspectRatio: '16:9 or 1:1',
        characterCount: text.length,
        characterLimit: 280,
      };
    }

    case 'pinterest': {
      const hashtags = ['#collectibles', '#tradingcards', '#ebay', '#vintagecards', '#memorabilia'];
      const caption = `${ctx.title} - Authentic Collectible Listing. ` +
        `Condition: ${gradeStr || ctx.condition}. Listed on eBay with verified authenticity and secure shipping. ` +
        `Click through to shop now! ${hashtags.join(' ')}`;

      return {
        platform: 'pinterest',
        title: ctx.title.slice(0, 100),
        caption,
        hashtags,
        callToAction: 'Visit eBay listing to purchase',
        recommendedAspectRatio: '2:3 Standard Pin (1000x1500)',
        characterCount: caption.length,
        characterLimit: 500,
      };
    }

    case 'youtube_shorts': {
      const hashtags = ['#shorts', '#thehobby', '#collectibles', '#ebay'];
      const caption = `Unboxing & Showcasing: ${ctx.title} 🔥 Available now on eBay! Check description/pinned comment for link. ${hashtags.join(' ')}`;

      return {
        platform: 'youtube_shorts',
        title: `${ctx.title.slice(0, 80)} | eBay Showcase`,
        caption,
        hashtags,
        callToAction: 'Check pinned comment for eBay link',
        recommendedAspectRatio: '9:16 Vertical Video',
        characterCount: caption.length,
        characterLimit: 500,
      };
    }
  }
}

export function generateAllSocialPosts(ctx: ItemListingContext): Record<SocialPlatform, SocialMediaPost> {
  return {
    facebook: generateSocialPost(ctx, 'facebook'),
    instagram: generateSocialPost(ctx, 'instagram'),
    tiktok: generateSocialPost(ctx, 'tiktok'),
    twitter: generateSocialPost(ctx, 'twitter'),
    pinterest: generateSocialPost(ctx, 'pinterest'),
    youtube_shorts: generateSocialPost(ctx, 'youtube_shorts'),
  };
}
