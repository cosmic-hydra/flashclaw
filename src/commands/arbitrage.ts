/**
 * Arbitrage command for managing the Aave flashloan arbitrage bot
 */

import { Command } from "commander"
import { ArbitrageBot } from "../defi/arbitrage-bot.js"
import type { ArbitrageConfig } from "../defi/types.js"

export function createArbitrageCommand(): Command {
	const cmd = new Command("arbitrage")
		.description("Manage Aave flashloan arbitrage bot")
		.addCommand(createStartCommand())
		.addCommand(createStopCommand())
		.addCommand(createStatusCommand())
		.addCommand(createConfigCommand())

	return cmd
}

function createStartCommand(): Command {
	return new Command("start")
		.description("Start the arbitrage bot")
		.action(async () => {
			try {
				const config = getDefaultConfig()
				const bot = new ArbitrageBot(config)

				console.log("Starting arbitrage bot...")
				await bot.start()

				// Keep process running
				process.on("SIGINT", () => {
					console.log("\nShutting down...")
					bot.stop()
					process.exit(0)
				})

				process.on("SIGTERM", () => {
					bot.stop()
					process.exit(0)
				})
			} catch (error) {
				console.error("Failed to start arbitrage bot:", error)
				process.exit(1)
			}
		})
}

function createStopCommand(): Command {
	return new Command("stop")
		.description("Stop the arbitrage bot")
		.action(async () => {
			console.log("Stop command - bot should be managed via process signals")
		})
}

function createStatusCommand(): Command {
	return new Command("status")
		.description("Show arbitrage bot statistics")
		.action(async () => {
			try {
				// TODO: Implement status retrieval from running bot
				// This would require IPC or a shared stats file
				console.log("Arbitrage Bot Status")
				console.log("===================")
				console.log("Status: Not implemented yet")
				console.log("Use the start command to run the bot")
			} catch (error) {
				console.error("Failed to get status:", error)
				process.exit(1)
			}
		})
}

function createConfigCommand(): Command {
	return new Command("config")
		.description("Show current configuration")
		.action(async () => {
			const config = getDefaultConfig()
			console.log("Arbitrage Configuration")
			console.log("======================")
			console.log(JSON.stringify(config, null, 2))
		})
}

/**
 * Get default arbitrage configuration from environment variables
 */
function getDefaultConfig(): ArbitrageConfig {
	// Load environment variables
	const profitWallet = process.env.PROFIT_WALLET_ADDRESS || ""
	const secretKey = process.env.WALLET_SECRET_KEY || process.env.PRIVATE_KEY || ""
	const aaveV5Pool = process.env.AAVE_V5_POOL_ADDRESS || ""
	const aaveV5PoolProvider = process.env.AAVE_V5_POOL_PROVIDER_ADDRESS || ""

	// Validate required configuration
	if (!secretKey) {
		console.warn("⚠️  WALLET_SECRET_KEY not set in .env file!")
	}
	if (!profitWallet) {
		console.warn("⚠️  PROFIT_WALLET_ADDRESS not set in .env file!")
	}
	if (!aaveV5Pool) {
		console.warn("⚠️  AAVE_V5_POOL_ADDRESS not set in .env file!")
	}

	return {
		enabled: process.env.ARBITRAGE_ENABLED === "true" || true,
		scanInterval: parseInt(process.env.SCAN_INTERVAL || "100", 10), // Default 100ms
		minProfitThreshold: BigInt(process.env.MIN_PROFIT || "10000000000000000"), // 0.01 ETH default
		maxGasPrice: BigInt(process.env.MAX_GAS_PRICE || "100000000000"), // 100 gwei
		blockchain: {
			rpcUrl: process.env.ETH_RPC_URL || "https://eth-mainnet.g.alchemy.com/v2/demo",
			chainId: parseInt(process.env.CHAIN_ID || "1", 10),
			privateKey: secretKey,
			gasLimit: BigInt(process.env.GAS_LIMIT || "500000"),
			maxGasPrice: BigInt(process.env.MAX_GAS_PRICE || "100000000000"),
		},
		aave: {
			// Use Aave V5 addresses if provided, fallback to V3
			poolAddressProvider: aaveV5PoolProvider || "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e",
			pool: aaveV5Pool || "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
			dataProvider: process.env.AAVE_DATA_PROVIDER || "0x7B4EB56E7CD4b454BA8ff71E4518426369a138a3",
			weth: process.env.WETH_ADDRESS || "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
		},
		dexes: [
			{
				name: "Uniswap V2",
				router: process.env.UNISWAP_V2_ROUTER || "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
				factory: process.env.UNISWAP_V2_FACTORY || "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
				fee: 3000,
			},
			{
				name: "Sushiswap",
				router: process.env.SUSHISWAP_ROUTER || "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
				factory: process.env.SUSHISWAP_FACTORY || "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac",
				fee: 3000,
			},
		],
	}
}
