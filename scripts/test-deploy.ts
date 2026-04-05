/**
 * Test deployment script for local testing
 * Usage: npx hardhat run scripts/test-deploy.ts --network localhost
 */

import hre from "hardhat";

async function main() {
  console.log("🧪 Testing FlashClaw Deployment...\n");

  const [deployer] = await hre.ethers.getSigners();

  // Use Aave mainnet addresses (for fork testing)
  const aaveProvider = "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e";

  console.log(`Deployer: ${await deployer.getAddress()}`);

  // Deploy V1 contract
  console.log("\n📦 Deploying FlashClawArbitrage (V1)...");
  const FlashClawArbitrage = await hre.ethers.getContractFactory("FlashClawArbitrage");
  const v1 = await FlashClawArbitrage.deploy(aaveProvider);
  await v1.deployed();
  console.log(`✅ FlashClawArbitrage V1 deployed to: ${v1.address}`);

  // Deploy V2 contract
  console.log("\n📦 Deploying FlashClawArbitrageV2...");
  const FlashClawArbitrageV2 = await hre.ethers.getContractFactory("FlashClawArbitrageV2");
  const v2 = await FlashClawArbitrageV2.deploy(aaveProvider);
  await v2.deployed();
  console.log(`✅ FlashClawArbitrageV2 deployed to: ${v2.address}`);

  // Test V2 basic functionality
  console.log("\n🧪 Testing V2 functionality...");

  // Whitelist Uniswap V2 router
  const uniswapV2Router = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  await v2.whitelistRouter(uniswapV2Router);
  console.log(`✓ Whitelisted Uniswap V2: ${uniswapV2Router}`);

  // Get stats
  const stats = await v2.getStats();
  console.log(`\n📊 Initial Statistics:`);
  console.log(`  Executed: ${stats.executed}`);
  console.log(`  Successful: ${stats.successful}`);
  console.log(`  Failed: ${stats.failed}`);
  console.log(`  Total Profit: ${stats.profit}`);
  console.log(`  Circuit Open: ${stats.circuitOpen}`);

  // Get success rate
  const successRate = await v2.getSuccessRate();
  console.log(`\n📈 Success Rate: ${successRate}%`);

  // Check if arbitrage is allowed
  const allowed = await v2.isArbitrageAllowed();
  console.log(`✓ Arbitrage allowed: ${allowed}`);

  console.log("\n✅ Test deployment completed successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
