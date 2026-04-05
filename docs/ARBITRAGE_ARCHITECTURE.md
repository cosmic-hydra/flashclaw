# FlashClaw Arbitrage Architecture Guide

This document describes the advanced architecture of the FlashClaw arbitrage bot and contracts, inspired by and improved from the [eth-arbitrage](https://github.com/Devilla/eth-arbitrage) project.

## 📐 System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Advanced Arbitrage Bot                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ Price        │  │ Arbitrage    │  │ Flashloan    │        │
│  │ Scanner      │  │ Opportunity  │  │ Executor     │        │
│  │              │  │ Analyzer     │  │              │        │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │
│         │                 │                 │                 │
│         └────────────┬────┴────────────┬────┘                │
│                      │                 │                      │
│         ┌────────────▼────────────┐   │                      │
│         │ Metrics Collector       │◄──┘                      │
│         │ - Circuit Breaker       │                          │
│         │ - Performance Tracking  │                          │
│         │ - Loss Limit Monitoring │                          │
│         └────────────┬────────────┘                          │
│                      │                                       │
│         ┌────────────▼────────────┐                          │
│         │ Execution Manager       │                          │
│         │ - Multi-opportunity     │                          │
│         │ - Safety Validation     │                          │
│         │ - Gas Optimization      │                          │
│         └────────────┬────────────┘                          │
│                      │                                       │
└──────────────────────┼───────────────────────────────────────┘
                       │
                       │ (Blockchain Interaction)
                       │
┌──────────────────────▼───────────────────────────────────────┐
│            FlashClaw Smart Contracts                          │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────┐        │
│  │ FlashClawArbitrageV2 (Main Contract)             │        │
│  ├──────────────────────────────────────────────────┤        │
│  │ ✓ Aave V3 Flashloan Integration                  │        │
│  │ ✓ Multi-Router Support (DEX Abstraction)         │        │
│  │ ✓ Circuit Breaker Pattern                        │        │
│  │ ✓ Reentrancy Safety (ReentrancyGuard)            │        │
│  │ ✓ Slippage Protection (minAmountsOut)            │        │
│  │ ✓ Comprehensive Event Logging                    │        │
│  │ ✓ Statistics Tracking                            │        │
│  └──────────────────────────────────────────────────┘        │
│                                                               │
│  ┌────────────────────────┐  ┌────────────────────────┐      │
│  │ IDEXRouter (Interface) │  │ IArbitrageOracle       │      │
│  ├────────────────────────┤  │ (Oracle Interface)     │      │
│  │ Abstracts DEX routers  │  ├────────────────────────┤      │
│  │ Plug-and-play support  │  │ Profit calculation     │      │
│  │ for new DEXes          │  │ Validation logic       │      │
│  └────────────────────────┘  └────────────────────────┘      │
│                                                               │
└──────────────────────────────────────────────────────────────┘
                       │
                       │ (Blockchain Events)
                       │
┌──────────────────────▼───────────────────────────────────────┐
│            External Systems                                  │
├──────────────────────────────────────────────────────────────┤
│  • Aave V3 Protocol (Flashloans)                             │
│  • DEX Routers (Uniswap V2, Sushiswap, etc.)               │
│  • RPC Providers (Alchemy, Infura, etc.)                    │
│  • Block Explorers (Etherscan for verification)            │
└──────────────────────────────────────────────────────────────┘
```

## 🔄 Arbitrage Execution Flow

### 1. Scanning Phase (Every 100ms)

```
┌────────┐
│ Start  │
└────┬───┘
     │
     ▼
┌────────────────────────────────────┐
│ PriceScanner.scanPrices()          │
│ - Fetch prices from all DEXes      │
│ - Token pairs: WETH/USDC, etc.    │
└────────┬───────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ PriceScanner.findOpportunities()   │
│ - Compare prices across DEXes      │
│ - Calculate potential profit       │
│ - Estimate gas costs               │
└────────┬───────────────────────────┘
         │
         ▼
    ┌────────────────┐
    │ Opportunities  │
    │ Found?         │
    └───┬──────┬─────┘
        │ YES  │ NO
        │      └─► Continue Scanning
        │
        ▼
┌────────────────────────────────────┐
│ Safety Checks                      │
│ - Circuit breaker active?          │
│ - Loss limit exceeded?             │
│ - Executor ready?                  │
└────────┬───────────────────────────┘
         │
         ▼
    ┌────────────────┐
    │ All Checks     │
    │ Pass?          │
    └───┬──────┬─────┘
        │ YES  │ NO
        │      └─► Log & Skip
        │
        ▼
     Execute Top 3
     Opportunities
```

### 2. Execution Phase (Per Opportunity)

```
┌──────────────────────────────────┐
│ AdvancedArbitrageBot.execute()   │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ Encode arbitrage params      │
│ - Swap path: [WETH, USDC]   │
│ - Routers: [Uni, Sushi]     │
│ - Min amounts (slippage)     │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ FlashloanExecutor.executeArbitrage() │
│ Calls contract.executeArbitrage()    │
└──────┬───────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Blockchain: executeArbitrage()          │
│ - Initiates Aave flashloan              │
└─────────┬───────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────┐
│ Aave Pool: flashLoanSimple()           │
│ - Transfers tokens to contract         │
│ - Calls executeOperation() callback    │
└────────┬───────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Blockchain: executeOperation()        │
│ Flashloan Callback                   │
├──────────────────────────────────────┤
│ 1. Validate caller = Aave Pool      │
│ 2. Decode arbitrage parameters      │
│ 3. Execute token swaps              │
│    - Approve router A               │
│    - Swap on DEX 1                  │
│    - Approve router B               │
│    - Swap on DEX 2                  │
│    - ... (repeat per hop)           │
│ 4. Verify profitability             │
│ 5. Approve flashloan repayment      │
│ 6. Transfer profit to owner         │
│ 7. Emit success event               │
└────────┬─────────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ Aave Pool: Repays itself + fee    │
└────────┬───────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ TypeScript Bot: Record result      │
│ - Update statistics                │
│ - Check circuit breaker            │
│ - Record metrics                   │
└────────┬───────────────────────────┘
         │
         ▼
       Done
```

## 🛡️ Safety Features

### Circuit Breaker Pattern

The system automatically stops execution if:
- **Consecutive Failures** exceed threshold (default: 5)
- **Loss Limit** exceeded (default: 10% drawdown)
- **Manual Override** by operator

Recovery is automatic after configurable cooldown (default: 1 hour).

### Reentrancy Protection

```solidity
contract FlashClawArbitrageV2 is FlashLoanSimpleReceiverBase, ReentrancyGuard {
    function executeArbitrage(...) external ... nonReentrant { ... }
    function executeOperation(...) external override nonReentrant { ... }
}
```

### Slippage Protection

```solidity
// Bot provides minimum amounts for each swap
uint256[] minAmountsOut = [
    100 USDC,  // Min USDC from first swap
    98.5 USDT, // Min USDT from second swap
];

// Contract enforces minimums
require(currentAmount >= minOut, "Slippage exceeded");
```

### Gas Optimization

- Only top 3 opportunities executed (prevents mempool congestion)
- Configurable scan interval (100ms default)
- Batch processing for efficiency
- Gas usage tracking and metrics

## 📊 Metrics and Monitoring

### Real-Time Metrics

```typescript
interface MetricSnapshot {
    timestamp: number
    stats: ArbitrageStats
    memoryUsage: { heapUsed, heapTotal, external }
    activeOpportunities: number
    priceDataPoints: number
}
```

### Performance Analysis

- Profit per hour and per trade
- Success rate tracking
- Profitability rate (successful trades / found opportunities)
- Opportunity detection rate
- Trend analysis (improving/declining/stable)
- Memory usage monitoring

### Auto-Generated Reports

The bot generates hourly performance reports showing:
- Total profit and net profit
- Execution statistics
- Performance rates and trends
- System memory metrics
- Circuit breaker status

## 🏗️ Contract Architecture

### FlashClawArbitrageV2 Components

#### 1. Storage Layer
```solidity
mapping(address => bool) whitelistedRouters;  // Approved DEX routers
uint256 totalArbitragesExecuted;              // Execution counter
uint256 totalProfitCollected;                 // Profit tracking
uint256 consecutiveFailures;                  // Failure tracking
```

#### 2. Execution Layer
```solidity
function executeArbitrage(
    address asset,
    uint256 amount,
    ArbitrageExecution calldata execution
)
```
- Validates parameters
- Initiates flashloan from Aave
- Handles security checks

#### 3. Callback Layer
```solidity
function executeOperation(
    address asset,
    uint256 amount,
    uint256 premium,
    address initiator,
    bytes calldata params
)
```
- Aave flashloan callback
- Executes token swaps
- Records results

#### 4. Safety Layer
```solidity
modifier circuitBreakerActive()    // Prevents execution if tripped
modifier onlyWhitelistedRouters()  // Ensures safe DEX usage
nonReentrant                       // Prevents reentrancy attacks
```

## 🔌 DEX Integration (Plugin Architecture)

### Adding New DEXes

1. **Register Router**
```typescript
const newRouter = "0x...";
await contract.whitelistRouter(newRouter);
```

2. **Implement IDEXRouter Interface**
The router must implement:
```solidity
interface IDEXRouter {
    function getAmountsOut(...) returns (uint[]);
    function swapExactTokensForTokens(...) returns (uint[]);
}
```

3. **Use in Bot**
```typescript
dexes: [
    {
        name: "NewDEX",
        router: "0x...",
        factory: "0x...",
        fee: 3000
    }
]
```

## 📈 Performance Considerations

### Scan Interval Optimization

- **100ms** (default): High-frequency scanning, higher gas costs
- **500ms**: Balanced approach
- **1000ms**: Lower frequency, lower costs but fewer opportunities

### Opportunity Filtering

Only execute if:
- Profit after gas **≥ minimum threshold**
- Within top 3 by profitability
- Circuit breaker not tripped
- Executor ready

### Gas Efficiency

- Batch multiple swaps in single callback
- Reuse token approvals where possible
- Minimize state updates
- Track gas per execution

## 🚀 Deployment & Configuration

### Network Support

- **Ethereum Mainnet** (chainId: 1)
- **Arbitrum One** (chainId: 42161)
- **Optimism** (chainId: 10)
- **Base** (chainId: 8453)

Each network has pre-configured Aave addresses.

### Environment Setup

```bash
# Blockchain
ETH_RPC_URL=https://...
PRIVATE_KEY=0x...

# Deployment
FORK_NETWORK=true  # Fork mainnet for testing
REPORT_GAS=true    # Generate gas report

# Trading
MIN_PROFIT=100000000000000000  # 0.1 ETH
MAX_GAS_PRICE=100000000000     # 100 gwei
SCAN_INTERVAL=100              # milliseconds
```

## 📚 Key Improvements Over eth-arbitrage

| Feature | eth-arbitrage | FlashClaw |
|---------|---------------|-----------|
| **Flashloan** | DyDx (older) | Aave V3 (current) |
| **Multi-Router** | Limited | Full abstraction |
| **Safety** | Basic | Circuit breaker + loss limits |
| **Monitoring** | None | Real-time metrics & reports |
| **Gas Optimization** | Basic | Advanced with tracking |
| **Multi-Execution** | Single | Top 3 concurrent |
| **Reentrancy** | Manual checks | ReentrancyGuard |
| **Event Logging** | Minimal | Comprehensive |
| **Tests** | Basic | Full test suite |
| **Deployment** | Simple script | Hardhat + multi-chain |

## 🔍 Debugging & Monitoring

### Enable Detailed Logging

```typescript
// In bot configuration
const bot = new AdvancedArbitrageBot(config, {
    maxConsecutiveFailures: 3,  // Lower threshold
    cooldownMs: 30000,          // Faster recovery
    enableLossLimit: true,
    maxDrawdownPercent: 5       // Tighter limits
});
```

### Monitor in Real-Time

```typescript
// Get performance metrics
const metrics = bot.getMetricsCollector().getPerformanceMetrics();
console.log(`Profit/hour: ${metrics.profitPerHour}`);
console.log(`Success rate: ${metrics.successRate}%`);

// Get circuit breaker status
const cbStatus = bot.getCircuitBreakerStatus();
console.log(`Breaker tripped: ${cbStatus.tripped}`);

// Generate report
console.log(bot.getPerformanceReport());
```

## 📝 Contract Events

All significant actions emit events:

```solidity
event ArbitrageExecuted(
    address indexed asset,
    uint256 amount,
    uint256 profit,
    uint256 gasUsed,
    uint256 timestamp
);

event CircuitBreakerTripped(
    uint256 failureCount,
    uint256 timestamp
);

event RouterWhitelisted(
    address indexed router,
    uint256 timestamp
);
```

Use events for:
- Off-chain monitoring
- Analytics and reporting
- Real-time alerts
- Blockchain indexers

## 🔐 Security Considerations

1. **Private Key Management**: Never commit keys, use env variables
2. **Gas Limits**: Set conservative limits to prevent excessive loss
3. **Profit Thresholds**: Higher minimums = fewer false positives
4. **Circuit Breaker**: Fast failure detection prevents cascading losses
5. **Slippage Protection**: Always use min amounts for swaps
6. **Router Whitelisting**: Only use tested, audited routers
7. **Permission Checks**: Contract only executes from owner

## 📖 Further Reading

- [Aave V3 Documentation](https://docs.aave.com/)
- [Uniswap V2 Documentation](https://docs.uniswap.org/protocol/V2/introduction)
- [Solidity Best Practices](https://solidity.readthedocs.io/)
- [Flash Loans Security](https://docs.aave.com/developers/guides/flash-loans)

---

**Last Updated**: April 2026
**Version**: 2.0 (Advanced with Circuit Breaker & Metrics)
