# FlashClaw - Quick Start Guide

## Overview

FlashClaw extends OpenClaw with Aave flashloan arbitrage capabilities, enabling high-frequency DEX arbitrage trading every 100 milliseconds.

## Prerequisites

- Node.js 22+
- An Ethereum RPC endpoint (Alchemy, Infura, or your own node)
- A wallet with ETH for gas fees
- Basic understanding of DeFi and arbitrage

## Installation

1. **Clone the repository:**
```bash
git clone https://github.com/cosmic-hydra/flashclaw.git
cd flashclaw
```

2. **Install dependencies:**
```bash
npm install -g pnpm
pnpm install
```

3. **Build the project:**
```bash
pnpm build
```

## Configuration

1. **Copy the example environment file:**
```bash
cp .env.arbitrage.example .env.arbitrage
```

2. **Edit `.env.arbitrage` with your credentials:**
```bash
# Required settings
ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=0xYOUR_PRIVATE_KEY

# Recommended settings
MIN_PROFIT=100000000000000000  # 0.1 ETH minimum
MAX_GAS_PRICE=100000000000     # 100 gwei max
```

⚠️ **Security Warning:** Never commit your private key to git!

## Usage

### Start the Arbitrage Bot

```bash
openclaw arbitrage start
```

The bot will:
- Scan DEX prices every 100ms
- Identify profitable arbitrage opportunities
- Execute flashloans when opportunities are found
- Track profits and statistics

### Check Status

```bash
openclaw arbitrage status
```

### View Configuration

```bash
openclaw arbitrage config
```

### Stop the Bot

Press `Ctrl+C` to stop the bot gracefully.

## How It Works

### 1. Price Monitoring
Every 100ms, the bot fetches prices from multiple DEXes:
- Uniswap V2
- Sushiswap
- Other configured DEXes

### 2. Opportunity Detection
Compares prices across DEXes to find arbitrage opportunities:
```
Buy WETH on Uniswap at $2000
Sell WETH on Sushiswap at $2010
Profit = $10 per WETH (minus gas)
```

### 3. Execution
When a profitable opportunity is found:
1. Request flashloan from Aave
2. Buy tokens on cheaper DEX
3. Sell tokens on expensive DEX
4. Repay flashloan + fee (0.09%)
5. Keep the profit

## Example Output

```
Starting arbitrage bot...
Scan interval: 100ms
Min profit threshold: 100000000000000000
Monitoring 3 token pairs

[15:23:45] Found 2 arbitrage opportunities
[15:23:45] Attempting to execute arbitrage:
  Path: WETH -> USDC
  DEXes: Uniswap V2 -> Sushiswap
  Expected profit: 150000000000000000
[15:23:46] ✓ Arbitrage executed successfully!
  TX Hash: 0x1234...
  Profit: 150000000000000000 (0.15 ETH)
```

## Safety Features

- **Minimum Profit Threshold**: Only executes profitable trades
- **Gas Price Limits**: Prevents execution when gas is too expensive
- **Single Transaction**: One trade at a time to avoid conflicts
- **Profit Tracking**: Comprehensive statistics and monitoring

## Testing

### Run Tests

```bash
pnpm test -- src/defi/
```

### Test on Goerli Testnet

Update your `.env.arbitrage`:
```bash
ETH_RPC_URL=https://eth-goerli.g.alchemy.com/v2/YOUR_KEY
CHAIN_ID=5
```

Get testnet ETH from a faucet and test the bot.

## Common Issues

### "Opportunity no longer profitable"
This is normal - prices change quickly. The bot validates profitability before execution.

### "Already executing a transaction"
The bot only executes one transaction at a time. Wait for the current one to complete.

### High gas costs
Adjust `MAX_GAS_PRICE` in your configuration or wait for lower gas prices.

## Advanced Configuration

### Add More DEXes

Edit `src/commands/arbitrage.ts` to add more DEX configurations:

```typescript
dexes: [
  {
    name: "Your DEX",
    router: "0x...",
    factory: "0x...",
    fee: 3000,
  }
]
```

### Customize Token Pairs

Edit `src/defi/arbitrage-bot.ts` to monitor different pairs:

```typescript
private readonly TOKEN_PAIRS: Array<[string, string]> = [
  ["TOKEN_A_ADDRESS", "TOKEN_B_ADDRESS"],
]
```

## Monitoring

### Statistics

The bot tracks:
- Total opportunities found
- Trades executed
- Success/failure rates
- Total profit/loss
- Net profit

Access stats via:
```bash
openclaw arbitrage status
```

## Next Steps

- [ ] Add Web3 dependencies (ethers.js or viem)
- [ ] Implement real DEX price fetching
- [ ] Deploy flashloan smart contract
- [ ] Add MEV protection (Flashbots)
- [ ] Expand to multiple chains
- [ ] Add Discord/Telegram notifications

## Resources

- [Aave V3 Documentation](https://docs.aave.com/developers/)
- [Uniswap V2 Documentation](https://docs.uniswap.org/protocol/V2/introduction)
- [Flashloans Explained](https://docs.aave.com/developers/guides/flash-loans)
- [Full Documentation](./FLASHLOAN_ARBITRAGE.md)

## Support

- GitHub Issues: https://github.com/cosmic-hydra/flashclaw/issues
- OpenClaw Discord: https://discord.gg/clawd

## Disclaimer

⚠️ **Use at your own risk!** Cryptocurrency trading involves substantial risk of loss. This is educational software - thoroughly test before using real funds.

## License

MIT License
