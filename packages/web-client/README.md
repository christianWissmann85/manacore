# @manacore/web-client

Web client package for ManaCore (PixiJS UI)

**Status:** Coming in Phase 1 (Week 8)

## Directory Structure

```
web-client/
├── public/
│   └── assets/
│       └── cards/          # Card images (downloaded via fetch-cards script)
└── src/                    # PixiJS application (Phase 1+)
```

## Card Images

Card images are downloaded locally by running:

```bash
bun run fetch-cards
```

This fetches ~350 card images from Scryfall API and stores them in `public/assets/cards/`.

**Note:** Card images are not committed to git due to size. Run the fetch script after cloning.
