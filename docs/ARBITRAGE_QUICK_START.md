# FlashClaw Arbitrage Bot - Quick Start Guide

## Overview

FlashClaw is an **advanced DeFi arbitrage bot** that:
- 🔄 Scans multiple DEXes every **100 milliseconds**
- ⚡ Executes **Aave V3 flashloans** for capital-free arbitrage
- 🛡️ Implements **circuit breaker pattern** for safety
- 📊 Tracks **real-time metrics** and performance
- 💰 Executes **top 3 opportunities** to maximize profits
- 🔒 Protects against **slippage** and **reentrancy**

## Quick Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Configuration

Create a `.env` file:

```bash
# Blockchain RPC endpoint
ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Your wallet private key (KEEP SECURE!)
PRIVATE_KEY=0xYourPrivateKeyHere

# Optional: Gas settings
MAX_GAS_PRICE=100000000000  # 100 gwei
GAS_LIMIT=500000

# Profit threshold (in wei)
MIN_PROFIT=100000000000000000  # 0.1 ETH

# Optional: Hardhat forking for testing
FORK_NETWORK=true
REPORT_GAS=true
```

### 3. Deploy Smart Contract

```bash
# Deploy to Ethereum mainnet
npx hardhat run scripts/deploy.ts --network mainnet

# Or test locally with hardhat node
npx hardhat node
# In another terminal:
npx hardhat run scripts/test-deploy.ts --network localhost
```

### 4. Run the Bot

**Using the original bot:**
```bash
pnpm tsx examples/arbitrage-bot-example.mts
```

**Using the advanced bot with safety features:**
```bash
pnpm tsx examples/advanced-arbitrage-bot-example.mts
```

## Architecture Overview

### Smart Contracts

#### FlashClawArbitrageV2 (Latest - Recommended)
```
✅ Aave V3 flashloans
✅ Circuit breaker pattern
✅ Multi-router support
✅ Reentrancy protection
✅ Detailed event logging
✅ Statistics tracking
```

**Key Features:**
- Whitelisted router system for safety
- Automatic failure recovery
- Loss limit protection (max 10% drawdown)
- Comprehensive event logging for monitoring
- Gas optimization

#### FlashClawArbitrage (V1 - Legacy)
- Basic Aave V3 integration
- Single opportunity execution
- Minimal safety features

### TypeScript Bot Layers

1. **PriceScanner**
   - Fetches prices from multiple DEXes
   - Identifies arbitrage opportunities
   - Calculates gas costs

2. **FlashloanExecutor**
   - Constructs flashloan parameters
   - Submits transactions to chain
   - Monitors execution

3. **AdvancedArbitrageBot**
   - Multi-opportunity execution
   - Circuit breaker management
   - Loss limit monitoring
   - Multi-threaded scanning

4. **MetricsCollector**
   - Real-time performance tracking
   - Historical data retention
   - Trend analysis
   - Report generation

## Safety Features

### Circuit Breaker ⛔

Automatically stops execution when:
- **5 consecutive failures** (configurable)
- **10% loss from peak** profit (configurable)
- Manual operator override

Auto-recovers after **1 hour** cooldown (configurable).

### Slippage Protection 🛡️

```typescript
// Each swap requires minimum output
minAmountsOut: [
    100 USDC,  // Minimum from first swap
    98 USDT    // Minimum from second swap
]
```

### Reentrancy Protection

Uses `ReentrancyGuard` to prevent nested calls.

### Gas Optimization

- Only executes top 3 profitable opportunities
- Configurable scan interval (100ms default)
- Gas tracking per execution
- Profit/gas ratio analysis

## Configuration Examples

### Conservative (Low Risk)

```typescript
{
    scanInterval: 1000,      // Slower scanning
    minProfitThreshold: BigInt(10 ** 18), // 1.0 ETH minimum
    maxGasPrice: BigInt(50) * BigInt(10 ** 9), // 50 gwei max
    circuitBreaker: {
        maxConsecutiveFailures: 3,
        maxDrawdownPercent: 5   // Very tight loss limit
    }
}
```

### Aggressive (Higher Risk, Higher Potential Return)

```typescript
{
    scanInterval: 100,      // Fast scanning
    minProfitThreshold: BigInt(10 ** 16), // 0.01 ETH minimum
    maxGasPrice: BigInt(200) * BigInt(10 ** 9), // 200 gwei max
    circuitBreaker: {
        maxConsecutiveFailures: 10,
        maxDrawdownPercent: 20  // Wider loss limit
    }
}
```

## Monitoring

### Live Statistics

The bot displays every 30 seconds:
- Opportunities found vs executed
- Success and profitability rates
- Current net profit
- Circuit breaker status
- Memory usage

### Performance Reports

Every 5 minutes, the bot generates:
```
╔════════════════════════════════════════════╗
║      Arbitrage Bot Performance Report      ║
╚════════════════════════════════════════════╝

📊 Runtime Statistics
├─ Uptime: 2.35 hours
├─ Total Opportunities: 487
├─ Executed Trades: 12
├─ Successful Trades: 11
└─ Failed Trades: 1

💰 Profit Metrics
├─ Total Profit: 2.1542 ETH
├─ Profit/Hour: 0.916583 ETH
├─ Profit/Trade: 0.195854 ETH
└─ Trend: increasing (+5.2%)

...
```

## Troubleshooting

### Issue: No opportunities found
- ✅ Check RPC endpoint is valid
- ✅ Check token pairs are on your network
- ✅ Verify DEX liquidity
- ✅ Check gas price vs profit threshold

### Issue: Circuit breaker constantly tripping
- ✅ Increase `maxConsecutiveFailures`
- ✅ Increase `maxDrawdownPercent`
- ✅ Check flashloan fee calculations
- ✅ Verify slippage protection isn't too strict

### Issue: Slow execution
- ✅ Increase `scanInterval` (reduce from 100ms)
- ✅ Use Arbitrum/Optimism instead of Ethereum mainnet
- ✅ Check RPC provider rate limits
- ✅ Reduce number of token pairs monitored

### Issue: High gas costs
- ✅ Increase `minProfitThreshold`
- ✅ Increase `MAX_GAS_PRICE` limit
- ✅ Monitor network congestion
- ✅ Use Layer 2 (Arbitrum, Optimism, Base)

## Testing

### Run Contract Tests

```bash
# Test FlashClawArbitrageV2
npx hardhat test test/FlashClawArbitrageV2.test.ts

# Test with gas reporting
REPORT_GAS=true npx hardhat test
```

### Run Integration Tests

```bash
# Test with mainnet fork
FORK_NETWORK=true npx hardhat test
```

### Dry Run (No Real Execution)

The bot includes a dry-run mode - modify the executor to only log operations without actually sending transactions.

## Deployment to Production

### Step 1: Security Review
- [ ] Audit smart contracts
- [ ] Test on testnet first
- [ ] Review slippage parameters
- [ ] Set conservative loss limits

### Step 2: Contract Deployment
```bash
npx hardhat run scripts/deploy.ts --network mainnet
```

### Step 3: Whitelist Routers
```bash
# The deployment script does this automatically
# But you can also manually whitelist additional routers:
npx hardhat run scripts/whitelist-routers.ts --network mainnet
```

### Step 4: Bot Startup
```bash
# Start with monitoring
pnpm tsx examples/advanced-arbitrage-bot-example.mts
```

### Step 5: Monitor
- Check performance reports every 5 minutes
- Set up alerts for circuit breaker trips
- Monitor profit/loss tracking
- Review gas spending vs profits

## Advanced Topics

### Adding New DEXes

1. **Verify the DEX implements Uniswap V2-compatible router**
   ```solidity
   interface IDEXRouter {
       function getAmountsOut(uint amountIn, address[] memory path) 
           external view returns (uint[] memory);
       function swapExactTokensForTokens(...) external;
   }
   ```

2. **Whitelist the router**
   ```typescript
   await contract.whitelistRouter("0x<new-router-address>");
   ```

3. **Add to bot configuration**
   ```typescript
   dexes: [
       {
           name: "NewDEX",
           router: "0x<router-address>",
           factory: "0x<factory-address>",
           fee: 3000
       }
   ]
   ```

### Customizing Metrics

```typescript
// Extend MetricsCollector for custom metrics
class CustomMetricsCollector extends MetricsCollector {
    recordCustomMetric(name: string, value: number) {
        // Your implementation
    }
}
```

### Multi-Chain Deployment

The contracts support:
- Ethereum Mainnet (chainId: 1)
- Arbitrum One (chainId: 42161)
- Optimism (chainId: 10)
- Base (chainId: 8453)

Deploy to any network:
```bash
npx hardhat run scripts/deploy.ts --network arbitrum
```

## Resources

- 📚 [Architecture Guide](../docs/ARBITRAGE_ARCHITECTURE.md)
- 🔗 [Aave V3 Docs](https://docs.aave.com/)
- 🌀 [Uniswap V2 Docs](https://docs.uniswap.org/protocol/V2/introduction)
- 📖 [Solidity Docs](https://docs.soliditylang.org/)
- 🏗️ [Hardhat Docs](https://hardhat.org/docs)

## License

MIT - See LICENSE file

## Support

For issues, questions, or improvements:
1. Check [ARBITRAGE_ARCHITECTURE.md](../docs/ARBITRAGE_ARCHITECTURE.md)
2. Review example files in `examples/`
3. Check test files in `test/`
4. Open an issue with detailed error logs

---

**Happy Arbitraging! 🦞⚡💰**
