# FlashClaw Production Roadmap

## Current Status: NOT PRODUCTION READY ⚠️

**Critical Warning**: The current FlashClaw implementation is **99% legacy OpenClaw code** with only **stub implementations** of the arbitrage functionality. Running this bot with real funds will **result in zero trades** (since price fetching returns 0) but will **not lose money** as transaction execution is also stubbed.

## Problem Analysis

### 1. Code Bloat (99% Waste)
- **Total Size**: 328,155 LOC across 3,083 files
- **Core Arbitrage**: ~36KB (0.01% of codebase)
- **Waste**: 99.99% legacy OpenClaw features unrelated to arbitrage

### 2. Missing Core Functionality
- ❌ No actual Web3 integration (ethers.js not used)
- ❌ No real DEX price fetching (hardcoded to 0)
- ❌ No transaction signing or submission
- ❌ No realistic gas estimation
- ❌ No slippage protection
- ❌ No MEV protection

### 3. Safety Issues
- ❌ No dry-run / simulation mode
- ❌ No circuit breakers
- ❌ No max loss protection
- ❌ No rate limiting
- ❌ No transaction approval guards

---

## Phase 1: Remove Waste (Target: 50x Size Reduction)

**Goal**: Reduce from 328KB → 10-20KB by removing all legacy OpenClaw infrastructure

### Directories to Delete:
```bash
# Messaging Channels (1.3MB) - PURE WASTE
rm -rf src/channels/

# AI Agent Infrastructure (9.4MB) - PURE WASTE
rm -rf src/agents/

# Auto-Reply System (3.7MB) - PURE WASTE
rm -rf src/auto-reply/

# Plugin System (4.1MB) - PURE WASTE
rm -rf src/plugin-sdk/
rm -rf src/plugins/

# UI & Apps (20MB+) - PURE WASTE
rm -rf ui/
rm -rf apps/  # iOS, Android, macOS
rm -rf extensions/  # 89 plugin packages (3GB+)

# Gateway Infrastructure (4.5MB) - PURE WASTE
rm -rf src/gateway/

# Media & Context (1.2MB) - PURE WASTE
rm -rf src/media/
rm -rf src/media-understanding/
rm -rf src/image-generation/
rm -rf src/context-engine/

# Other Unnecessary Features
rm -rf src/tui/
rm -rf src/web-search/
rm -rf src/pairing/
rm -rf src/dashboard/
rm -rf src/flows/
rm -rf src/cron/
rm -rf src/sessions/
rm -rf src/tasks/
rm -rf src/wizard/
rm -rf src/infra/
rm -rf src/acp/
rm -rf src/daemon/
rm -rf src/hooks/
rm -rf src/canvas-host/
rm -rf src/chat/
rm -rf src/process/
rm -rf src/node-host/
rm -rf src/routing/
rm -rf src/tts/
rm -rf src/secrets/
rm -rf src/security/
rm -rf src/markdown/

# Remove all commands except arbitrage
cd src/commands/
ls *.ts | grep -v arbitrage | grep -v index | xargs rm -f

# Remove docs for deleted features
rm -rf docs/channels/
rm -rf docs/plugins/
rm -rf docs/gateway/
rm -rf docs/agents/

# Remove unnecessary root directories
rm -rf .pi/
rm -rf .agent/
rm -rf .agents/
rm -rf skills/
rm -rf Swabble/
rm -rf packages/
rm -rf examples/
rm -rf assets/
rm -rf git-hooks/
rm -rf patches/
```

### Files to Keep:
```
src/defi/              # Core arbitrage module
src/commands/arbitrage.ts  # CLI command
src/config/            # Minimal config (simplified)
src/cli/               # Minimal CLI (simplified)
src/terminal/          # Terminal output utilities
src/utils/             # Basic utilities
src/logging/           # Basic logging
contracts/             # Solidity contracts
docs/                  # Arbitrage docs only
test/                  # Core tests
.env.arbitrage.example # Configuration template
README.md
QUICKSTART.md
FLASHLOAN_ARBITRAGE.md
package.json           # Cleaned up
```

---

## Phase 2: Implement Web3 Integration

### 2.1 Add Dependencies
```bash
pnpm add ethers@^6.9.0
pnpm add dotenv
pnpm add @aave/protocol-v3-periphery
```

### 2.2 Implement Real Price Scanner (`src/defi/price-scanner.ts`)

**Key Changes**:
```typescript
import { ethers } from "ethers"

export class PriceScanner {
	private provider: ethers.Provider
	private UNISWAP_V2_PAIR_ABI = [
		"function getReserves() external view returns (uint112, uint112, uint32)",
		"function token0() external view returns (address)",
		"function token1() external view returns (address)",
	]

	constructor(rpcUrl: string, dexConfigs: DEXConfig[]) {
		this.provider = new ethers.JsonRpcProvider(rpcUrl)
		this.dexConfigs = dexConfigs
	}

	async getPriceFromDEX(dex: DEXConfig, tokenA: string, tokenB: string) {
		// 1. Calculate pair address using Uniswap V2 CREATE2
		const pairAddress = this.calculatePairAddress(
			dex.factory,
			tokenA,
			tokenB
		)

		// 2. Get reserves from pair contract
		const pairContract = new ethers.Contract(
			pairAddress,
			this.UNISWAP_V2_PAIR_ABI,
			this.provider
		)

		const [reserve0, reserve1] = await pairContract.getReserves()

		// 3. Calculate price
		const price = (reserve1 * 10n**18n) / reserve0

		return { price, liquidity: min(reserve0, reserve1) }
	}

	async estimateGasCost(): Promise<bigint> {
		// Get REAL gas price from network
		const feeData = await this.provider.getFeeData()
		const gasPrice = feeData.gasPrice || 50n * 10n**9n

		// Realistic gas estimate: flashloan ~150k + 2 swaps ~300k = 450k
		const gasEstimate = 450000n

		return gasEstimate * gasPrice
	}
}
```

**Test**: Verify fetches real Uniswap V2 prices on mainnet/testnet

---

### 2.3 Implement Real Flashloan Executor (`src/defi/flashloan-executor.ts`)

**Key Changes**:
```typescript
import { ethers } from "ethers"

export class FlashloanExecutor {
	private wallet: ethers.Wallet
	private aavePool: ethers.Contract
	private arbitrageContract: ethers.Contract

	constructor(config: Config) {
		this.wallet = new ethers.Wallet(
			config.privateKey,
			new ethers.JsonRpcProvider(config.rpcUrl)
		)

		this.aavePool = new ethers.Contract(
			config.aave.pool,
			AAVE_POOL_ABI,
			this.wallet
		)

		this.arbitrageContract = new ethers.Contract(
			config.arbitrageContract,
			ARBITRAGE_ABI,
			this.wallet
		)
	}

	async executeArbitrage(opportunity: ArbitrageOpportunity) {
		// 1. Encode arbitrage path
		const params = ethers.AbiCoder.defaultAbiCoder().encode(
			["address[]", "address[]", "uint256"],
			[opportunity.path, opportunity.dexRouters, opportunity.amountIn]
		)

		// 2. Call Aave flashLoan
		const tx = await this.aavePool.flashLoan(
			this.arbitrageContract.address,  // receiver
			[opportunity.tokenIn],            // assets
			[opportunity.amountIn],           // amounts
			[0],                              // modes (0 = no debt)
			this.wallet.address,              // onBehalfOf
			params,                           // params
			0                                 // referralCode
		)

		// 3. Wait for confirmation
		const receipt = await tx.wait()

		// 4. Calculate actual profit
		const profit = await this.calculateProfit(receipt)

		return {
			success: receipt.status === 1,
			txHash: receipt.hash,
			profit
		}
	}
}
```

**Test**: Deploy to testnet, execute dry-run transactions

---

## Phase 3: Add Simulation & Safety Features

### 3.1 Dry-Run Mode

**Implementation**: Add `--dry-run` flag that simulates transactions without broadcasting

```typescript
async executeDryRun(opportunity: ArbitrageOpportunity) {
	// Use eth_call to simulate transaction without gas cost
	const callData = this.arbitrageContract.interface.encodeFunctionData(
		"executeArbitrage",
		[/* params */]
	)

	const result = await this.provider.call({
		to: this.arbitrageContract.address,
		data: callData
	})

	// Decode result to see if profitable
	return this.decodeResult(result)
}
```

### 3.2 Circuit Breaker

**Implementation**: Stop trading if losses exceed threshold

```typescript
class CircuitBreaker {
	private maxDailyLoss: bigint
	private currentDailyLoss: bigint = 0n
	private lastResetTime: number = Date.now()

	checkAndUpdate(profit: bigint): boolean {
		// Reset daily counter
		if (Date.now() - this.lastResetTime > 86400000) {
			this.currentDailyLoss = 0n
			this.lastResetTime = Date.now()
		}

		// Track losses
		if (profit < 0n) {
			this.currentDailyLoss += -profit
		}

		// Trip circuit breaker if max loss exceeded
		if (this.currentDailyLoss >= this.maxDailyLoss) {
			console.error("🚨 CIRCUIT BREAKER TRIPPED - Max daily loss reached!")
			return false  // Stop trading
		}

		return true  // Continue trading
	}
}
```

### 3.3 Rate Limiting

**Implementation**: Prevent transaction spam

```typescript
class RateLimiter {
	private lastExecutionTime: number = 0
	private minInterval: number = 5000  // 5 seconds minimum between trades

	canExecute(): boolean {
		const now = Date.now()
		if (now - this.lastExecutionTime < this.minInterval) {
			return false
		}
		this.lastExecutionTime = now
		return true
	}
}
```

### 3.4 Profit Validation (Multi-Layer)

**Implementation**: Verify profitability at every step

```typescript
async validateProfitability(opportunity: ArbitrageOpportunity): Promise<boolean> {
	// Layer 1: Static calculation check
	if (opportunity.profitAfterGas <= 0n) return false

	// Layer 2: Current gas price check
	const currentGasPrice = await this.provider.getFeeData()
	const currentGasCost = opportunity.gasEstimate * currentGasPrice.gasPrice
	if (opportunity.expectedProfit <= currentGasCost) return false

	// Layer 3: Slippage simulation (3% buffer)
	const slippageBuffer = opportunity.expectedProfit * 3n / 100n
	if (opportunity.expectedProfit <= currentGasCost + slippageBuffer) return false

	// Layer 4: Dry-run simulation
	const simulatedProfit = await this.simulateArbitrage(opportunity)
	if (simulatedProfit <= 0n) return false

	return true  // All checks passed
}
```

---

## Phase 4: Testing Infrastructure

### 4.1 Integration Tests with Hardhat

```bash
pnpm add -D hardhat @nomicfoundation/hardhat-ethers
```

**Test Setup**:
```typescript
import { ethers } from "hardhat"

describe("FlashClaw Arbitrage", () => {
	let aavePool, uniswapRouter, sushiswapRouter, arbitrageContract

	beforeEach(async () => {
		// Deploy mock Aave pool
		aavePool = await deployMockAavePool()

		// Deploy mock DEX routers
		uniswapRouter = await deployMockUniswapRouter()
		sushiswapRouter = await deployMockSushiswapRouter()

		// Deploy arbitrage contract
		arbitrageContract = await deployArbitrageContract()
	})

	it("should execute profitable arbitrage", async () => {
		// Set price difference: Uniswap 1000, Sushiswap 1100
		await uniswapRouter.setPrice(1000)
		await sushiswapRouter.setPrice(1100)

		// Execute arbitrage
		const result = await executeArbitrage(...)

		expect(result.profit).to.be.greaterThan(0)
	})

	it("should reject unprofitable arbitrage", async () => {
		// Set equal prices
		await uniswapRouter.setPrice(1000)
		await sushiswapRouter.setPrice(1000)

		// Should not execute
		const result = await findOpportunities()
		expect(result.length).to.equal(0)
	})

	it("should respect gas limits", async () => {
		// Set max gas price to 50 gwei
		const bot = new ArbitrageBot({ maxGasPrice: 50n * 10n**9n })

		// Simulate 200 gwei gas price
		await ethers.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x2E90EDD000"])

		// Should not execute due to high gas
		const executed = await bot.checkAndExecute(opportunity)
		expect(executed).to.be.false
	})
})
```

### 4.2 Profit Calculation Tests

```typescript
describe("Profit Calculation", () => {
	it("should accurately calculate profit after gas", async () => {
		const scanner = new PriceScanner(...)

		const opportunity = {
			buyPrice: 1000n * 10n**18n,
			sellPrice: 1100n * 10n**18n,
			amount: 10n * 10n**18n,  // 10 ETH
		}

		const gasEstimate = 450000n
		const gasPrice = 50n * 10n**9n

		const expectedProfit = (10n * 10n**18n * 100n) / 1000n  // 1 ETH profit
		const gasCost = 450000n * 50n * 10n**9n  // 0.0225 ETH gas
		const netProfit = expectedProfit - gasCost  // ~0.9775 ETH

		const calculated = await scanner.calculateProfit(opportunity)

		expect(calculated).to.equal(netProfit)
	})

	it("should account for slippage", async () => {
		// Test with 1% slippage reduces profit
	})

	it("should reject when gas cost exceeds profit", async () => {
		// Test high gas price scenario
	})
})
```

---

## Phase 5: Production Hardening

### 5.1 Error Recovery

**Implementation**:
```typescript
class TransactionMonitor {
	async executeWithRetry(fn: () => Promise<any>, maxRetries = 3) {
		for (let i = 0; i < maxRetries; i++) {
			try {
				return await fn()
			} catch (error) {
				if (this.isRecoverable(error) && i < maxRetries - 1) {
					console.warn(`Retry ${i+1}/${maxRetries}:`, error.message)
					await this.backoff(i)
					continue
				}
				throw error
			}
		}
	}

	private isRecoverable(error: any): boolean {
		const recoverableErrors = [
			"nonce too low",
			"replacement transaction underpriced",
			"timeout",
			"network error",
		]
		return recoverableErrors.some(msg => error.message.includes(msg))
	}

	private async backoff(attempt: number) {
		await new Promise(resolve =>
			setTimeout(resolve, 1000 * 2**attempt)  // Exponential backoff
		)
	}
}
```

### 5.2 Transaction Logging

**Implementation**:
```typescript
interface TradeLog {
	timestamp: number
	txHash: string
	tokenIn: string
	tokenOut: string
	amountIn: bigint
	expectedProfit: bigint
	actualProfit: bigint
	gasUsed: bigint
	gasCost: bigint
	success: boolean
	error?: string
}

class TradeLogger {
	private logs: TradeLog[] = []

	async logTrade(trade: TradeLog) {
		this.logs.push(trade)

		// Persist to file
		await fs.appendFile(
			"trades.jsonl",
			JSON.stringify(trade) + "\n"
		)

		// Alert if loss
		if (trade.actualProfit < 0n) {
			this.alertLoss(trade)
		}
	}

	getStats(): ArbitrageStats {
		return {
			totalTrades: this.logs.length,
			successful: this.logs.filter(t => t.success).length,
			totalProfit: this.logs.reduce((sum, t) => sum + t.actualProfit, 0n),
			winRate: this.logs.filter(t => t.actualProfit > 0n).length / this.logs.length
		}
	}
}
```

### 5.3 Real-Time Alerting

**Implementation**:
```typescript
class AlertSystem {
	async alert(severity: "info" | "warning" | "critical", message: string, data?: any) {
		const alert = {
			severity,
			message,
			data,
			timestamp: new Date().toISOString()
		}

		console.log(`[${severity.toUpperCase()}]`, message, data)

		// Critical alerts could be sent via:
		// - Telegram bot
		// - Discord webhook
		// - Email
		// - SMS (Twilio)
		// - PagerDuty

		if (severity === "critical") {
			await this.sendTelegram(message, data)
		}
	}
}
```

### 5.4 MEV Protection

**Implementation**: Integrate Flashbots

```typescript
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle"

class MEVProtectedExecutor {
	private flashbotsProvider: FlashbotsBundleProvider

	async init() {
		this.flashbotsProvider = await FlashbotsBundleProvider.create(
			this.provider,
			this.wallet,
			"https://relay.flashbots.net"
		)
	}

	async executePrivate(opportunity: ArbitrageOpportunity) {
		// Send transaction as Flashbots bundle to avoid front-running
		const tx = await this.buildTransaction(opportunity)

		const bundle = [
			{
				signer: this.wallet,
				transaction: tx
			}
		]

		const bundleSubmission = await this.flashbotsProvider.sendBundle(
			bundle,
			targetBlockNumber
		)

		return bundleSubmission.wait()
	}
}
```

---

## Phase 6: Clean Up Dependencies

### 6.1 Current package.json (BLOATED)

```json
{
  "dependencies": {
    // 100+ dependencies from OpenClaw
    "@anthropic-ai/sdk": "...",
    "@clack/prompts": "...",
    // ... many unused packages
  }
}
```

### 6.2 Target package.json (LEAN)

```json
{
  "name": "flashclaw",
  "version": "2.0.0",
  "description": "Production-grade DeFi arbitrage bot with Aave flashloans",
  "main": "dist/index.js",
  "bin": {
    "flashclaw": "dist/cli.js"
  },
  "dependencies": {
    "ethers": "^6.9.0",
    "dotenv": "^16.3.1",
    "@aave/protocol-v3-periphery": "^1.0.0",
    "commander": "^11.0.0",
    "chalk": "^5.3.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vitest": "^1.0.0",
    "hardhat": "^2.19.0",
    "@nomicfoundation/hardhat-ethers": "^3.0.0",
    "@types/node": "^20.0.0"
  }
}
```

**Target**: ~10 production dependencies (down from 100+)

---

## Expected Final State

### Metrics
```
Metric                    | Before    | After     | Change
--------------------------|-----------|-----------|--------
Total LOC                 | 328,155   | ~15,000   | -95%
Number of Files           | 3,083     | ~50       | -98%
Dependencies              | 100+      | ~10       | -90%
Build Size                | 25MB+     | ~2MB      | -92%
Boot Time                 | 5s        | <0.5s     | -90%
```

### Directory Structure
```
flashclaw/
├── src/
│   ├── defi/
│   │   ├── price-scanner.ts       # ✅ Real Web3 integration
│   │   ├── flashloan-executor.ts  # ✅ Real tx signing
│   │   ├── arbitrage-bot.ts       # ✅ Main orchestration
│   │   ├── circuit-breaker.ts     # ✅ Safety
│   │   ├── rate-limiter.ts        # ✅ Safety
│   │   └── types.ts
│   ├── cli.ts                     # Minimal CLI
│   └── utils/                     # Minimal utilities
├── contracts/
│   └── FlashClawArbitrage.sol     # ✅ Already good
├── test/
│   ├── integration/
│   │   ├── arbitrage.test.ts      # ✅ Hardhat tests
│   │   └── profit-calc.test.ts
│   └── unit/
│       ├── price-scanner.test.ts
│       └── executor.test.ts
├── docs/
│   ├── README.md
│   ├── QUICKSTART.md
│   └── PRODUCTION.md
├── .env.example
├── package.json                   # ✅ Lean dependencies
└── tsconfig.json
```

---

## Security Checklist

Before Production Deployment:

- [ ] **Private Key Security**
  - [ ] Use hardware wallet or secure key management
  - [ ] Never commit private keys
  - [ ] Rotate keys regularly
  - [ ] Consider multi-sig for large amounts

- [ ] **Transaction Safety**
  - [ ] All transactions go through dry-run simulation first
  - [ ] Circuit breaker active (max daily loss limit)
  - [ ] Rate limiting enforced (max 1 tx per 5 seconds)
  - [ ] Gas price caps enforced
  - [ ] Profit validation in multiple layers

- [ ] **MEV Protection**
  - [ ] Flashbots integration for private transactions
  - [ ] No mempool exposure for large trades

- [ ] **Monitoring**
  - [ ] Real-time alerting for losses
  - [ ] Transaction logging to persistent storage
  - [ ] Daily profit/loss reports
  - [ ] Gas efficiency tracking

- [ ] **Testing**
  - [ ] All integration tests passing on testnet
  - [ ] Profit calculations verified accurate
  - [ ] Gas estimation verified accurate
  - [ ] Edge cases covered (slippage, failed tx, etc.)

- [ ] **Operational**
  - [ ] Error recovery and retry logic tested
  - [ ] Graceful shutdown implemented
  - [ ] State persistence (don't lose data on restart)
  - [ ] Backup RPC providers configured

---

## Estimated Timeline

| Phase | Tasks | Time | Difficulty |
|-------|-------|------|------------|
| 1. Remove Waste | Delete 99% of code | 2 hours | Easy |
| 2. Web3 Integration | Real price fetching + tx execution | 1 week | Medium |
| 3. Safety Features | Dry-run, circuit breaker, rate limit | 3 days | Medium |
| 4. Testing | Integration tests with Hardhat | 1 week | Hard |
| 5. Production Hardening | MEV, monitoring, error recovery | 1 week | Hard |
| 6. Deployment & Testing | Testnet validation | 1 week | Medium |

**Total**: ~4-5 weeks for production-ready implementation

---

## Success Criteria

**DO NOT deploy to mainnet until**:

✅ All integration tests pass on testnet (Goerli/Sepolia)
✅ Dry-run mode validates profitability accurately
✅ Circuit breaker tested and working
✅ At least 100 successful test trades on testnet
✅ Gas estimation within 5% of actual
✅ Profit calculation within 2% of actual
✅ No false positives (unprofitable trades flagged as profitable)
✅ MEV protection validated
✅ Error recovery tested
✅ Security audit completed

---

## Current vs. Target Comparison

### Current State (Stub Implementation)
```typescript
// ❌ Current: Returns hardcoded 0
async fetchDEXPrice(dex, tokenA, tokenB) {
	const price = 0n  // TODO: Implement
	return price
}

// ❌ Current: Returns fake tx hash
async executeArbitrage(opportunity) {
	console.log("Would execute...")
	return { txHash: "0x" + "0".repeat(64) }
}
```

### Target State (Production Implementation)
```typescript
// ✅ Target: Real Web3 queries
async fetchDEXPrice(dex, tokenA, tokenB) {
	const pairContract = new ethers.Contract(pairAddress, ABI, provider)
	const [reserve0, reserve1] = await pairContract.getReserves()
	return (reserve1 * 10n**18n) / reserve0
}

// ✅ Target: Real transaction execution
async executeArbitrage(opportunity) {
	// Dry-run first
	const simulation = await this.simulate(opportunity)
	if (!simulation.profitable) return { success: false }

	// Execute via Flashbots
	const tx = await this.flashbotsProvider.sendBundle([...])
	const receipt = await tx.wait()

	// Log result
	await this.logger.log({ txHash: receipt.hash, profit: ... })

	return { success: true, txHash: receipt.hash, profit: ... }
}
```

---

## Bottom Line

**FlashClaw is currently a well-documented stub** with good structure but no real functionality. To make it production-ready:

1. **Delete 99% of the code** (legacy OpenClaw bloat)
2. **Implement Web3 integration** (ethers.js + real DEX queries)
3. **Add safety features** (dry-run, circuit breaker, rate limits)
4. **Test extensively** (Hardhat integration tests + testnet validation)
5. **Harden for production** (MEV protection, monitoring, error recovery)

**Estimated effort**: 4-5 weeks of focused development + testing.

**DO NOT run on mainnet** until all success criteria are met. The current implementation will not lose money (because it won't execute any trades), but it also won't make money (because all prices are hardcoded to 0).
