/**
 * Advanced arbitrage bot with multi-opportunity execution and safety features
 */

import { PriceScanner } from "./price-scanner.js"
import { FlashloanExecutor } from "./flashloan-executor.js"
import { MetricsCollector } from "./metrics-collector.js"
import type { ArbitrageConfig, ArbitrageStats } from "./types.js"

export interface CircuitBreakerConfig {
	maxConsecutiveFailures: number
	cooldownMs: number
	enableLossLimit: boolean
	maxDrawdownPercent: number
}

export class AdvancedArbitrageBot {
	private config: ArbitrageConfig
	private scanner: PriceScanner
	private executor: FlashloanExecutor
	private metricsCollector: MetricsCollector
	private stats: ArbitrageStats
	private running: boolean = false
	private scanIntervalId?: NodeJS.Timeout
	private metricsIntervalId?: NodeJS.Timeout

	// Circuit breaker
	private circuitBreakerConfig: CircuitBreakerConfig
	private consecutiveFailures: number = 0
	private circuitBreakerTripped: boolean = false
	private lastSuccessTime: number = Date.now()
	private peakProfit: bigint = 0n

	// Token pairs to monitor
	private readonly TOKEN_PAIRS: Array<[string, string]> = [
		["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"],
		["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "0xdAC17F958D2ee523a2206206994597C13D831ec7"],
		["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
	]

	constructor(
		config: ArbitrageConfig,
		circuitBreakerConfig?: Partial<CircuitBreakerConfig>,
	) {
		this.config = config
		this.scanner = new PriceScanner(config.dexes, config.minProfitThreshold)
		this.executor = new FlashloanExecutor(config.aave, config.blockchain)
		this.metricsCollector = new MetricsCollector()
		this.stats = {
			totalOpportunities: 0,
			executedTrades: 0,
			successfulTrades: 0,
			failedTrades: 0,
			totalProfit: 0n,
			totalLoss: 0n,
			netProfit: 0n,
			lastScanTime: 0,
			lastExecutionTime: 0,
		}

		// Initialize circuit breaker config
		this.circuitBreakerConfig = {
			maxConsecutiveFailures: 5,
			cooldownMs: 60000, // 1 minute
			enableLossLimit: true,
			maxDrawdownPercent: 10,
			...circuitBreakerConfig,
		}
	}

	/**
	 * Start the advanced arbitrage bot
	 */
	async start(): Promise<void> {
		if (this.running) {
			console.log("Arbitrage bot is already running")
			return
		}

		if (!this.config.enabled) {
			console.log("Arbitrage bot is disabled in configuration")
			return
		}

		console.log(
			"Starting advanced arbitrage bot with safety features...",
		)
		console.log(
			`Scan interval: ${this.config.scanInterval}ms`,
		)
		console.log(
			`Min profit threshold: ${this.config.minProfitThreshold.toString()} wei`,
		)
		console.log(
			`Circuit breaker: max ${this.circuitBreakerConfig.maxConsecutiveFailures} failures`,
		)
		console.log(
			`Monitoring ${this.TOKEN_PAIRS.length} token pairs`,
		)

		this.running = true

		// Start scanning loop
		this.scanIntervalId = setInterval(async () => {
			await this.scanAndExecute()
		}, this.config.scanInterval)

		// Start metrics collection
		this.metricsIntervalId = setInterval(() => {
			this.metricsCollector.recordSnapshot(
				this.stats,
				0, // TODO: track active opportunities
				0, // TODO: track price data points
			)
		}, 60000) // Every minute

		// Initial scan
		await this.scanAndExecute()

		console.log("Advanced arbitrage bot started successfully")
		console.log(
			"Press Ctrl+C for performance report",
		)
	}

	/**
	 * Stop the arbitrage bot
	 */
	stop(): void {
		if (!this.running) {
			console.log("Arbitrage bot is not running")
			return
		}

		console.log("Stopping arbitrage bot...")

		if (this.scanIntervalId) {
			clearInterval(this.scanIntervalId)
			this.scanIntervalId = undefined
		}

		if (this.metricsIntervalId) {
			clearInterval(this.metricsIntervalId)
			this.metricsIntervalId = undefined
		}

		this.running = false
		console.log("Arbitrage bot stopped")

		// Print final report
		console.log(this.metricsCollector.generateReport())
	}

	/**
	 * Check and manage circuit breaker
	 */
	private checkCircuitBreaker(): boolean {
		if (!this.circuitBreakerTripped) {
			return true
		}

		const timeSinceLastSuccess = Date.now() - this.lastSuccessTime
		if (
			timeSinceLastSuccess >=
			this.circuitBreakerConfig.cooldownMs
		) {
			console.log("✓ Circuit breaker reset after cooldown")
			this.circuitBreakerTripped = false
			this.consecutiveFailures = 0
			return true
		}

		return false
	}

	/**
	 * Check loss limit
	 */
	private checkLossLimit(): boolean {
		if (!this.circuitBreakerConfig.enableLossLimit) {
			return true
		}

		if (this.peakProfit === 0n) {
			this.peakProfit = this.stats.totalProfit
			return true
		}

		const drawdown = this.peakProfit - this.stats.totalProfit
		const drawdownPercent = Number(drawdown) / Number(this.peakProfit)

		if (drawdownPercent >
			this.circuitBreakerConfig.maxDrawdownPercent / 100
		) {
			console.warn(
				`⚠ Loss limit reached: ${(drawdownPercent * 100).toFixed(2)}% drawdown`,
			)
			this.circuitBreakerTripped = true
			return false
		}

		// Update peak profit if current profit is higher
		if (this.stats.totalProfit > this.peakProfit) {
			this.peakProfit = this.stats.totalProfit
		}

		return true
	}

	/**
	 * Scan for opportunities and execute multiple if found
	 */
	private async scanAndExecute(): Promise<void> {
		try {
			// Check safety conditions
			if (!this.checkCircuitBreaker()) {
				console.log(
					"⚠ Circuit breaker active, waiting for cooldown...",
				)
				return
			}

			if (!this.checkLossLimit()) {
				console.log(
					"⚠ Loss limit triggered, halting operations",
				)
				this.stop()
				return
			}

			this.stats.lastScanTime = Date.now()

			// Scan all DEXes for prices
			await this.scanner.scanPrices(this.TOKEN_PAIRS)

			// Find ALL arbitrage opportunities (not just best)
			const opportunities = this.scanner.findOpportunities()

			if (opportunities.length > 0) {
				console.log(
					`Found ${opportunities.length} potential opportunities`,
				)
				this.stats.totalOpportunities += opportunities.length

				// Sort by profitability
				const sorted = opportunities.sort(
					(a, b) =>
						Number(b.profitAfterGas - a.profitAfterGas),
				)

				// Execute top 3 most profitable (configurable safety limit)
				const topOpportunities = sorted.slice(0, 3)

				for (const opportunity of topOpportunities) {
					if (
						!this.executor.isReady() ||
						!this.checkCircuitBreaker()
					) {
						break
					}

					await this.executeOpportunity(opportunity)

					// Small delay between executions to prevent mempool conflicts
					await new Promise((resolve) =>
						setTimeout(resolve, 100),
					)
				}
			}

			// Clean up old price data
			this.scanner.clearOldPrices()
		} catch (error) {
			console.error("Error in scan and execute:", error)
		}
	}

	/**
	 * Execute a specific arbitrage opportunity with logging
	 */
	private async executeOpportunity(opportunity: any): Promise<void> {
		try {
			console.log(
				`\n📊 Executing arbitrage opportunity:`,
			)
			console.log(
				`   Path: ${opportunity.path.join(" → ")}`,
			)
			console.log(
				`   DEXes: ${opportunity.dexes.join(" → ")}`,
			)
			console.log(
				`   Expected profit: ${(Number(opportunity.profitAfterGas) / 1e18).toFixed(6)} ETH`,
			)
			console.log(
				`   Gas estimate: ${Number(opportunity.gasEstimate / 1e9).toFixed(2)} gwei`,
			)

			this.stats.executedTrades++
			this.stats.lastExecutionTime = Date.now()

			const result = await this.executor.executeArbitrage(
				opportunity,
			)

			if (result.success) {
				this.stats.successfulTrades++
				const profit = result.profit || 0n
				this.stats.totalProfit += profit
				this.stats.netProfit = this.stats.totalProfit - this.stats.totalLoss

				// Update peak profit
				if (this.stats.totalProfit > this.peakProfit) {
					this.peakProfit = this.stats.totalProfit
				}

				this.consecutiveFailures = 0
				this.lastSuccessTime = Date.now()

				console.log(`✅ Trade executed successfully!`)
				console.log(`   TX Hash: ${result.txHash}`)
				console.log(`   Profit: ${(Number(profit) / 1e18).toFixed(6)} ETH`)
				console.log(
					`   Total profit: ${(Number(this.stats.totalProfit) / 1e18).toFixed(6)} ETH\n`,
				)
			} else {
				this.stats.failedTrades++
				this.consecutiveFailures++

				if (
					this.consecutiveFailures >=
					this.circuitBreakerConfig.maxConsecutiveFailures
				) {
					console.error(
						`❌ Circuit breaker triggered: ${this.consecutiveFailures} consecutive failures`,
					)
					this.circuitBreakerTripped = true
				} else {
					console.log(
						`❌ Trade failed: ${result.error}`,
					)
					console.log(
						`   Consecutive failures: ${this.consecutiveFailures}/${this.circuitBreakerConfig.maxConsecutiveFailures}\n`,
					)
				}
			}
		} catch (error) {
			this.stats.failedTrades++
			this.consecutiveFailures++
			console.error("Error executing opportunity:", error)
		}
	}

	/**
	 * Get current statistics
	 */
	getStats(): ArbitrageStats {
		return { ...this.stats }
	}

	/**
	 * Get performance report
	 */
	getPerformanceReport(): string {
		return this.metricsCollector.generateReport()
	}

	/**
	 * Check if bot is running
	 */
	isRunning(): boolean {
		return this.running
	}

	/**
	 * Get circuit breaker status
	 */
	getCircuitBreakerStatus(): {
		tripped: boolean
		consecutiveFailures: number
		lastSuccessTime: number
	} {
		return {
			tripped: this.circuitBreakerTripped,
			consecutiveFailures: this.consecutiveFailures,
			lastSuccessTime: this.lastSuccessTime,
		}
	}
}
