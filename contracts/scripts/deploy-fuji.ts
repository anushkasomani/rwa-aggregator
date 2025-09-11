import { ethers } from "hardhat";
import * as fs from 'fs';
import * as path from 'path';

// Fuji Testnet Addresses
const FUJI_ADDRESSES = {
  LB_FACTORY: "0xb43120c4745967fa9b93E79C149E66B0f2D6Fe0c",
  LB_ROUTER: "0x18556DA13313f3532c54711497A8FedAC273220E",
  USDT: "0xAb231A5744C8E6c45481754928cCfFFFD4aa0732",
  USDC: "0xB6076C93701D6a07266c31066B298AeC6dd65c2d", // Base token
  WAVAX: "0xd00ae08403B9bbb9124bB305C09058E32C39A48c", // Main asset
};

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "AVAX");
  
  // Deploy OracleAggregator (real one with Chainlink support)
  console.log("\n1. Deploying OracleAggregator...");
  const OracleAggregatorFactory = await ethers.getContractFactory("OracleAggregator");
  const oracleAggregator = await OracleAggregatorFactory.deploy();
  await oracleAggregator.waitForDeployment();
  const oracleAddress = await oracleAggregator.getAddress();
  console.log("OracleAggregator deployed to:", oracleAddress);
  
  // Deploy OrderRouter
  console.log("\n2. Deploying OrderRouter...");
  const OrderRouterFactory = await ethers.getContractFactory("OrderRouter");
  const orderRouter = await OrderRouterFactory.deploy(FUJI_ADDRESSES.LB_ROUTER);
  await orderRouter.waitForDeployment();
  const orderRouterAddress = await orderRouter.getAddress();
  console.log("OrderRouter deployed to:", orderRouterAddress);
  
  // Note: You'll need to find the correct binSteps from Trader Joe V2 for these pairs
  await orderRouter.setPairBinStep(FUJI_ADDRESSES.USDC, FUJI_ADDRESSES.USDT, 1);
  await orderRouter.setPairBinStep(FUJI_ADDRESSES.USDC, FUJI_ADDRESSES.WAVAX, 10);
  await orderRouter.setPairBinStep(FUJI_ADDRESSES.USDT, FUJI_ADDRESSES.WAVAX, 25);
  console.log("✓ Trading pairs configured (USDC-USDT, USDC-WAVAX, USDT-WAVAX)");
  
  // Deploy BasketFactory
  console.log("\n3. Deploying BasketFactory...");
  const BasketFactoryFactory = await ethers.getContractFactory("BasketFactory");
  const basketFactory = await BasketFactoryFactory.deploy(
    oracleAddress,
    orderRouterAddress
  );
  await basketFactory.waitForDeployment();
  const basketFactoryAddress = await basketFactory.getAddress();
  console.log("BasketFactory deployed to:", basketFactoryAddress);
  
  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("🎉 DEPLOYMENT SUMMARY");
  console.log("=".repeat(50));
  console.log("Network: Avalanche Fuji Testnet");
  console.log("Deployer:", deployer.address);
  console.log("");
  console.log("Deployed Contracts:");
  console.log("├── OracleAggregator:", oracleAddress);
  console.log("├── OrderRouter:", orderRouterAddress);
  console.log("└── BasketFactory:", basketFactoryAddress);
  console.log("");
  console.log("External Dependencies:");
  console.log("├── LBRouter (TraderJoe):", FUJI_ADDRESSES.LB_ROUTER);
  console.log("├── USDC (Base Token):", FUJI_ADDRESSES.USDC);
  console.log("├── USDT:", FUJI_ADDRESSES.USDT);
  console.log("└── WAVAX (Main Asset):", FUJI_ADDRESSES.WAVAX);
  console.log("");
  console.log("⚠️  IMPORTANT NEXT STEPS:");
  console.log("1. Update OrderRouter binSteps with actual TraderJoe V2 values");
  console.log("2. Replace MockOracleAggregator with Chainlink price feeds");
  console.log("3. Create your first basket using the factory");
  console.log("");
  console.log("Sample basket creation:");
  console.log(`basketFactory.createBasket(`);
  console.log(`  ["${FUJI_ADDRESSES.USDT}", "${FUJI_ADDRESSES.WAVAX}"], // assets`);
  console.log(`  [6000, 4000], // weights (60% USDT, 40% WAVAX)`);
  console.log(`  "${FUJI_ADDRESSES.USDC}", // baseToken`);
  console.log(`  "USDT-WAVAX Basket", // name`);
  console.log(`  "UWB" // symbol`);
  console.log(`)`);
  
  // Save deployment info to deployments directory
  const deploymentInfo = {
    network: "fuji",
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      OracleAggregator: oracleAddress,
      OrderRouter: orderRouterAddress,
      BasketFactory: basketFactoryAddress
    },
    external: FUJI_ADDRESSES
  };
  
  // Create deployments directory structure
  const deploymentsDir = path.join(__dirname, '..', 'deployments', 'fuji');
  if (!fs.existsSync(path.join(__dirname, '..', 'deployments'))) {
    fs.mkdirSync(path.join(__dirname, '..', 'deployments'));
  }
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  
  // Save to deployed-contracts.json
  const deploymentPath = path.join(deploymentsDir, 'deployed-contracts.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log(`\n💾 Deployment addresses saved to: ${deploymentPath}`);
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });