# Migration Guide: IP-Safe Client-Side Data Fetching

This guide helps you migrate existing code to the new IP-safe architecture where the server only sends card IDs, and clients fetch full data from Scryfall.

## What Changed?

### Server-Side Changes

**Before (packages/gym-server):**

```typescript
// OLD: Server sent full card data including copyrighted text
export interface CardData {
  instanceId: string;
  scryfallId: string;
  name: string; // ❌ Copyrighted
  manaCost: string;
  cmc: number;
  typeLine: string;
  oracleText: string; // ❌ Copyrighted
  flavorText?: string; // ❌ Copyrighted
  power?: string;
  toughness?: string;
  colors: string[];
  keywords: string[];
}
```

**After:**

```typescript
// NEW: Server only sends IDs - client fetches the rest
export interface CardData {
  instanceId: string;
  scryfallId: string;
  // That's it! Client enriches with Scryfall data
}
```

### Client-Side Changes

**Before (packages/web-client):**

```typescript
// OLD: Card data came pre-populated from server
function CardDisplay({ card }: { card: CardData }) {
  return <div>{card.name}</div>;  // Worked immediately
}
```

**After:**

```typescript
// NEW: Must enrich card data first
import { enrichCard } from '../services/cardEnricher';

function CardDisplay({ card }: { card: CardData }) {
  const [enriched, setEnriched] = useState<CardData>(card);

  useEffect(() => {
    enrichCard(card).then(setEnriched);
  }, [card.scryfallId]);

  return <div>{enriched.name || 'Loading...'}</div>;
}
```

## Migration Steps

### Step 1: Update Server Code

If you have custom endpoints that return card data:

```typescript
// OLD: Loading full card template
function serializeCard(card: CardInstance): CardData {
  const template = CardLoader.getById(card.scryfallId);
  return {
    instanceId: card.instanceId,
    scryfallId: card.scryfallId,
    name: template?.name ?? 'Unknown',
    oracleText: template?.oracle_text ?? '',
    // ... other fields
  };
}

// NEW: Only return IDs
function serializeCard(card: CardInstance): CardData {
  return {
    instanceId: card.instanceId,
    scryfallId: card.scryfallId,
  };
}
```

### Step 2: Update Client Components

Add enrichment to any component that displays card data:

```typescript
// OLD:
export function Hand({ cards }: { cards: CardData[] }) {
  return (
    <div>
      {cards.map(card => (
        <div key={card.instanceId}>
          {card.name} - {card.manaCost}
        </div>
      ))}
    </div>
  );
}

// NEW:
import { enrichCards } from '../services/cardEnricher';

export function Hand({ cards }: { cards: CardData[] }) {
  const [enriched, setEnriched] = useState(cards);

  useEffect(() => {
    enrichCards(cards).then(setEnriched);
  }, [cards]);

  return (
    <div>
      {enriched.map(card => (
        <div key={card.instanceId}>
          {card.name || 'Loading...'} - {card.manaCost || ''}
        </div>
      ))}
    </div>
  );
}
```

### Step 3: Add Prefetching for Better UX

Prefetch cards when a game starts to avoid loading delays:

```typescript
// In your game initialization code
import { prefetchGameCards } from '../services/cardEnricher';

async function startGame() {
  const gameState = await gameService.createGame();

  // Extract all unique Scryfall IDs
  const scryfallIds = extractUniqueScryfallIds(gameState);

  // Prefetch all cards before rendering
  await prefetchGameCards(scryfallIds);

  // Now render game - cards will load instantly from cache
  setGameState(gameState);
}
```

### Step 4: Update Type Definitions

If you have custom types that extend CardData:

```typescript
// OLD:
interface MyCustomCard extends CardData {
  // All fields were required
  customField: string;
}

// NEW:
interface MyCustomCard extends CardData {
  // Card fields are now optional (populated client-side)
  customField: string;
}

// Type guard to check if enriched
function isEnriched(card: CardData): card is Required<CardData> {
  return card.name !== undefined && card.oracleText !== undefined;
}
```

## Common Patterns

### Pattern 1: Loading State

```typescript
function CardComponent({ card }: { card: CardData }) {
  const [enriched, setEnriched] = useState<CardData>(card);
  const [loading, setLoading] = useState(!card.name);

  useEffect(() => {
    if (!card.name) {
      setLoading(true);
      enrichCard(card)
        .then(setEnriched)
        .finally(() => setLoading(false));
    }
  }, [card.scryfallId]);

  if (loading) return <Spinner />;

  return <CardDisplay card={enriched} />;
}
```

### Pattern 2: Error Handling

```typescript
function CardComponent({ card }: { card: CardData }) {
  const [enriched, setEnriched] = useState<CardData>(card);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    enrichCard(card)
      .then(setEnriched)
      .catch(setError);
  }, [card.scryfallId]);

  if (error) {
    return <div>Failed to load card: {error.message}</div>;
  }

  return <CardDisplay card={enriched} />;
}
```

### Pattern 3: Optimistic Rendering

```typescript
function CardComponent({ card }: { card: CardData }) {
  const [enriched, setEnriched] = useState<CardData>(card);

  useEffect(() => {
    // Enrich in background, don't block rendering
    enrichCard(card).then(setEnriched);
  }, [card.scryfallId]);

  // Show scryfallId until enriched
  return (
    <div>
      <h3>{enriched.name || card.scryfallId}</h3>
      {enriched.imageUrl && <img src={enriched.imageUrl} />}
    </div>
  );
}
```

### Pattern 4: Custom Hook

```typescript
// Create a reusable hook
function useEnrichedCard(card: CardData) {
  const [enriched, setEnriched] = useState<CardData>(card);
  const [loading, setLoading] = useState(!card.name);

  useEffect(() => {
    if (!card.name) {
      setLoading(true);
      enrichCard(card)
        .then(setEnriched)
        .finally(() => setLoading(false));
    }
  }, [card.scryfallId]);

  return { card: enriched, loading };
}

// Use it anywhere
function MyComponent({ card }: { card: CardData }) {
  const { card: enriched, loading } = useEnrichedCard(card);

  if (loading) return <Spinner />;
  return <div>{enriched.name}</div>;
}
```

## Testing Changes

### Unit Tests

```typescript
import { enrichCard } from '../services/cardEnricher';

// Mock Scryfall service in tests
jest.mock('../services/scryfallService', () => ({
  getCardById: jest.fn().mockResolvedValue({
    id: 'test-id',
    name: 'Lightning Bolt',
    oracle_text: 'Lightning Bolt deals 3 damage to any target.',
    // ... other fields
  }),
}));

test('enrichCard populates card data', async () => {
  const minimal: CardData = {
    instanceId: 'card_1',
    scryfallId: 'test-id',
  };

  const enriched = await enrichCard(minimal);

  expect(enriched.name).toBe('Lightning Bolt');
  expect(enriched.oracleText).toBe('Lightning Bolt deals 3 damage to any target.');
});
```

### Integration Tests

```typescript
test('game loads with card enrichment', async () => {
  const gameState = await createTestGame();

  // Prefetch cards
  const scryfallIds = gameState.player.hand.map(c => c.scryfallId);
  await prefetchGameCards(scryfallIds);

  // Render game
  render(<GameBoard gameState={gameState} />);

  // Cards should be visible (not loading)
  expect(screen.getByText('Lightning Bolt')).toBeInTheDocument();
});
```

## Troubleshooting

### Issue: "Cards show as undefined"

**Cause:** Component trying to access `card.name` before enrichment
**Fix:** Add null checks or loading states

```typescript
// Bad
<div>{card.name}</div>

// Good
<div>{card.name || 'Loading...'}</div>
```

### Issue: "Too many Scryfall requests"

**Cause:** Not using prefetching or enriching cards multiple times
**Fix:** Prefetch on game start, memoize enrichment

```typescript
// Bad: Enriches on every render
function Hand({ cards }) {
  cards.forEach((card) => enrichCard(card)); // ❌
}

// Good: Enriches once with prefetch
useEffect(() => {
  const ids = cards.map((c) => c.scryfallId);
  prefetchGameCards(ids);
}, [cards]);
```

### Issue: "Images not loading"

**Cause:** Incorrect image URL format
**Fix:** Use scryfallService helper

```typescript
// Bad
<img src={`https://scryfall.com/images/${scryfallId}`} />

// Good
<img src={scryfallService.getImageUrlById(scryfallId, 'normal')} />
```

## Rollback Plan

If you need to temporarily revert to server-side data:

1. Restore old `serializeCard()` function in gym-server
2. Update client CardData interface to make fields required
3. Remove enrichment calls from components

**Note:** This defeats the IP-safety purpose and should only be used for local development, never for deployed instances.

## Benefits of New Architecture

✅ **Legal Safety:** No copyrighted content served from your server  
✅ **Scryfall Compliance:** Client-side caching as intended  
✅ **Better Performance:** Browser caches data permanently  
✅ **Offline Support:** Cached data works without network  
✅ **Flexible Deployment:** Can host on any platform safely

## Questions?

If you encounter migration issues, check:

1. [Card Enrichment Examples](../packages/web-client/examples/card-enrichment-examples.tsx)
2. [Deployment Guide](./DEPLOYMENT_HUGGINGFACE.md)
3. [Web Client README](../packages/web-client/README.md)
