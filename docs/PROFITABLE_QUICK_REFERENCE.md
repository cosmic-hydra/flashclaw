# Quick Reference: Profitable-Only Bot Configuration

## TL;DR - Quick Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Set environment variables
export ETH_RPC_URL="https://..."
export PRIVATE_KEY="0x..."
export MAX_GAS_PRICE=100000000000  # 100 gwei

# 3. Run the profitable bot
pnpm tsx examples/profitable-only-bot-example.mts
```

---

## Configuration Presets

### ⚡ Aggressive (Most Trades)
```typescript
minProfitThreshold: BigInt(10 ** 16),      // 0.01 ETH
minProfitPercentage: 0.05,                 // 0.05%
maxGasPrice: BigInt(150) * BigInt(10 ** 9) // 150 gwei
```
**Use when:** Gas is cheap, want high frequency
**Trade count:** Highest
**Profit per trade:** Lower
**Risk:** Medium

### 🎯 Balanced (Recommended)
```typescript
minProfitThreshold: BigInt(5 * 10 ** 16),  // 0.05 ETH
minProfitPercentage: 0.2,                  // 0.2%
maxGasPrice: BigInt(100) * BigInt(10 ** 9) // 100 gwei
```
**Use when:** Normal market conditions
**Trade count:** Medium
**Profit per trade:** Medium
**Risk:** Low-Medium

### 🛡️ Conservative (Safe)
```typescript
minProfitThreshold: BigInt(10 ** 17),      // 0.1 ETH
minProfitPercentage: 0.5,                  // 0.5%
maxGasPrice: BigInt(50) * BigInt(10 ** 9)  // 50 gwei
```
**Use when:** Gas is expensive, want high profit margins
**Trade count:** Lowest
**Profit per trade:** Highest
**Risk:** Lowest

---

## Cost Calculation Cheat Sheet

### Aave Flashloan Fee
```
Fee = Amount × 0.0005
Examples:
- 1 ETH   → 0.0005 ETH fee
- 10 ETH  → 0.005 ETH fee
- 100 ETH → 0.05 ETH fee
```

### Gas Cost (with 20% buffer)
```
Gas Cost = Gas Used × 1.2 × Gas Price (gwei) × 10^9

Typical 500k gas transaction:
- At 30 gwei: 500k × 1.2 × 30 × 10^9 = 0.018 ETH
- At 50 gwei: 500k × 1.2 × 50 × 10^9 = 0.03 ETH
- At 100 gwei: 500k × 1.2 × 100 × 10^9 = 0.06 ETH
- At 200 gwei: 500k × 1.2 × 200 × 10^9 = 0.12 ETH
```

### Total Costs
```
Total = Flashloan Fee + Gas Cost

Example (1 ETH at 50 gwei gas):
- Fee: 0.0005 ETH
- Gas: 0.03 ETH
- Total: 0.0305 ETH
```

---

## Profitability Check

### Quick Math
```
CAN EXECUTE IF:
1. Gross Profit > Total Costs
2. Net Profit ≥ Min Threshold
3. Gas Price ≤ Max Gas Price
4. All of the above are TRUE

EXECUTION: Only if ALL 4 pass
```

### Real Example
```
Arbitrage finds:
Initial: 1 ETH
Final: 1.004 ETH
Gas: 50 gwei

Calculate:
- Gross profit: 0.004 ETH
- Flashloan fee: 0.0005 ETH
- Gas cost: 0.03 ETH
- Total costs: 0.0305 ETH
- Net profit: -0.0265 ETH ❌

Result: DO NOT EXECUTE (would lose money)

What if final was 1.0405 ETH instead?
- Gross profit: 0.0405 ETH
- Total costs: 0.0305 ETH
- Net profit: 0.01 ETH ✓

Result: EXECUTE (profit of $30)
```

---

## Commands Reference

### Start the Profitable Bot
```bash
pnpm tsx examples/profitable-only-bot-example.mts
```

### Update Gas Price Limit at Runtime
```typescript
bot.updateGasLimit(BigInt(75) * BigInt(10 ** 9)) // 75 gwei
```

### Update Profit Threshold at Runtime
```typescript
bot.updateProfitThreshold(BigInt(8 * 10 ** 16)) // 0.08 ETH
```

### Get Current Stats
```typescript
const stats = bot.getStats()
console.log(`Successful trades: ${stats.successfulTrades}`)
console.log(`Total profit: ${(Number(stats.totalProfit) / 1e18).toFixed(6)} ETH`)
console.log(`Failed trades: ${stats.failedTrades}`)
console.log(`Guarantee met: ${stats.failedTrades === 0 ? "✓ YES" : "✗ NO"}`)
```

---

## Common Issues

### Issue: No trades executing

**Check:**
1. Are opportunities being found? (Check scan logs)
2. Is gas price too high? (Check gas price vs maxGasPrice)
3. Are profit margins too small? (Increase initial capital for larger opportunities)

**Solution:**
```typescript
// Lower thresholds temporarily
bot.updateProfitThreshold(BigInt(10 ** 16)) // 0.01 ETH
bot.updateGasLimit(BigInt(150) * BigInt(10 ** 9)) // 150 gwei
```

### Issue: Many opportunities filtered

**This is GOOD!** The bot is protecting you from unprofitable trades.

Check the logs to see why:
- Gas too high
- Profit margins too small
- Network congestion (wait for better conditions)

### Issue: Very slow execution

**Likely cause:** Waiting for profitable opportunities (which is safe!)

**Options:**
1. Lower minimum profit threshold
2. Increase initial capital
3. Monitor more token pairs
4. Wait for better market conditions

---

## Safety Checklist

Before deploying to production:

- [ ] Gas limits are set correctly for your comfort level
- [ ] Minimum profit threshold reflects your risk tolerance
- [ ] RPC endpoint is reliable
- [ ] Private key is secured (never commit to repo)
- [ ] DEX routers are verified and whitelisted
- [ ] Flashloan parameters are correct for your network
- [ ] Test with small amounts first
- [ ] Monitor first trades carefully
- [ ] Set up alerts for failures
- [ ] Understand all costs (flashloan fee + gas)

---

## Real-Time Monitoring

Bot displays every 30 seconds:
```
--- 📊 Live Statistics ---
Time: 14:32:45

Opportunities:
  Scanned: 1,234
  Executed: 3
  Successful: 3 ✓

Profitability:
  Total Profit: 0.085 ETH
  Profit/Trade: 0.0283 ETH
  All Trades Profitable: ✓ YES
```

---

## Keys to Success

1. **Don't chase losses** - If profit is low, skip the trade
2. **Wait for gas to drop** - Never overpay for execution
3. **Monitor trends** - Some networks/times have more arbitrage
4. **Adjust thresholds** - React to market conditions
5. **Review logs** - Understand why trades were skipped
6. **Start small** - Test with 0.1 ETH before going bigger
7. **Keep it simple** - One good strategy > many mediocre ones

---

## Guaranteed Profit Formula

```
NET PROFIT = (Final Amount - Initial Amount) 
             - (Flashloan Fee)
             - (Gas Cost with Buffer)
             - Slippage allowance

IF: NET PROFIT > Minimum Threshold  →  EXECUTE ✓
IF: NET PROFIT ≤ Minimum Threshold  →  SKIP ✗

GUARANTEE: Only execute if NET PROFIT is positive
```

---

**Remember: Better to skip 100 marginal trades and execute 1 guaranteed profitable trade, than execute 100 trades with 50% failure rate!** 🎯
