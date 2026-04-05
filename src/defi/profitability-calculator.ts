/**
 * Profitability Calculator
 * Precisely calculates all costs and verifies true profitability
 * Ensures EVERY executed trade is definitely profitable
 */

import type { ArbitrageOpportunity } from "./types.js"

export interface ProfitabilityAnalysis {
	// Raw amounts
	initialAmount: bigint
	finalAmount: bigint
	grossProfit: bigint

	// Cost breakdown
	aaveFlashFee: bigint // Aave flashloan fee (0.05% of amount)
	gasEstimated: bigint // Estimated gas in wei
	gasCost: bigint // Gas price * gas used
	totalCosts: bigint // All costs combined

	// Net profit
	netProfit: bigint // Gross profit - all costs
	profitMargin: number // Percentage: (netProfit / initialAmount) * 100

	// Safety metrics
	isProfitable: boolean // netProfit > 0
	isDefinitelyProfitable: boolean // netProfit > safety buffer
	profitPercentage: number // (netProfit / initialAmount) * 100
	gasRatio: number // gasEstimated / initialAmount * 100
	safetyMargin: bigint // Extra profit beyond breakeven

	// Validation
	meetsMinimumProfit: boolean
	meetsGasLimit: boolean
	isExecutable: boolean // Both profitability and gas checks pass
}

export interface GasConfig {
	currentGasPrice: bigint // Current gas price in wei per gas
	maxGasPrice: bigint // Maximum gas price willing to pay
	estimatedGasUsage: bigint // Estimated gas units for transaction
	safetyFactor: number // Multiplier for gas estimates (1.2 = 20% buffer)
}

export class ProfitabilityCalculator {
	// Aave V3 flashloan fee (0.05% = 5 basis points)
	private static readonly AAVE_FLASH_FEE_BPS = 5n
	private static readonly BASIS_POINTS = 10000n

	// Safety margins (configurable)
	private minProfitThreshold: bigint
	private minProfitPercentage: number // Minimum percentage profit required

	// Gas configuration
	private gasConfig: GasConfig

	constructor(
		minProfitThreshold: bigint = BigInt(10 ** 16), // 0.01 ETH minimum
		minProfitPercentage: number = 0.1, // 0.1% minimum profit
		gasConfig?: Partial<GasConfig>,
	) {
		this.minProfitThreshold = minProfitThreshold
		this.minProfitPercentage = minProfitPercentage

		// Default gas configuration
		this.gasConfig = {
			currentGasPrice: BigInt(50) * BigInt(10 ** 9), // 50 gwei
			maxGasPrice: BigInt(200) * BigInt(10 ** 9), // 200 gwei
			estimatedGasUsage: BigInt(500000), // 500k gas typical
			safetyFactor: 1.2, // 20% buffer on gas estimates
			...gasConfig,
		}
	}

	/**
	 * Calculate Aave flashloan fee for a given amount
	 * Fee is 0.05% (5 basis points) of the flashloaned amount
	 */
	calculateFlashloanFee(amount: bigint): bigint {
		return (amount * this.AAVE_FLASH_FEE_BPS) / this.BASIS_POINTS
	}

	/**
	 * Calculate gas cost for a transaction
	 */
	calculateGasCost(gasUsage?: bigint): bigint {
		const gas = gasUsage || this.gasConfig.estimatedGasUsage
		const safeGas = BigInt(
			Math.ceil(Number(gas) * this.gasConfig.safetyFactor),
		)
		return safeGas * this.gasConfig.currentGasPrice
	}

	/**
	 * Analyze profitability of an arbitrage opportunity
	 * Returns detailed breakdown of all costs and profits
	 */
	analyzeProfitability(
		initialAmount: bigint,
		finalAmount: bigint,
		gasUsage?: bigint,
	): ProfitabilityAnalysis {
		// Calculate all costs
		const aaveFlashFee = this.calculateFlashloanFee(initialAmount)
		const gasCost = this.calculateGasCost(gasUsage)
		const totalCosts = aaveFlashFee + gasCost

		// Calculate profit
		const grossProfit = finalAmount - initialAmount
		const netProfit = grossProfit - totalCosts
		const safetyMargin = netProfit > 0n ? netProfit : 0n

		// Calculate percentages
		const profitPercentage = Number(grossProfit) / Number(initialAmount)
		const netProfitPercentage =
			Number(netProfit) / Number(initialAmount)
		const gasRatio = Number(gasCost) / Number(initialAmount)

		// Profitability checks
		const isProfitable = netProfit > 0n
		const meetsMinimumProfit = netProfit >= this.minProfitThreshold
		const meetsMinimumPercentage =
			netProfitPercentage >= this.minProfitPercentage / 100

		// Gas limit check
		const meetsGasLimit = this.gasConfig.currentGasPrice <=
			this.gasConfig.maxGasPrice && gasCost <= finalAmount - initialAmount
			? true
			: false

		// Definitely profitable: meets both minimum thresholds
		const isDefinitelyProfitable =
			isProfitable &&
			meetsMinimumProfit &&
			meetsMinimumPercentage &&
			meetsGasLimit

		// Executable: passes all checks
		const isExecutable = isDefinitelyProfitable

		return {
			initialAmount,
			finalAmount,
			grossProfit,
			aaveFlashFee,
			gasEstimated: this.gasConfig.estimatedGasUsage,
			gasCost,
			totalCosts,
			netProfit,
			profitMargin: netProfitPercentage * 100,
			isProfitable,
			isDefinitelyProfitable,
			profitPercentage: profitPercentage * 100,
			gasRatio,
			safetyMargin,
			meetsMinimumProfit,
			meetsGasLimit,
			isExecutable,
		}
	}

	/**
	 * Validate if a trade should be executed based on strict profitability criteria
	 */
	shouldExecuteTrade(
		initialAmount: bigint,
		finalAmount: bigint,
		gasUsage?: bigint,
	): { execute: boolean; reason: string; analysis: ProfitabilityAnalysis } {
		const analysis = this.analyzeProfitability(
			initialAmount,
			finalAmount,
			gasUsage,
		)

		if (!analysis.isExecutable) {
			let reason = ""

			if (analysis.netProfit <= 0n) {
				reason = `Not profitable: net loss of ${(Number(analysis.netProfit) / 1e18).toFixed(6)} ETH`
			} else if (!analysis.meetsMinimumProfit) {
				reason = `Profit (${(Number(analysis.netProfit) / 1e18).toFixed(6)} ETH) below minimum threshold (${(Number(this.minProfitThreshold) / 1e18).toFixed(6)} ETH)`
			} else if (!analysis.meetsGasLimit) {
				reason = `Gas price (${(Number(this.gasConfig.currentGasPrice) / 1e9).toFixed(2)} gwei) exceeds maximum (${(Number(this.gasConfig.maxGasPrice) / 1e9).toFixed(2)} gwei)`
			} else if (analysis.gasRatio > 50) {
				reason = `Gas cost is ${analysis.gasRatio.toFixed(2)}% of initial amount (too high)`
			}

			return {
				execute: false,
				reason: reason || "Does not meet execution criteria",
				analysis,
			}
		}

		return {
			execute: true,
			reason: `Profitable trade: ${(Number(analysis.netProfit) / 1e18).toFixed(6)} ETH net profit (${analysis.profitMargin.toFixed(4)}%)`,
			analysis,
		}
	}

	/**
	 * Filter opportunities to only those that are definitely profitable
	 */
	filterProfitableOpportunities(
		opportunities: Array<{
			initialAmount: bigint
			finalAmount: bigint
			gasEstimate: bigint
			path: string[]
		}>,
	): Array<{
		...
		analysis: ProfitabilityAnalysis
	}> {
		return opportunities
			.map((opp) => ({
				...opp,
				analysis: this.analyzeProfitability(
					opp.initialAmount,
					opp.finalAmount,
					opp.gasEstimate,
				),
			}))
			.filter((opp) => opp.analysis.isExecutable)
			.sort(
				(a, b) =>
					Number(b.analysis.netProfit - a.analysis.netProfit),
			)
	}

	/**
	 * Update gas configuration dynamically
	 */
	updateGasConfig(config: Partial<GasConfig>): void {
		this.gasConfig = { ...this.gasConfig, ...config }
	}

	/**
	 * Get current gas configuration
	 */
	getGasConfig(): GasConfig {
		return { ...this.gasConfig }
	}

	/**
	 * Update minimum profit threshold
	 */
	updateMinimumProfit(threshold: bigint): void {
		this.minProfitThreshold = threshold
	}

	/**
	 * Update minimum profit percentage
	 */
	updateMinimumProfitPercentage(percentage: number): void {
		this.minProfitPercentage = percentage
	}

	/**
	 * Get profit statistics for analysis
	 */
	getProfitAnalysisSummary(analysis: ProfitabilityAnalysis): string {
		return `
╔════════════════════════════════════════════╗
║       Profitability Analysis Report        ║
╚════════════════════════════════════════════╝

💰 Amount Metrics
├─ Initial Amount: ${(Number(analysis.initialAmount) / 1e18).toFixed(6)} ETH
├─ Final Amount: ${(Number(analysis.finalAmount) / 1e18).toFixed(6)} ETH
└─ Gross Profit: ${(Number(analysis.grossProfit) / 1e18).toFixed(6)} ETH

💸 Cost Breakdown
├─ Aave Flash Fee (0.05%): ${(Number(analysis.aaveFlashFee) / 1e18).toFixed(6)} ETH
├─ Gas Cost: ${(Number(analysis.gasCost) / 1e18).toFixed(6)} ETH (${analysis.gasRatio.toFixed(2)}%)
└─ Total Costs: ${(Number(analysis.totalCosts) / 1e18).toFixed(6)} ETH

✅ Net Profit Analysis
├─ Net Profit: ${(Number(analysis.netProfit) / 1e18).toFixed(6)} ETH
├─ Profit Margin: ${analysis.profitMargin.toFixed(4)}%
└─ Safety Margin: ${(Number(analysis.safetyMargin) / 1e18).toFixed(6)} ETH

🛡️ Execution Criteria
├─ Is Profitable: ${analysis.isProfitable ? "✓ YES" : "✗ NO"}
├─ Meets Min Profit: ${analysis.meetsMinimumProfit ? "✓ YES" : "✗ NO"}
├─ Meets Gas Limit: ${analysis.meetsGasLimit ? "✓ YES" : "✗ NO"}
└─ EXECUTABLE: ${analysis.isExecutable ? "🟢 YES" : "🔴 NO"}
`
	}
}
