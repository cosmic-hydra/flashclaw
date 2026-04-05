/**
 * Deployment script for FlashClaw Arbitrage contracts
 * Usage: npx hardhat run scripts/deploy.ts --network <network>
 */

import hre from "hardhat";

async function main() {
  console.log("🚀 Deploying FlashClaw Arbitrage Contracts...\n");

  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  console.log(`Deploying contracts using account: ${deployerAddress}`);
  console.log(`Account balance: ${hre.ethers.utils.formatEther(await deployer.getBalance())} ETH`);

  // Get Aave configuration for the network
  let aaveConfig: { provider: string; pool: string; dataProvider: string } | null = null;

  const { chainId } = await hre.ethers.provider.getNetwork();

  if (chainId === 1) {
    // Ethereum Mainnet
    aaveConfig = {
      provider: "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e",
      pool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
      dataProvider: "0x7B4EB56E7CD4b454BA8ff71E4518426369a138a3",
    };
  } else if (chainId === 42161) {
    // Arbitrum One
    aaveConfig = {
      provider: "0x6ae43d3271ff6888e7fc43fd7321a6df98eba631",
      pool: "0x794a61358d6845106066a23433b7221cd272370b",
      dataProvider: "0x69fa688f1dc47d4b5d8029d5a35fb7a548310654",
    };
  } else if (chainId === 10) {
    // Optimism
    aaveConfig = {
      provider: "0xa97684ead0e402dc232d5a977953df7ecbab3cdb",
      pool: "0x794a61358d6845106066a23433b7221cd272370b",
      dataProvider: "0x69fa688f1dc47d4b5d8029d5a35fb7a548310654",
    };
  } else if (chainId === 8453) {
    // Base
    aaveConfig = {
      provider: "0xe20fcbdbffc4dd138ce8b376bb221e8d8f82e8d9",
      pool: "0x7b5fa702b12cc7ab68c6a146af4d8077d8b0e4c9",
      dataProvider: "0x2d8a3c5677189723c4a60b3c280565f7926e39a6",
    };
  } else {
    throw new Error(`Unsupported network: ${chainId}`);
  }

  console.log(`\n📍 Network: ${hre.network.name} (Chain ID: ${chainId})`);
  console.log(`Aave Provider: ${aaveConfig.provider}`);
  console.log(`Aave Pool: ${aaveConfig.pool}`);

  // Deploy FlashClawArbitrageV2
  console.log("\n📦 Deploying FlashClawArbitrageV2...");
  const FlashClawArbitrageV2 = await hre.ethers.getContractFactory("FlashClawArbitrageV2");
  const flashClawContract = await FlashClawArbitrageV2.deploy(aaveConfig.provider);
  await flashClawContract.deployed();

  console.log(`✅ FlashClawArbitrageV2 deployed to: ${flashClawContract.address}`);

  // Whitelist common DEX routers
  const routerConfigs: { [key: string]: string } = {
    "Uniswap V2": "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    "Sushiswap": "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
  };

  console.log("\n📋 Whitelisting DEX routers...");
  for (const [name, router] of Object.entries(routerConfigs)) {
    await flashClawContract.whitelistRouter(router);
    console.log(`  ✓ ${name}: ${router}`);
  }

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId,
    deployer: deployerAddress,
    timestamp: new Date().toISOString(),
    contracts: {
      FlashClawArbitrageV2: {
        address: flashClawContract.address,
        tx: flashClawContract.deployTransaction.hash,
      },
    },
    aave: aaveConfig,
    whitelistedRouters: routerConfigs,
  };

  const fs = await import("fs");
  const path = await import("path");
  const deploymentDir = path.join(process.cwd(), "deployments");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir);
  }

  fs.writeFileSync(
    path.join(deploymentDir, `${hre.network.name}-deployment.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log(`\n✅ Deployment completed!`);
  console.log(`📊 Deployment info saved to: deployments/${hre.network.name}-deployment.json`);

  // Verify on Etherscan if available
  if (process.env.ETHERSCAN_API_KEY && chainId === 1) {
    console.log("\n🔍 Verifying contract on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: flashClawContract.address,
        constructorArguments: [aaveConfig.provider],
      });
      console.log("✅ Contract verified on Etherscan");
    } catch (error) {
      console.log("⚠ Etherscan verification skipped:", error);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
