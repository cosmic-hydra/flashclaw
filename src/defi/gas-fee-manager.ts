/**
 * Gas Fee Manager
 * Manages gas prices, limits, and ensures cost-effective execution
 */

export interface GasLimitConfig {
	maxGasPrice: bigint // Maximum gas price (wei per gas)
	maxTotalGasSpend: bigint // Maximum total gas spend per transaction (wei)
	maxGasPercentage: number // Max gas cost as percentage of profit
	scalingFactor: number // Scale down profit if gas is high (0-1)
}

export interface GasMarketData {
	baseGasPrice: bigint
	priorityFee: bigint
	maxFeePerGas: bigint
	timestamp: number
	confidence: string // "low", "standard", "fast", "instant"
}

export class GasFeeManager {
	private limits: GasLimitConfig
	private currentMarketData: GasMarketData | null = null
	private gasHistory: GasMarketData[] = []
	private maxHistorySize = 100

	constructor(limits?: Partial<GasLimitConfig>) {
		this.limits = {
			maxGasPrice: BigInt(200) * BigInt(10 ** 9), // 200 gwei
			maxTotalGasSpend: BigInt(10 ** 18), // 1 ETH max per tx
			maxGasPercentage: 50, // Max 50% of profit
			scalingFactor: 1.0,
			...limits,
		}
	}

	/**
	 * Update current market gas data
	 */
	updateMarketData(data: GasMarketData): void {
		this.currentMarketData = data
		this.gasHistory.push(data)

		// Keep history size manageable
		if (this.gasHistory.length > this.maxHistorySize) {
			this.gasHistory.shift()
		}
	}

	/**
	 * Check if current gas price is within acceptable limits
	 */
	isGasPriceAcceptable(gasPrice?: bigint): boolean {
		const price = gasPrice || this.currentMarketData?.baseGasPrice
		if (!price) return false
		return price <= this.limits.maxGasPrice
	}

	/**
	 * Check if total gas spend would be within limits
	 */
	isGasSpendAcceptable(
		estimatedGas: bigint,
		gasPrice?: bigint,
	): boolean {
		const price = gasPrice || this.currentMarketData?.baseGasPrice
		if (!price) return false

		const totalCost = estimatedGas * price
		return totalCost <= this.limits.maxTotalGasSpend
	}

	/**
	 * Calculate how much profit would be "consumed" by gas costs
	 * Returns the profit ratio after gas deduction
	 */
	calculateProfitAfterGas(
		grossProfit: bigint,
		estimatedGas: bigint,
		gasPrice?: bigint,
	): { netProfit: bigint; consumed: number } {
		const price = gasPrice || this.currentMarketData?.baseGasPrice
		if (!price) {
			return { netProfit: grossProfit, consumed: 0 }
		}

		const gasCost = estimatedGas * price
		const netProfit = grossProfit > gasCost ? grossProfit - gasCost : 0n
		const consumed = Number(gasCost) / Number(grossProfit)

		return { netProfit, consumed: Math.min(consumed, 1) }
	}

	/**
	 * Determine if we should execute based on gas costs vs profit
	 * Returns false if gas would consume too much of the profit
	 */
	shouldExecuteBasedOnGas(
		grossProfit: bigint,
		estimatedGas: bigint,
		gasPrice?: bigint,
	): { execute: boolean; reason: string } {
		const price = gasPrice || this.currentMarketData?.baseGasPrice
		if (!price) {
			return { execute: false, reason: "No gas price data available" }
		}

		// Check absolute price limit
		if (price > this.limits.maxGasPrice) {
			return {
				execute: false,
				reason: `Gas price ${(Number(price) / 1e9).toFixed(2)} gwei exceeds limit ${(Number(this.limits.maxGasPrice) / 1e9).toFixed(2)} gwei`,
			}
		}

		// Check total spend limit
		const totalCost = estimatedGas * price
		if (totalCost > this.limits.maxTotalGasSpend) {
			return {
				execute: false,
				reason: `Total gas cost ${(Number(totalCost) / 1e18).toFixed(6)} ETH exceeds limit ${(Number(this.limits.maxTotalGasSpend) / 1e18).toFixed(6)} ETH`,
			}
		}

		// Check gas percentage of profit
		const gasPercentage = (Number(totalCost) / Number(grossProfit)) * 100
		if (gasPercentage > this.limits.maxGasPercentage) {
			return {
				execute: false,
				reason: `Gas cost is ${gasPercentage.toFixed(2)}% of profit (limit: ${this.limits.maxGasPercentage}%)`,
			}
		}

		return {
			execute: true,
			reason: `Gas cost check passed (${gasPercentage.toFixed(2)}% of profit)`,
		}
	}

	/**
	 * Get estimated gas with safety buffer
	 */
	getEstimatedGasWithBuffer(
		baseGasEstimate: bigint,
		bufferPercentage: number = 20, // 20% buffer by default
	): bigint {
		const buffer = (Number(baseGasEstimate) * bufferPercentage) / 100
		return BigInt(Math.ceil(Number(baseGasEstimate) + buffer))
	}

	/**
	 * Calculate total transaction cost including gas
	 */
	calculateTransactionCost(
		estimatedGas: bigint,
		flashFee: bigint,
		gasPrice?: bigint,
	): bigint {
		const price = gasPrice || this.currentMarketData?.baseGasPrice
		if (!price) return 0n

		const gasCost = estimatedGas * price
		return flashFee + gasCost
	}

	/**
	 * Update gas limits
	 */
	updateLimits(limits: Partial<GasLimitConfig>): void {
		this.limits = { ...this.limits, ...limits }
	}

	/**
	 * Get current limits
	 */
	getLimits(): GasLimitConfig {
		return { ...this.limits }
	}

	/**
	 * Get average gas price from history
	 */
	getAverageGasPrice(): bigint {
		if (this.gasHistory.length === 0) return 0n

		const sum = this.gasHistory.reduce(
			(acc, data) => acc + data.baseGasPrice,
			0n,
		)
		return sum / BigInt(this.gasHistory.length)
	}

	/**
	 * Get median gas price from history
	 */
	getMedianGasPrice(): bigint {
		if (this.gasHistory.length === 0) return 0n

		const sorted = [...this.gasHistory]
			.map((d) => d.baseGasPrice)
			.sort((a, b) => (a < b ? -1 : 1))

		const mid = Math.floor(sorted.length / 2)
		if (sorted.length % 2 === 0) {
			return (sorted[mid - 1] + sorted[mid]) / 2n
		}
		return sorted[mid]
	}

	/**
	 * Get gas price trend
	 */
	getGasPriceTrend(): "increasing" | "decreasing" | "stable" {
		if (this.gasHistory.length < 2) return "stable"

		const recent = this.gasHistory.slice(-10)
		const early = recent[0].baseGasPrice
		const late = recent[recent.length - 1].baseGasPrice

		const change = Number(late) / Number(early)
		if (change > 1.05) return "increasing"
		if (change < 0.95) return "decreasing"
		return "stable"
	}

	/**
	 * Should we wait for better gas prices?
	 */
	shouldWaitForBetterGas(): boolean {
		const trend = this.getGasPriceTrend()
		const median = this.getMedianGasPrice()
		const current = this.currentMarketData?.baseGasPrice

		if (!current) return false

		// Wait if trend is increasing and we're above median
		if (trend === "increasing" && current > median) {
			return true
		}

		// Wait if gas price is significantly high
		const limit = this.limits.maxGasPrice
		if (current > (limit * 90n) / 100n) {
			return true
		}

		return false
	}

	/**
	 * Get gas analysis summary
	 */
	getGasAnalysisSummary(): string {
		const avg = this.getAverageGasPrice()
		const median = this.getMedianGasPrice()
		const current = this.currentMarketData?.baseGasPrice || 0n
		const trend = this.getGasPriceTrend()

		return `
╔════════════════════════════════════════════╗
║      Gas Fee Analysis Report               ║
╚════════════════════════════════════════════╝

📊 Current Gas Prices
├─ Current: ${(Number(current) / 1e9).toFixed(2)} gwei
├─ Average: ${(Number(avg) / 1e9).toFixed(2)} gwei
├─ Median: ${(Number(median) / 1e9).toFixed(2)} gwei
└─ Trend: ${trend.toUpperCase()}

🛡️ Configured Limits
├─ Max Gas Price: ${(Number(this.limits.maxGasPrice) / 1e9).toFixed(2)} gwei
├─ Max Total Spend: ${(Number(this.limits.maxTotalGasSpend) / 1e18).toFixed(6)} ETH
└─ Max Gas % of Profit: ${this.limits.maxGasPercentage}%

⚠️ Status
├─ Price Acceptable: ${this.isGasPriceAcceptable() ? "✓ YES" : "✗ NO"}
└─ Wait for Better: ${this.shouldWaitForBetterGas() ? "⏳ YES" : "✓ NO"}
`
	}
}
