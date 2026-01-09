# Deploying ManaCore to HuggingFace Spaces

This guide explains how to deploy the ManaCore web client to HuggingFace Spaces while maintaining full IP compliance.

## Architecture Overview

### IP-Safe Design

ManaCore uses a **client-side data fetching architecture** to ensure no copyrighted content is distributed from our servers:

```
┌─────────────────┐
│  User Browser   │
└────────┬────────┘
         │
         ├─────────────────┐
         ↓                 ↓
┌──────────────────┐  ┌──────────────────┐
│  HF Space        │  │  Scryfall API    │
│  (gym-server)    │  │  (Official)      │
│                  │  │                  │
│  Sends:          │  │  Sends:          │
│  • scryfallId    │  │  • Card names    │
│  • Game state    │  │  • Oracle text   │
│  • Tapped/damage │  │  • Flavor text   │
│                  │  │  • Card images   │
│  NO text/images! │  │                  │
└──────────────────┘  └──────────────────┘
```

**Key Points:**

- ✅ Server only sends card IDs and game state
- ✅ Client fetches all copyrighted content from Scryfall
- ✅ Browser localStorage caches data for performance
- ✅ 100% compliant with WOTC Fan Content Policy

## What Gets Deployed

### In Your Docker Image:

- ✅ `@manacore/engine` - game rules engine (your code)
- ✅ `@manacore/ai` - bot implementations (your code)
- ✅ `@manacore/gym-server` - REST API server (your code)
- ✅ `@manacore/web-client` - React app (your code)
- ❌ **NO** `6ed.json` file
- ❌ **NO** card images
- ❌ **NO** copyrighted text

### What Users Download:

- Card data → Directly from Scryfall API
- Card images → Directly from Scryfall CDN
- Cached in their browser for subsequent visits

## Implementation Details

### Server-Side (gym-server)

The serialization layer sends minimal data:

```typescript
// packages/gym-server/src/serialization/clientState.ts
export interface CardData {
  instanceId: string;
  scryfallId: string; // ← Only the ID!
  // Client fetches everything else from Scryfall
}
```

### Client-Side (web-client)

The client enriches minimal server data with Scryfall:

```typescript
// packages/web-client/src/services/cardEnricher.ts
import { scryfallService } from './scryfallService';

// Enrich minimal card data with full Scryfall data
export async function enrichCard(card: CardData): Promise<CardData> {
  const scryfallCard = await scryfallService.getCardById(card.scryfallId);

  return {
    ...card,
    name: scryfallCard.name,
    oracleText: scryfallCard.oracle_text,
    imageUrl: scryfallService.getImageUrlById(card.scryfallId),
    // ... other fields from Scryfall
  };
}
```

## Deployment Steps

### 1. Prepare Your Repository

Ensure `.gitignore` excludes copyrighted content:

```gitignore
# Card data (users fetch this locally)
packages/engine/data/cards/6ed.json

# Card images (fetched client-side from Scryfall)
packages/web-client/public/assets/cards/*.jpg
packages/web-client/public/assets/cards/*.png
```

### 2. Build Docker Image

Create a `Dockerfile` that builds both server and client:

```dockerfile
FROM oven/bun:1 AS builder

WORKDIR /app
COPY . .

# Install dependencies
RUN bun install

# Build web client
RUN cd packages/web-client && bun run build

# Build server
RUN cd packages/gym-server && bun run build

FROM oven/bun:1-slim

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/packages/gym-server/dist ./server
COPY --from=builder /app/packages/web-client/dist ./public
COPY --from=builder /app/node_modules ./node_modules

# Expose port
EXPOSE 7860

# Start server (serves both API and static files)
CMD ["bun", "run", "server/index.js"]
```

### 3. Configure HuggingFace Space

Create a `README.md` in your HF Space repo:

```yaml
---
title: ManaCore AI Lab
emoji: 🎴
colorFrom: purple
colorTo: blue
sdk: docker
app_port: 7860
---

# ManaCore: Glass-Box AI Lab for Magic Research

Interactive visualization of AI agents playing Magic: The Gathering.

**Data Sources:**
- Game engine runs in this Space
- Card data fetched client-side from Scryfall API
- No copyrighted content stored or served from this Space
```

### 4. Scryfall API Considerations

**Rate Limiting:**

- Scryfall allows ~10 requests/second
- Our client implements 100ms delays between requests
- LocalStorage caching prevents redundant fetches

**Terms Compliance:**

```typescript
// packages/web-client/src/services/scryfallService.ts
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const minRequestInterval = 100; // Respects Scryfall's guidelines
```

### 5. First Load Experience

**What happens when a user first visits:**

1. Server sends game state with only `scryfallId` fields
2. Client detects missing card data
3. Prefetches all unique cards from Scryfall
4. Shows loading indicator during fetch
5. Caches everything in localStorage
6. **Subsequent visits:** Instant load from cache

**User Experience:**

```
First Visit:     [████████░░] Loading cards... (2-3 seconds)
Second Visit:    [██████████] Instant!
```

## Legal Checklist

Before deploying, verify:

- [ ] `.gitignore` excludes `6ed.json`
- [ ] `.gitignore` excludes card images
- [ ] Server `CardData` interface only has `instanceId` and `scryfallId`
- [ ] Client has `enrichCard()` function that fetches from Scryfall
- [ ] README includes WOTC Fan Content Policy disclaimer
- [ ] README credits Scryfall as data source
- [ ] Docker image does NOT copy copyrighted files

## Monitoring & Analytics

**Track Client-Side Fetches:**

```typescript
// Log cache hits vs misses
scryfallService.on('fetch', (scryfallId) => {
  analytics.track('card_fetched', { scryfallId, cached: false });
});

scryfallService.on('cache_hit', (scryfallId) => {
  analytics.track('card_fetched', { scryfallId, cached: true });
});
```

## Troubleshooting

### "Cards not loading"

- Check browser console for CORS errors
- Verify Scryfall API is accessible
- Check localStorage quota (5-10MB limit in most browsers)

### "Rate limit exceeded"

- Reduce concurrent prefetching
- Increase delay between requests
- Implement exponential backoff

### "Images not displaying"

- Scryfall image URLs are generated deterministically
- Format: `https://cards.scryfall.io/{size}/front/{id[0]}/{id[1]}/{id}.jpg`
- Check network tab for 404s

## Performance Optimization

**Prefetch Strategy:**

```typescript
// On game start, prefetch all unique cards
const scryfallIds = extractUniqueScryfallIds(gameState);
await prefetchGameCards(scryfallIds);
```

**Image Lazy Loading:**

```typescript
// Only fetch images for visible cards
<img
  loading="lazy"
  src={scryfallService.getImageUrlById(card.scryfallId)}
/>
```

## Alternative Deployment Options

### Vercel/Netlify

- Client-side fetching works identically
- Server (gym-server) deployed as serverless functions
- Environment: Node.js 18+

### Self-Hosted

- No changes needed
- Same IP-safe architecture
- Users' browsers still fetch from Scryfall

## Resources

- [Scryfall API Documentation](https://scryfall.com/docs/api)
- [WOTC Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy)
- [HuggingFace Spaces Docs](https://huggingface.co/docs/hub/spaces)

---

**Questions?** Open an issue or discussion in the repository.
