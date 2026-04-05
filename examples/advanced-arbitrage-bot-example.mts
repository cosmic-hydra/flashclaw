#!/usr/bin/env node

/**
 * Advanced Arbitrage Bot Example
 * Demonstrates the new AdvancedArbitrageBot with safety features and metrics
 * 
 * Usage: pnpm tsx examples/advanced-arbitrage-bot-example.mts
 * 
 * This example showcases:
 * - Circuit breaker pattern for safety
 * - Multi-opportunity execution
 * - Real-time performance metrics
 * - Loss limit monitoring
 * - Automatic recovery
 */

import { AdvancedArbitrageBot } from "../src/defi/index.js"

// Configuration with safety features
const config = {
	enabled: true,
	scanInterval: 100, // 100ms scan interval (high-frequency)
	minProfitThreshold: BigInt(10 ** 17), // 0.1 ETH minimum profit

	blockchain: {
		rpcUrl: process.env.ETH_RPC_URL || "http://localhost:8545",
		chainId: 1,
		privateKey: process.env.PRIVATE_KEY,
		gasLimit: BigInt(500000),
		maxGasPrice: BigInt(100) * BigInt(10 ** 9), // 100 gwei
	},

	aave: {
		poolAddressProvider: "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e",
		pool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
		dataProvider: "0x7B4EB56E7CD4b454BA8ff71E4518426369a138a3",
		weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
	},

	dexes: [
		{
			name: "Uniswap V2",
			router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
			factory: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
			fee: 3000,
		},
		{
			name: "Sushiswap",
			router: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
			factory: "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac",
			fee: 3000,
		},
	],
}

// Advanced circuit breaker configuration
const circuitBreakerConfig = {
	maxConsecutiveFailures: 5, // Stop after 5 consecutive failures
	cooldownMs: 60000, // 1 minute cooldown before retry
	enableLossLimit: true, // Enable loss monitoring
	maxDrawdownPercent: 10, // Stop if 10% loss from peak
}

async function main() {
	console.log("🦞 Advanced FlashClaw Arbitrage Bot")
	console.log("===================================\n")

	// Create the advanced bot with safety features
	const bot = new AdvancedArbitrageBot(config, circuitBreakerConfig)

	// Display configuration
	console.log("📋 Configuration:")
	console.log(`  Scan Interval: ${config.scanInterval}ms`)
	console.log(`  Min Profit: ${config.minProfitThreshold} wei (0.1 ETH)`)
	console.log(`  Max Gas Price: ${config.maxGasPrice / BigInt(10 ** 9)} gwei`)
	console.log(`  DEXes: ${config.dexes.map((d) => d.name).join(", ")}`)
	console.log()

	console.log("🛡️ Safety Features:")
	console.log(
		`  Max Consecutive Failures: ${circuitBreakerConfig.maxConsecutiveFailures}`,
	)
	console.log(
		`  Circuit Breaker Cooldown: ${circuitBreakerConfig.cooldownMs}ms`,
	)
	console.log(
		`  Loss Limit Enabled: ${circuitBreakerConfig.enableLossLimit}`,
	)
	console.log(
		`  Max Drawdown: ${circuitBreakerConfig.maxDrawdownPercent}%`,
	)
	console.log()

	// Set up signal handlers
	const shutdown = () => {
		console.log("\n\n⏹️ Shutting down bot...")
		bot.stop()
		process.exit(0)
	}

	process.on("SIGINT", shutdown)
	process.on("SIGTERM", shutdown)

	// Start the bot
	console.log("Starting advanced arbitrage bot...\n")
	await bot.start()

	// Display detailed stats every 30 seconds
	let statsInterval = setInterval(() => {
		const stats = bot.getStats()
		const cbStatus = bot.getCircuitBreakerStatus()

		console.log("\n--- Live Statistics (30s window) ---")
		console.log(`Time: ${new Date().toISOString()}`)
		console.log()

		console.log("📊 Opportunities & Executions:")
		console.log(`  Total Found: ${stats.totalOpportunities}`)
		console.log(`  Executed: ${stats.executedTrades}`)
		console.log(`  Successful: ${stats.successfulTrades}`)
		console.log(`  Failed: ${stats.failedTrades}`)
		console.log()

		if (stats.executedTrades > 0) {
			const successRate = (
				(stats.successfulTrades / stats.executedTrades) *
				100
			).toFixed(1)
			const profitabilityRate = (
				(stats.successfulTrades / stats.totalOpportunities) *
				100
			).toFixed(1)

			console.log("📈 Rates:")
			console.log(`  Success Rate: ${successRate}%`)
			console.log(
				`  Profitability Rate: ${profitabilityRate}%`,
			)
		}

		console.log()
		console.log("💰 Profit Metrics:")
		console.log(
			`  Total Profit: ${(Number(stats.totalProfit) / 1e18).toFixed(6)} ETH`,
		)
		console.log(
			`  Total Loss: ${(Number(stats.totalLoss) / 1e18).toFixed(6)} ETH`,
		)
		console.log(
			`  Net Profit: ${(Number(stats.netProfit) / 1e18).toFixed(6)} ETH`,
		)
		console.log()

		console.log("🛡️ Circuit Breaker:")
		console.log(
			`  Status: ${cbStatus.tripped ? "🔴 TRIPPED" : "🟢 ACTIVE"}`,
		)
		console.log(
			`  Consecutive Failures: ${cbStatus.consecutiveFailures}/${circuitBreakerConfig.maxConsecutiveFailures}`,
		)
		console.log(
			`  Last Success: ${new Date(cbStatus.lastSuccessTime).toLocaleTimeString()}`,
		)
		console.log()
	}, 30000)

	// Display detailed performance report every 5 minutes
	let reportInterval = setInterval(() => {
		console.log("\n")
		console.log(bot.getPerformanceReport())
	}, 5 * 60 * 1000)

	// Keep the process running
	console.log("Bot is running. Press Ctrl+C to stop and see final report.\n")
}

// Run the example
main().catch((error) => {
	console.error("Fatal error:", error)
	process.exit(1)
})
