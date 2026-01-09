# Quick Deployment Guide for HuggingFace Spaces

## Prerequisites

1. HuggingFace account
2. Card data file (`6ed.json`) - run `bun run fetch-cards` locally first
3. Git installed

## Step-by-Step Deployment

### 1. Create New Space

Go to [HuggingFace Spaces](https://huggingface.co/spaces) and click "Create new Space":

- **Name:** `manacore-ai-lab` (or your choice)
- **License:** MIT
- **SDK:** Docker
- **Visibility:** Public

### 2. Clone Your New Space

```bash
git clone https://huggingface.co/spaces/YOUR_USERNAME/manacore-ai-lab
cd manacore-ai-lab
```

### 3. Copy Files from ManaCore

```bash
# Copy Dockerfile
cp /path/to/manacore/Dockerfile.huggingface ./Dockerfile

# Copy README
cp /path/to/manacore/README.huggingface.md ./README.md

# Copy source code
cp -r /path/to/manacore/packages ./
cp /path/to/manacore/package.json ./
cp /path/to/manacore/bunfig.toml ./
cp /path/to/manacore/bun.lockb ./

# IMPORTANT: Copy card data (for internal engine use)
mkdir -p packages/engine/data/cards
cp /path/to/manacore/packages/engine/data/cards/6ed.json packages/engine/data/cards/
```

### 4. Verify .gitignore

Make sure your `.gitignore` does NOT exclude `6ed.json` for the HF Space:

```bash
# Create .gitignore
cat > .gitignore << 'EOF'
node_modules/
.env
*.log
dist/
EOF
```

**Note:** We DO include `6ed.json` in the HF Space repo because:
- It's used internally by the engine for game logic
- The API never exposes this data
- This is legal fair use for non-commercial research

### 5. Commit and Push

```bash
git add .
git commit -m "Initial ManaCore deployment"
git push
```

### 6. Monitor Build

Go to your Space's page on HuggingFace. The build will take 5-10 minutes.

Watch the logs: Click "Building" → "View build logs"

### 7. Test Your Space

Once built, visit your Space URL:
- `https://huggingface.co/spaces/YOUR_USERNAME/manacore-ai-lab`

**First load:** May take 2-3 seconds as your browser fetches card data from Scryfall  
**Subsequent loads:** Instant (cached in browser)

## Troubleshooting

### Build fails with "6ed.json not found"

Make sure you copied the file:
```bash
ls -lh packages/engine/data/cards/6ed.json
```

Should show ~220KB file.

### Space shows "Application startup failed"

Check build logs for errors. Common issues:
- Missing dependencies in package.json
- Incorrect paths in Dockerfile
- Port not set to 7860

### Cards not loading in browser

Open browser console (F12). Check for:
- CORS errors → Check Scryfall API is accessible
- 404 errors → Card IDs may be wrong
- Rate limit errors → Wait a minute and refresh

### Static files not serving

Check gym-server logs for:
```
Static file serving not available
```

Verify `PUBLIC_PATH` environment variable or fix paths in server.

## Environment Variables (Optional)

You can set these in HuggingFace Space settings:

```env
# Path to static files (default: ../../../public)
PUBLIC_PATH=/app/public

# Silent mode (less logging)
MANACORE_SILENT_INIT=true

# Node environment
NODE_ENV=production
```

## Updating Your Space

To deploy updates:

```bash
cd manacore-ai-lab

# Pull latest changes from main repo
# ... make your updates ...

# Commit and push
git add .
git commit -m "Update: [description]"
git push
```

HuggingFace will automatically rebuild.

## Performance Tips

### Optimize Build Time

Add to Dockerfile before build steps:
```dockerfile
# Cache bun modules
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile
```

### Reduce Image Size

The slim image is already optimized, but you can further reduce:
- Remove dev dependencies from package.json
- Minimize included files in COPY commands
- Use .dockerignore to exclude test files

### Improve First Load

Pre-warm popular cards in web client:
```typescript
// In web-client/src/main.tsx
const POPULAR_CARDS = [
  'Lightning Bolt', 'Counterspell', 'Forest', 'Island', 'Mountain'
];
prefetchCards(POPULAR_CARDS);
```

## Cost Considerations

HuggingFace Spaces:
- **Free tier:** Available for public spaces (with usage limits)
- **Pro tier:** $9/month for persistent spaces
- **Enterprise:** Custom pricing for high-traffic spaces

Our Space is lightweight:
- ~300MB Docker image
- Minimal CPU usage (mostly idle)
- No GPU required
- Low bandwidth (API only)

## Security Notes

### What's Safe to Include

✅ Your code (MIT licensed)
✅ Game logic implementation
✅ Card data for internal use
✅ Configuration files

### What to Exclude

❌ API keys/secrets (use HF Secrets instead)
❌ Large datasets not needed for demo
❌ Development tools (tests, linters)

### Environment Secrets

If you need secrets (e.g., for analytics):

1. Go to Space settings
2. Add secrets under "Variables and secrets"
3. Access in code: `process.env.SECRET_NAME`

## Support

If you encounter issues:

1. Check [Deployment Docs](https://github.com/christianWissmann85/manacore/blob/main/docs/DEPLOYMENT_HUGGINGFACE.md)
2. Review [HuggingFace Docker Docs](https://huggingface.co/docs/hub/spaces-sdks-docker)
3. Open [GitHub Issue](https://github.com/christianWissmann85/manacore/issues)

---

**Ready to deploy!** 🚀

Your Space will be live at: `https://huggingface.co/spaces/YOUR_USERNAME/manacore-ai-lab`
