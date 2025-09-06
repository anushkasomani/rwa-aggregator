import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { 
  BasketFactory, 
  MultiAssetVault, 
  MockERC20, 
  MockOracleAggregator, 
  MockOrderRouter 
} from "../../typechain-types";

export interface TestContracts {
  basketFactory: BasketFactory;
  mockUSDC: MockERC20;
  mockUSDT: MockERC20;
  mockWAVAX: MockERC20;
  oracleAggregator: MockOracleAggregator;
  orderRouter: MockOrderRouter;
}

export interface TestUsers {
  owner: SignerWithAddress;
  alice: SignerWithAddress;
  bob: SignerWithAddress;
  bot: SignerWithAddress;
}

export const DECIMALS = {
  USDC: 6,
  USDT: 6,
  WAVAX: 18  // Keep 18 for WAVAX on Fuji
};

export const INITIAL_PRICES = {
  USDC: ethers.parseUnits("1", 18), // $1.00
  USDT: ethers.parseUnits("1", 18), // $1.00
  WAVAX: ethers.parseUnits("35", 18) // $35.00 (approximate AVAX price)
};

export const EXCHANGE_RATES = {
  USDC_TO_USDT: ethers.parseUnits("1", 18), // 1 USDC = 1 USDT
  USDC_TO_WAVAX: ethers.parseUnits("0.028571428571428571", 18), // 1 USDC = ~0.0286 WAVAX (1/35)
  USDT_TO_USDC: ethers.parseUnits("1", 18), // 1 USDT = 1 USDC
  USDT_TO_WAVAX: ethers.parseUnits("0.028571428571428571", 18), // 1 USDT = ~0.0286 WAVAX
  WAVAX_TO_USDC: ethers.parseUnits("35", 18), // 1 WAVAX = 35 USDC
  WAVAX_TO_USDT: ethers.parseUnits("35", 18)  // 1 WAVAX = 35 USDT
};

export async function deployTestContracts(): Promise<TestContracts> {
  // Deploy mock tokens
  const MockERC20Factory = await ethers.getContractFactory("MockERC20");
  
  const mockUSDC = await MockERC20Factory.deploy("USD Coin", "USDC", DECIMALS.USDC);
  const mockUSDT = await MockERC20Factory.deploy("Tether USD", "USDT", DECIMALS.USDT);
  const mockWAVAX = await MockERC20Factory.deploy("Wrapped AVAX", "WAVAX", DECIMALS.WAVAX);

  // Deploy oracle aggregator
  const MockOracleAggregatorFactory = await ethers.getContractFactory("MockOracleAggregator");
  const oracleAggregator = await MockOracleAggregatorFactory.deploy();

  // Set initial prices
  await oracleAggregator.setPrice(await mockUSDC.getAddress(), INITIAL_PRICES.USDC);
  await oracleAggregator.setPrice(await mockUSDT.getAddress(), INITIAL_PRICES.USDT);
  await oracleAggregator.setPrice(await mockWAVAX.getAddress(), INITIAL_PRICES.WAVAX);

  // Deploy order router
  const MockOrderRouterFactory = await ethers.getContractFactory("MockOrderRouter");
  const orderRouter = await MockOrderRouterFactory.deploy();

  // Set exchange rates
  await orderRouter.setExchangeRate(await mockUSDC.getAddress(), await mockUSDT.getAddress(), EXCHANGE_RATES.USDC_TO_USDT);
  await orderRouter.setExchangeRate(await mockUSDC.getAddress(), await mockWAVAX.getAddress(), EXCHANGE_RATES.USDC_TO_WAVAX);
  await orderRouter.setExchangeRate(await mockUSDT.getAddress(), await mockUSDC.getAddress(), EXCHANGE_RATES.USDT_TO_USDC);
  await orderRouter.setExchangeRate(await mockUSDT.getAddress(), await mockWAVAX.getAddress(), EXCHANGE_RATES.USDT_TO_WAVAX);
  await orderRouter.setExchangeRate(await mockWAVAX.getAddress(), await mockUSDC.getAddress(), EXCHANGE_RATES.WAVAX_TO_USDC);
  await orderRouter.setExchangeRate(await mockWAVAX.getAddress(), await mockUSDT.getAddress(), EXCHANGE_RATES.WAVAX_TO_USDT);

  // Fund order router with tokens for swaps
  await mockUSDC.mint(await orderRouter.getAddress(), ethers.parseUnits("1000000", DECIMALS.USDC));
  await mockUSDT.mint(await orderRouter.getAddress(), ethers.parseUnits("1000000", DECIMALS.USDT));
  await mockWAVAX.mint(await orderRouter.getAddress(), ethers.parseUnits("1000000", DECIMALS.WAVAX));

  // Deploy basket factory
  const BasketFactoryFactory = await ethers.getContractFactory("BasketFactory");
  const basketFactory = await BasketFactoryFactory.deploy(
    await oracleAggregator.getAddress(),
    await orderRouter.getAddress()
  );

  return {
    basketFactory,
    mockUSDC,
    mockUSDT,
    mockWAVAX,
    oracleAggregator,
    orderRouter
  };
}

export async function getTestUsers(): Promise<TestUsers> {
  const [owner, alice, bob, bot] = await ethers.getSigners();
  return { owner, alice, bob, bot };
}

export async function fundUsers(contracts: TestContracts, users: TestUsers): Promise<void> {
  const fundAmount = ethers.parseUnits("10000", DECIMALS.USDC); // 10,000 USDC

  // Fund alice and bob with USDC for testing
  await contracts.mockUSDC.mint(users.alice.address, fundAmount);
  await contracts.mockUSDC.mint(users.bob.address, fundAmount);
}

export function getDefaultBasketConfig(contracts: TestContracts) {
  return {
    assets: [
      contracts.mockUSDT.getAddress(),
      contracts.mockWAVAX.getAddress()
    ],
    weights: [6000, 4000], // 60% USDT, 40% WAVAX (only 2 assets since USDC is base)
    baseToken: contracts.mockUSDC.getAddress(),
    name: "Test Basket",
    symbol: "TB"
  };
}

export async function createBasket(
  contracts: TestContracts,
  user: SignerWithAddress,
  config?: any
): Promise<string> {
  const basketConfig = config || getDefaultBasketConfig(contracts);
  
  // Resolve addresses if they're promises
  const assets = await Promise.all(basketConfig.assets);
  const baseToken = await basketConfig.baseToken;
  
  const tx = await contracts.basketFactory.connect(user).createBasket(
    assets,
    basketConfig.weights,
    baseToken,
    basketConfig.name,
    basketConfig.symbol
  );
  
  const receipt = await tx.wait();
  const event = receipt?.logs.find(log => {
    try {
      const parsed = contracts.basketFactory.interface.parseLog({
        topics: log.topics,
        data: log.data
      });
      return parsed?.name === 'BasketCreated';
    } catch {
      return false;
    }
  });
  
  if (!event) {
    throw new Error("BasketCreated event not found");
  }
  
  const parsedEvent = contracts.basketFactory.interface.parseLog({
    topics: event.topics,
    data: event.data
  });
  
  return parsedEvent?.args.basket;
}

export const CONSTANTS = {
  MIN_DEPOSIT: ethers.parseUnits("10", DECIMALS.USDC), // 10 USDC
  MIN_REDEMPTION: ethers.parseUnits("0.001", 18), // 0.001 shares
  TOTAL_WEIGHT: 10000,
  NAV_SCALE: ethers.parseUnits("1", 18)
};