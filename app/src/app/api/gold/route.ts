import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { updateLatestGoldWithSnapshot } from '@/lib/rate-snapshot';

// Default gold price if all else fails
const DEFAULT_GOLD_PRICE_USD = 2650;
const OUNCE_TO_GRAM = 31.1035;

// Fetch gold price from external APIs
async function fetchGoldPriceFromExternal(): Promise<{ priceUsd: number; pricePerGram: number; source: string } | null> {
  try {
    // Try goldrate.com API style endpoint
    const response = await fetch('https://api.metals.live/v1/spot/gold', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.price) {
        const priceUsd = parseFloat(data.price);
        if (!isNaN(priceUsd) && priceUsd > 0) {
          return {
            priceUsd,
            pricePerGram: priceUsd / OUNCE_TO_GRAM,
            source: 'metals-live'
          };
        }
      }
    }
  } catch {
    // Continue to next fallback
  }

  try {
    // Try alternative API
    const response = await fetch('https://api.gold-api.com/api/XAU/USD', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.price) {
        const priceUsd = parseFloat(data.price);
        if (!isNaN(priceUsd) && priceUsd > 0) {
          return {
            priceUsd,
            pricePerGram: priceUsd / OUNCE_TO_GRAM,
            source: 'gold-api'
          };
        }
      }
    }
  } catch {
    // Continue to fallback
  }

  return null;
}

// GET - Fetch gold price
export async function GET() {
  try {
    // Check if we have a recent price in database (less than 1 hour old)
    const existingPrice = await db.goldPrice.findFirst({
      orderBy: { updatedAt: 'desc' }
    });

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    // If we have recent data, return it
    if (existingPrice && existingPrice.updatedAt > oneHourAgo) {
      return NextResponse.json({
        priceUsd: existingPrice.priceUsd,
        pricePerGram: existingPrice.pricePerGram,
        lastUpdated: existingPrice.updatedAt,
        source: 'cache'
      });
    }

    // Try to fetch fresh data
    const freshData = await fetchGoldPriceFromExternal();
    
    if (freshData) {
      // Save to database
      try {
        await updateLatestGoldWithSnapshot(db, {
          priceUsd: freshData.priceUsd,
          pricePerGram: freshData.pricePerGram,
        });
      } catch {
        // Ignore save errors
      }

      return NextResponse.json({
        priceUsd: freshData.priceUsd,
        pricePerGram: freshData.pricePerGram,
        lastUpdated: new Date(),
        source: freshData.source
      });
    }

    // Return existing data even if old, or default
    if (existingPrice) {
      return NextResponse.json({
        priceUsd: existingPrice.priceUsd,
        pricePerGram: existingPrice.pricePerGram,
        lastUpdated: existingPrice.updatedAt,
        source: 'cache-stale'
      });
    }

    // Return default values
    return NextResponse.json({
      priceUsd: DEFAULT_GOLD_PRICE_USD,
      pricePerGram: DEFAULT_GOLD_PRICE_USD / OUNCE_TO_GRAM,
      lastUpdated: new Date(),
      source: 'default'
    });
  } catch (error) {
    console.error('Error in gold price API:', error);
    
    // Return default on any error
    return NextResponse.json({
      priceUsd: DEFAULT_GOLD_PRICE_USD,
      pricePerGram: DEFAULT_GOLD_PRICE_USD / OUNCE_TO_GRAM,
      lastUpdated: new Date(),
      source: 'error-default'
    });
  }
}

// POST - Force refresh gold price
export async function POST() {
  try {
    const freshData = await fetchGoldPriceFromExternal();
    
    let priceUsd = DEFAULT_GOLD_PRICE_USD;
    let pricePerGram = priceUsd / OUNCE_TO_GRAM;
    let source = 'default';

    if (freshData) {
      priceUsd = freshData.priceUsd;
      pricePerGram = freshData.pricePerGram;
      source = freshData.source;
    }

    // Save to database
    try {
      await updateLatestGoldWithSnapshot(db, { priceUsd, pricePerGram });
    } catch {
      // Ignore save errors
    }

    // Update site settings
    try {
      await db.siteSettings.updateMany({
        data: { lastUpdate: new Date() }
      });
    } catch {
      // Ignore
    }

    return NextResponse.json({
      priceUsd,
      pricePerGram,
      lastUpdated: new Date(),
      source
    });
  } catch (error) {
    console.error('Error refreshing gold price:', error);
    return NextResponse.json({
      priceUsd: DEFAULT_GOLD_PRICE_USD,
      pricePerGram: DEFAULT_GOLD_PRICE_USD / OUNCE_TO_GRAM,
      lastUpdated: new Date(),
      source: 'error'
    });
  }
}
