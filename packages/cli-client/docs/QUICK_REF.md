# Quick Reference: Reproducibility & Debugging

## 🎲 Seed Management

```bash
# Use specific seed
--seed 12345

# Default: timestamp (still reproducible!)
# Output shows: 🎲 Base Seed: 1736123456789
```

## 🔄 Replay Failed Games

```bash
# When you see an error:
Error in game 39:
  Seed: 12383

# Replay it:
bun src/index.ts replay 12383 --verbose
```

## 📊 Common Workflows

### Debug a Failure
```bash
# 1. See the error
bun src/index.ts benchmark 100
# Error in game 39, Seed: 12383

# 2. Replay with details
bun src/index.ts replay 12383 --verbose

# 3. Deep debug
bun src/index.ts replay 12383 --verbose --debug
```

### Test a Fix
```bash
# Before fix
bun src/index.ts replay 12383
# ❌ Error

# After fix
bun src/index.ts replay 12383
# ✅ Success

# Verify across range
bun src/index.ts benchmark 100 --seed 12300
```

### Compare Strategies
```bash
# Same opponents = fair comparison
bun src/index.ts benchmark 1000 --seed 42
# Strategy A: 61% win rate

bun src/index.ts benchmark 1000 --seed 42
# Strategy B: 59% win rate
```

## 🧪 CI/CD Testing

```bash
# Regression test suite
bun src/index.ts replay 12383  # Known edge case
bun src/index.ts replay 15672  # Another test
bun src/index.ts benchmark 100 --seed 42  # Full suite
```

## 💡 Pro Tips

✅ **Always note the base seed** from output
✅ **Use fixed seeds in tests** for determinism
✅ **Replay failures immediately** while fresh
✅ **Document problematic seeds** in your notes

❌ Don't forget to check the seed output
❌ Don't run tests without seeds for comparisons

---

**Need Help?** See [RESEARCH_GUIDE.md](./RESEARCH_GUIDE.md) for full details
