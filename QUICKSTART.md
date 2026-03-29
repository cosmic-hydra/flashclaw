# FlashClaw - Quick Start Guide

## Overview

FlashClaw is a high-frequency DeFi arbitrage bot that scans multiple DEXes every 100 milliseconds for profitable arbitrage opportunities and executes them using Aave V5 flashloans.

## Prerequisites

- Node.js 22+
- An Ethereum RPC endpoint (Alchemy, Infura, or your own node)
- A wallet with ETH for gas fees
- Aave V5 pool contract address
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

1. **Edit the `.env` file in the root directory:**

The `.env` file is already created for you. You need to fill in these required fields:

```bash
# Required: Your profit wallet address (where profits will be sent)
PROFIT_WALLET_ADDRESS=0xYourWalletAddress

# Required: Your wallet secret key for signing transactions
WALLET_SECRET_KEY=0xYourPrivateKey

# Required: Aave V5 Pool address for flashloans
AAVE_V5_POOL_ADDRESS=0xAaveV5PoolAddress

# Required: Ethereum RPC endpoint
ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
```

2. **Optional settings (already have defaults):**

```bash
# Scan interval in milliseconds (default: 100)
SCAN_INTERVAL=100

# Minimum profit threshold in wei (default: 0.01 ETH)
MIN_PROFIT=10000000000000000

# Maximum gas price in wei (default: 100 gwei)
MAX_GAS_PRICE=100000000000
```

⚠️ **Security Warning:** Never commit your `.env` file to git! It's already in `.gitignore`.

## Usage

### Start the Arbitrage Bot

```bash
flashclaw arbitrage start
```

The bot will:
- Load configuration from `.env` file
- Validate all required settings
- Scan DEX prices every 100ms (or your configured interval)
- Identify profitable arbitrage opportunities
- Execute Aave V5 flashloans automatically when opportunities are found
- Send profits to your configured wallet address
- Track statistics in real-time

### Check Status

```bash
flashclaw arbitrage status
```

### View Configuration

```bash
flashclaw arbitrage config
```

### Stop the Bot

Press `Ctrl+C` to stop the bot gracefully.

## How It Works

### 1. Price Monitoring (100ms intervals)
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

### 3. Aave V5 Flashloan Execution
When a profitable opportunity is found:
1. Request flashloan from Aave V5 Pool
2. Buy tokens on cheaper DEX
3. Sell tokens on expensive DEX
4. Repay flashloan + fee
5. Send profit to your PROFIT_WALLET_ADDRESS

## Example Output

```
Starting arbitrage bot...
Configuration loaded from .env
Profit wallet: 0x1234...
Scan interval: 100ms
Aave V5 Pool: 0xAave...
Monitoring 3 token pairs

[15:23:45] Found 2 arbitrage opportunities
[15:23:45] Attempting to execute arbitrage:
  Path: WETH -> USDC
  DEXes: Uniswap V2 -> Sushiswap
  Expected profit: 150000000000000000
[15:23:46] ✓ Arbitrage executed successfully!
  TX Hash: 0x1234...
  Profit: 0.15 ETH sent to 0x1234...
```

## Safety Features

- **Minimum Profit Threshold**: Only executes profitable trades
- **Gas Price Limits**: Prevents execution when gas is too expensive
- **Single Transaction**: One trade at a time to avoid conflicts
- **Profit Tracking**: Comprehensive statistics and monitoring
- **Aave V5 Support**: Uses latest Aave protocol for flashloans

## Testing

### Run Tests

```bash
pnpm test -- src/defi/
```

### Test on Testnet

Update your `.env`:
```bash
ETH_RPC_URL=https://eth-goerli.g.alchemy.com/v2/YOUR_KEY
CHAIN_ID=5
AAVE_V5_POOL_ADDRESS=0xTestnetPoolAddress
```

Get testnet ETH from a faucet and test the bot.

## Common Issues

### "WALLET_SECRET_KEY not set in .env file!"
You need to add your private key to the `.env` file.

### "AAVE_V5_POOL_ADDRESS not set in .env file!"
You need to add the Aave V5 pool contract address to the `.env` file.

### "Opportunity no longer profitable"
This is normal - prices change quickly. The bot validates profitability before execution.

### High gas costs
Adjust `MAX_GAS_PRICE` in your `.env` file or wait for lower gas prices.

## Advanced Configuration

### Add More DEXes

Edit environment variables in `.env`:

```bash
# Add custom DEX routers
CUSTOM_DEX_ROUTER=0x...
CUSTOM_DEX_FACTORY=0x...
```

Then update `src/commands/arbitrage.ts` to use them.

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
flashclaw arbitrage status
```

## Resources

- [Aave V5 Documentation](https://docs.aave.com/developers/)
- [Uniswap V2 Documentation](https://docs.uniswap.org/protocol/V2/introduction)
- [Flashloans Explained](https://docs.aave.com/developers/guides/flash-loans)
- [Full Documentation](./FLASHLOAN_ARBITRAGE.md)

## Support

- GitHub Issues: https://github.com/cosmic-hydra/flashclaw/issues

## Disclaimer

⚠️ **Use at your own risk!** Cryptocurrency trading involves substantial risk of loss. This is educational software - thoroughly test before using real funds.

## License

MIT License
