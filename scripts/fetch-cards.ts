#!/usr/bin/env bun

/**
 * Fetch card data from Scryfall API for 6th Edition
 *
 * This script:
 * 1. Fetches all 6th Edition cards from Scryfall
 * 2. Downloads card images locally
 * 3. Caches card data in packages/engine/data/cards/6ed.json
 * 4. Respects Scryfall's rate limiting (100ms between requests)
 */

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ScryfallScraper } from '../packages/data-scraper/src/scraper';
import type { CachedCard } from '../packages/data-scraper/src/types';

async function main() {
  const scraper = new ScryfallScraper();

  // Setup paths
  const dataDir = join(process.cwd(), 'packages/engine/data/cards');
  const imagesDir = join(process.cwd(), 'packages/web-client/public/assets/cards');

  // Create directories if they don't exist
  await mkdir(dataDir, { recursive: true });
  await mkdir(imagesDir, { recursive: true });

  console.log('📦 ManaCore Card Fetcher');
  console.log('========================\n');

  // Fetch cards from Scryfall
  console.log('Step 1: Fetching card data from Scryfall API...\n');
  const allCards = await scraper.fetchSet('6ed');

  // Filter to English only
  const englishCards = scraper.filterEnglishCards(allCards);
  console.log(`\n🌍 Filtered to ${englishCards.length} English cards`);

  // Download images and create cached card data
  console.log('\nStep 2: Downloading card images...\n');
  const cachedCards: CachedCard[] = [];
  let downloadedCount = 0;

  for (let i = 0; i < englishCards.length; i++) {
    const card = englishCards[i]!;
    const imageFilename = scraper.getImageFilename(card);
    const imageUri = scraper.getImageUri(card, 'normal');

    // Progress indicator
    if ((i + 1) % 10 === 0) {
      console.log(`  Progress: ${i + 1}/${englishCards.length} cards`);
    }

    if (imageUri) {
      try {
        const imagePath = join(imagesDir, imageFilename);
        await scraper.downloadImage(imageUri, imagePath);
        downloadedCount++;
      } catch (error) {
        console.warn(`  ⚠️  Failed to download image for ${card.name}: ${error}`);
      }
    } else {
      console.warn(`  ⚠️  No image URI for ${card.name}`);
    }

    // Convert to cached format
    cachedCards.push(scraper.toCachedCard(card, imageFilename));
  }

  console.log(`\n✅ Downloaded ${downloadedCount} card images`);

  // Save card data to JSON
  console.log('\nStep 3: Saving card data...\n');
  const outputPath = join(dataDir, '6ed.json');
  await scraper.saveCardsToFile(cachedCards, outputPath);

  // Summary
  console.log('\n✨ Done!\n');
  console.log('Summary:');
  console.log(`  • Total cards: ${cachedCards.length}`);
  console.log(`  • Images downloaded: ${downloadedCount}`);
  console.log(`  • Data saved to: ${outputPath}`);
  console.log(`  • Images saved to: ${imagesDir}`);

  // Statistics
  const cardsByType = cachedCards.reduce(
    (acc, card) => {
      const mainType = card.type_line.split('—')[0]?.trim().split(' ')[0] || 'Other';
      acc[mainType] = (acc[mainType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  console.log('\nCard Types:');
  for (const [type, count] of Object.entries(cardsByType).sort((a, b) => b[1] - a[1])) {
    console.log(`  • ${type}: ${count}`);
  }
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
