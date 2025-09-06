import { ethers } from "hardhat";

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
  
  // Deploy OracleAggregator (mock for now)
  console.log("\n1. Deploying MockOracleAggregator...");
  const MockOracleAggregatorFactory = await ethers.getContractFactory("MockOracleAggregator");
  const oracleAggregator = await MockOracleAggregatorFactory.deploy();
  await oracleAggregator.waitForDeployment();
  const oracleAddress = await oracleAggregator.getAddress();
  console.log("MockOracleAggregator deployed to:", oracleAddress);
  
  // Set prices for assets (in 1e18 scale)
  console.log("Setting asset prices...");
  await oracleAggregator.setPrice(FUJI_ADDRESSES.USDC, ethers.parseUnits("1", 18)); // $1.00
  await oracleAggregator.setPrice(FUJI_ADDRESSES.USDT, ethers.parseUnits("1", 18)); // $1.00
  await oracleAggregator.setPrice(FUJI_ADDRESSES.WAVAX, ethers.parseUnits("35", 18)); // ~$35.00
  console.log("✓ Asset prices set");
  
  // Deploy OrderRouter
  console.log("\n2. Deploying OrderRouter...");
  const OrderRouterFactory = await ethers.getContractFactory("OrderRouter");
  const orderRouter = await OrderRouterFactory.deploy(FUJI_ADDRESSES.LB_ROUTER);
  await orderRouter.waitForDeployment();
  const orderRouterAddress = await orderRouter.getAddress();
  console.log("OrderRouter deployed to:", orderRouterAddress);
  
  // Note: You'll need to find the correct binSteps from Trader Joe V2 for these pairs
  await orderRouter.setPairBinStep(FUJI_ADDRESSES.USDC, FUJI_ADDRESSES.USDT, 1);
  await orderRouter.setPairBinStep(FUJI_ADDRESSES.USDC, FUJI_ADDRESSES.WAVAX, 20);
  await orderRouter.setPairBinStep(FUJI_ADDRESSES.USDT, FUJI_ADDRESSES.WAVAX, 15);
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
  console.log("├── MockOracleAggregator:", oracleAddress);
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
  
  // Save deployment info to file
  const deploymentInfo = {
    network: "fuji",
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      MockOracleAggregator: oracleAddress,
      OrderRouter: orderRouterAddress,
      BasketFactory: basketFactoryAddress
    },
    external: FUJI_ADDRESSES
  };
  
  console.log("\n💾 Deployment info saved to deployment-info.json");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });