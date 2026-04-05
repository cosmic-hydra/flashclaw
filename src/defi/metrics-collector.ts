/**
 * Advanced monitoring and metrics collection for arbitrage bot
 */

import type { ArbitrageStats } from "./types.js"

export interface MetricSnapshot {
	timestamp: number
	stats: ArbitrageStats
	memoryUsage: {
		heapUsed: number
		heapTotal: number
		external: number
	}
	activeOpportunities: number
	priceDataPoints: number
}

export interface PerformanceMetrics {
	profitPerHour: bigint
	profitPerTrade: bigint
	averageExecutionTime: number
	averageGasUsed: bigint
	successRate: number
	profitabilityRate: number
	opportunityDetectionRate: number
}

export class MetricsCollector {
	private snapshots: MetricSnapshot[] = []
	private maxSnapshots = 1440 // 24 hours of minute-level snapshots
	private performanceMetrics: PerformanceMetrics = {
		profitPerHour: 0n,
		profitPerTrade: 0n,
		averageExecutionTime: 0,
		averageGasUsed: 0n,
		successRate: 0,
		profitabilityRate: 0,
		opportunityDetectionRate: 0,
	}
	private startTime = Date.now()

	/**
	 * Record a metrics snapshot
	 */
	recordSnapshot(
		stats: ArbitrageStats,
		activeOpportunities: number,
		priceDataPoints: number,
	): void {
		const memUsage = process.memoryUsage()

		const snapshot: MetricSnapshot = {
			timestamp: Date.now(),
			stats,
			memoryUsage: {
				heapUsed: memUsage.heapUsed,
				heapTotal: memUsage.heapTotal,
				external: memUsage.external,
			},
			activeOpportunities,
			priceDataPoints,
		}

		this.snapshots.push(snapshot)

		// Keep snapshots within limit
		if (this.snapshots.length > this.maxSnapshots) {
			this.snapshots.shift()
		}

		// Update performance metrics
		this.updatePerformanceMetrics()
	}

	/**
	 * Update calculated performance metrics
	 */
	private updatePerformanceMetrics(): void {
		if (this.snapshots.length === 0) return

		const latestStats = this.snapshots[this.snapshots.length - 1].stats
		const uptime = Date.now() - this.startTime
		const hours = uptime / (1000 * 60 * 60)

		// Profit per hour
		if (hours > 0) {
			this.performanceMetrics.profitPerHour =
				latestStats.netProfit / BigInt(Math.ceil(hours))
		}

		// Profit per trade
		if (latestStats.executedTrades > 0) {
			this.performanceMetrics.profitPerTrade =
				latestStats.totalProfit / BigInt(latestStats.executedTrades)
		}

		// Success rate
		if (latestStats.executedTrades > 0) {
			this.performanceMetrics.successRate =
				(latestStats.successfulTrades / latestStats.executedTrades) * 100
		}

		// Profitability rate (profitable trades / found opportunities)
		if (latestStats.totalOpportunities > 0) {
			this.performanceMetrics.profitabilityRate =
				(latestStats.successfulTrades / latestStats.totalOpportunities) * 100
		}

		// Opportunity detection rate
		if (latestStats.totalOpportunities > 0) {
			this.performanceMetrics.opportunityDetectionRate =
				latestStats.totalOpportunities / Math.ceil(hours)
		}
	}

	/**
	 * Get current performance metrics
	 */
	getPerformanceMetrics(): PerformanceMetrics {
		return { ...this.performanceMetrics }
	}

	/**
	 * Get snapshots within time range
	 */
	getSnapshotsInRange(
		startTime: number,
		endTime: number,
	): MetricSnapshot[] {
		return this.snapshots.filter(
			(s) => s.timestamp >= startTime && s.timestamp <= endTime,
		)
	}

	/**
	 * Get latest snapshot
	 */
	getLatestSnapshot(): MetricSnapshot | undefined {
		return this.snapshots[this.snapshots.length - 1]
	}

	/**
	 * Get trend analysis
	 */
	getTrendAnalysis(): {
		profitTrend: "increasing" | "decreasing" | "stable"
		profitTrendPercent: number
		successRateTrend: "improving" | "declining" | "stable"
	} {
		if (this.snapshots.length < 2) {
			return {
				profitTrend: "stable",
				profitTrendPercent: 0,
				successRateTrend: "stable",
			}
		}

		const recent = this.snapshots.slice(-60) // Last hour
		if (recent.length < 2) {
			return {
				profitTrend: "stable",
				profitTrendPercent: 0,
				successRateTrend: "stable",
			}
		}

		const firstProfit = recent[0].stats.netProfit
		const lastProfit = recent[recent.length - 1].stats.netProfit
		const profitChange = Number(lastProfit - firstProfit)
		const profitTrendPercent =
			firstProfit !== 0n
				? (profitChange / Number(firstProfit)) * 100
				: 0

		const profitTrend =
			profitChange > 0
				? "increasing"
				: profitChange < 0
					? "decreasing"
					: "stable"

		// Calculate success rate trend
		const firstSuccessRate =
			recent[0].stats.executedTrades > 0
				? (recent[0].stats.successfulTrades /
						recent[0].stats.executedTrades) *
					100
				: 0
		const lastSuccessRate =
			recent[recent.length - 1].stats.executedTrades > 0
				? (recent[recent.length - 1].stats
						.successfulTrades /
						recent[recent.length - 1].stats
							.executedTrades) *
					100
				: 0

		const successRateTrend =
			lastSuccessRate > firstSuccessRate
				? "improving"
				: lastSuccessRate < firstSuccessRate
					? "declining"
					: "stable"

		return {
			profitTrend,
			profitTrendPercent,
			successRateTrend,
		}
	}

	/**
	 * Generate a report
	 */
	generateReport(): string {
		const latest = this.getLatestSnapshot()
		if (!latest) return "No data available"

		const metrics = this.getPerformanceMetrics()
		const trend = this.getTrendAnalysis()
		const uptime = Date.now() - this.startTime

		return `
╔════════════════════════════════════════════╗
║      Arbitrage Bot Performance Report      ║
╚════════════════════════════════════════════╝

📊 Runtime Statistics
├─ Uptime: ${(uptime / (1000 * 60 * 60)).toFixed(2)} hours
├─ Total Opportunities: ${latest.stats.totalOpportunities}
├─ Executed Trades: ${latest.stats.executedTrades}
├─ Successful Trades: ${latest.stats.successfulTrades}
└─ Failed Trades: ${latest.stats.failedTrades}

💰 Profit Metrics
├─ Total Profit: ${(Number(latest.stats.totalProfit) / 1e18).toFixed(4)} ETH
├─ Profit/Hour: ${(Number(metrics.profitPerHour) / 1e18).toFixed(6)} ETH
├─ Profit/Trade: ${(Number(metrics.profitPerTrade) / 1e18).toFixed(6)} ETH
└─ Trend: ${trend.profitTrend} (${trend.profitTrendPercent > 0 ? "+" : ""}${trend.profitTrendPercent.toFixed(1)}%)

📈 Performance Rates
├─ Success Rate: ${(latest.stats.executedTrades > 0 ? (latest.stats.successfulTrades / latest.stats.executedTrades) * 100 : 0).toFixed(1)}%
├─ Profitability Rate: ${metrics.profitabilityRate.toFixed(1)}%
├─ Success Trend: ${trend.successRateTrend}
└─ Opportunities/Hour: ${metrics.opportunityDetectionRate.toFixed(1)}

💻 System Metrics
├─ Memory Used: ${(latest.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB
├─ Total Heap: ${(latest.memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB
├─ Active Opportunities: ${latest.activeOpportunities}
└─ Price Data Points: ${latest.priceDataPoints}
`
	}
}
