import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

import { 
  BasketFactoryV2, 
  BasketVaultERC7540, 
  MockERC20, 
  MockOracleAggregator,
  MockOrderRouter 
} from "../../typechain-types";

describe("Integration Tests - Factory + Vault", function () {
  const CREATION_FEE = ethers.parseEther("0.1");
  const DEPOSIT_AMOUNT = ethers.parseUnits("1000", 6); // 1000 USDC
  const PROCESSING_DELAY = 3600; // 1 hour

  async function deployIntegrationFixture() {
    const [owner, creator, user1, user2, securityCouncil] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20Factory.deploy("USD Coin", "USDC", 6);
    const weth = await MockERC20Factory.deploy("Wrapped Ethereum", "WETH", 18);
    const wbtc = await MockERC20Factory.deploy("Wrapped Bitcoin", "WBTC", 8);
    const dai = await MockERC20Factory.deploy("Dai Stablecoin", "DAI", 18);

    // Deploy mock oracle with prices
    const MockOracleAggregatorFactory = await ethers.getContractFactory("MockOracleAggregator");
    const oracle = await MockOracleAggregatorFactory.deploy();
    await oracle.setPrice(usdc.target, ethers.parseUnits("1", 18));
    await oracle.setPrice(weth.target, ethers.parseUnits("2000", 18));
    await oracle.setPrice(wbtc.target, ethers.parseUnits("40000", 18));
    await oracle.setPrice(dai.target, ethers.parseUnits("1", 18));

    // Deploy mock order router
    const MockOrderRouterFactory = await ethers.getContractFactory("MockOrderRouter");
    const orderRouter = await MockOrderRouterFactory.deploy();

    // Deploy factory
    const BasketFactoryV2Factory = await ethers.getContractFactory("BasketFactoryV2");
    const factory = await BasketFactoryV2Factory.connect(owner).deploy(
      oracle.target,
      securityCouncil.address,
      orderRouter.target
    );

    await factory.connect(owner).setCreationFee(CREATION_FEE);

    // Mint tokens to users
    await usdc.mint(user1.address, DEPOSIT_AMOUNT * 10n);
    await usdc.mint(user2.address, DEPOSIT_AMOUNT * 10n);

    return {
      factory,
      oracle,
      orderRouter,
      usdc,
      weth,
      wbtc,
      dai,
      owner,
      creator,
      user1,
      user2,
      securityCouncil
    };
  }

  describe("Factory-Vault Integration", function () {
    it("Should create basket and allow vault operations", async function () {
      const { factory, creator, user1, usdc, weth, wbtc, dai } = await loadFixture(deployIntegrationFixture);

      // Create basket
      const assets = [weth.target, wbtc.target, dai.target];
      const weights = [3000, 4000, 3000];
      
      const tx = await factory.connect(creator).createBasket(
        assets,
        weights,
        usdc.target,
        "Integration Test Basket",
        "ITB",
        { value: CREATION_FEE }
      );

      const receipt = await tx.wait();
      
      // Find the BasketCreated event in the logs
      let basketCreatedEvent = null;
      for (const log of receipt.logs) {
        try {
          const parsed = factory.interface.parseLog(log);
          if (parsed?.name === "BasketCreated") {
            basketCreatedEvent = parsed;
            break;
          }
        } catch (e) {
          // Ignore parsing errors for non-factory logs
        }
      }
      
      const vaultAddress = basketCreatedEvent?.args?.basket;

      // Get vault instance
      const BasketVaultERC7540Factory = await ethers.getContractFactory("BasketVaultERC7540");
      const vault = BasketVaultERC7540Factory.attach(vaultAddress) as BasketVaultERC7540;

      // Approve and deposit
      await usdc.connect(user1).approve(vault.target, ethers.MaxUint256);
      
      await expect(vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address))
        .to.emit(vault, "Deposit");

      expect(await vault.balanceOf(user1.address)).to.be.gt(0);
      expect(await vault.totalAssets()).to.equal(DEPOSIT_AMOUNT);
    });

    it("Should handle async deposit workflow", async function () {
      const { factory, creator, user1, owner, usdc, weth, wbtc, dai } = await loadFixture(deployIntegrationFixture);

      // Create basket
      const assets = [weth.target, wbtc.target, dai.target];
      const weights = [3000, 4000, 3000];
      
      const tx = await factory.connect(creator).createBasket(
        assets,
        weights,
        usdc.target,
        "Async Test Basket",
        "ATB",
        { value: CREATION_FEE }
      );

      const receipt = await tx.wait();
      
      // Find the BasketCreated event in the logs
      let basketCreatedEvent = null;
      for (const log of receipt.logs) {
        try {
          const parsed = factory.interface.parseLog(log);
          if (parsed?.name === "BasketCreated") {
            basketCreatedEvent = parsed;
            break;
          }
        } catch (e) {
          // Ignore parsing errors for non-factory logs
        }
      }
      
      const vaultAddress = basketCreatedEvent?.args?.basket;

      const BasketVaultERC7540Factory = await ethers.getContractFactory("BasketVaultERC7540");
      const vault = BasketVaultERC7540Factory.attach(vaultAddress) as BasketVaultERC7540;

      // Setup user
      await usdc.connect(user1).approve(vault.target, ethers.MaxUint256);

      // Request async deposit
      await expect(vault.connect(user1).requestDeposit(DEPOSIT_AMOUNT, user1.address, user1.address))
        .to.emit(vault, "DepositRequest");

      // Process after delay
      await time.increase(PROCESSING_DELAY + 1);
      await vault.connect(owner).processDepositRequest(0);

      // Verify request is claimable
      expect(await vault.claimableDepositRequest(0, user1.address)).to.equal(DEPOSIT_AMOUNT);

      // Note: Claiming would require the ERC-7540 deposit function with controller parameter
      // This demonstrates the async workflow is set up correctly
    });

    it("Should allow multiple users on same vault", async function () {
      const { factory, creator, user1, user2, usdc, weth, wbtc, dai } = await loadFixture(deployIntegrationFixture);

      // Create basket
      const assets = [weth.target, wbtc.target, dai.target];
      const weights = [3000, 4000, 3000];
      
      const tx = await factory.connect(creator).createBasket(
        assets,
        weights,
        usdc.target,
        "Multi User Basket",
        "MUB",
        { value: CREATION_FEE }
      );

      const receipt = await tx.wait();
      
      // Find the BasketCreated event in the logs
      let basketCreatedEvent = null;
      for (const log of receipt.logs) {
        try {
          const parsed = factory.interface.parseLog(log);
          if (parsed?.name === "BasketCreated") {
            basketCreatedEvent = parsed;
            break;
          }
        } catch (e) {
          // Ignore parsing errors for non-factory logs
        }
      }
      
      const vaultAddress = basketCreatedEvent?.args?.basket;

      const BasketVaultERC7540Factory = await ethers.getContractFactory("BasketVaultERC7540");
      const vault = BasketVaultERC7540Factory.attach(vaultAddress) as BasketVaultERC7540;

      // Setup both users
      await usdc.connect(user1).approve(vault.target, ethers.MaxUint256);
      await usdc.connect(user2).approve(vault.target, ethers.MaxUint256);

      // Both users deposit
      const depositAmount1 = DEPOSIT_AMOUNT;
      const depositAmount2 = DEPOSIT_AMOUNT * 2n;

      await vault.connect(user1).deposit(depositAmount1, user1.address);
      await vault.connect(user2).deposit(depositAmount2, user2.address);

      // Check balances
      const shares1 = await vault.balanceOf(user1.address);
      const shares2 = await vault.balanceOf(user2.address);

      expect(shares1).to.be.gt(0);
      expect(shares2).to.be.gt(shares1); // user2 deposited more
      expect(await vault.totalAssets()).to.equal(depositAmount1 + depositAmount2);

      // User1 withdraws
      await vault.connect(user1).withdraw(depositAmount1, user1.address, user1.address);
      
      expect(await vault.balanceOf(user1.address)).to.equal(0);
      expect(await vault.balanceOf(user2.address)).to.equal(shares2); // unchanged
    });
  });

  describe("Vault Administration", function () {
    it("Should allow owner to manage vault settings", async function () {
      const { factory, creator, owner, usdc, weth, wbtc, dai } = await loadFixture(deployIntegrationFixture);

      // Create basket
      const assets = [weth.target, wbtc.target, dai.target];
      const weights = [3000, 4000, 3000];
      
      const tx = await factory.connect(creator).createBasket(
        assets,
        weights,
        usdc.target,
        "Admin Test Basket",
        "ATB",
        { value: CREATION_FEE }
      );

      const receipt = await tx.wait();
      
      // Find the BasketCreated event in the logs
      let basketCreatedEvent = null;
      for (const log of receipt.logs) {
        try {
          const parsed = factory.interface.parseLog(log);
          if (parsed?.name === "BasketCreated") {
            basketCreatedEvent = parsed;
            break;
          }
        } catch (e) {
          // Ignore parsing errors for non-factory logs
        }
      }
      
      const vaultAddress = basketCreatedEvent?.args?.basket;

      const BasketVaultERC7540Factory = await ethers.getContractFactory("BasketVaultERC7540");
      const vault = BasketVaultERC7540Factory.attach(vaultAddress) as BasketVaultERC7540;

      // Note: The vault owner is initially the factory's owner, not the creator
      // This might need adjustment in the factory implementation

      // Test processing delay update
      const newDelay = 7200; // 2 hours
      await expect(vault.connect(owner).setProcessingDelay(newDelay))
        .to.emit(vault, "ProcessingDelayUpdated")
        .withArgs(newDelay);

      expect(await vault.processingDelay()).to.equal(newDelay);

      // Test emergency pause
      await expect(vault.connect(owner).emergencyPause())
        .to.emit(vault, "EmergencyPaused");

      expect(await vault.emergencyPaused()).to.be.true;
    });
  });

  describe("Multiple Baskets", function () {
    it("Should handle multiple independent baskets", async function () {
      const { factory, creator, user1, user2, usdc, weth, wbtc, dai } = await loadFixture(deployIntegrationFixture);

      // Create first basket
      const tx1 = await factory.connect(creator).createBasket(
        [weth.target, wbtc.target, dai.target],
        [4000, 3000, 3000],
        usdc.target,
        "Basket One",
        "B1",
        { value: CREATION_FEE }
      );

      // Create second basket with different config
      const tx2 = await factory.connect(creator).createBasket(
        [weth.target, dai.target, wbtc.target], // Different order
        [5000, 3000, 2000], // Different weights
        usdc.target,
        "Basket Two",
        "B2",
        { value: CREATION_FEE }
      );

      const receipt1 = await tx1.wait();
      const receipt2 = await tx2.wait();
      
      // Parse events from receipts
      let vault1Address = null;
      for (const log of receipt1.logs) {
        try {
          const parsed = factory.interface.parseLog(log);
          if (parsed?.name === "BasketCreated") {
            vault1Address = parsed.args?.basket;
            break;
          }
        } catch (e) {}
      }
      
      let vault2Address = null;
      for (const log of receipt2.logs) {
        try {
          const parsed = factory.interface.parseLog(log);
          if (parsed?.name === "BasketCreated") {
            vault2Address = parsed.args?.basket;
            break;
          }
        } catch (e) {}
      }

      expect(vault1Address).to.not.equal(vault2Address);

      const BasketVaultERC7540Factory = await ethers.getContractFactory("BasketVaultERC7540");
      const vault1 = BasketVaultERC7540Factory.attach(vault1Address) as BasketVaultERC7540;
      const vault2 = BasketVaultERC7540Factory.attach(vault2Address) as BasketVaultERC7540;

      // Setup users for both vaults
      await usdc.connect(user1).approve(vault1.target, ethers.MaxUint256);
      await usdc.connect(user2).approve(vault2.target, ethers.MaxUint256);

      // Users deposit into different vaults
      await vault1.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address);
      await vault2.connect(user2).deposit(DEPOSIT_AMOUNT * 2n, user2.address);

      // Check independent operation
      expect(await vault1.balanceOf(user1.address)).to.be.gt(0);
      expect(await vault1.balanceOf(user2.address)).to.equal(0);
      
      expect(await vault2.balanceOf(user2.address)).to.be.gt(0);
      expect(await vault2.balanceOf(user1.address)).to.equal(0);

      expect(await vault1.totalAssets()).to.equal(DEPOSIT_AMOUNT);
      expect(await vault2.totalAssets()).to.equal(DEPOSIT_AMOUNT * 2n);
    });
  });

  describe("Error Scenarios", function () {
    it("Should handle vault interaction failures gracefully", async function () {
      const { factory, creator, user1, usdc, weth, wbtc, dai } = await loadFixture(deployIntegrationFixture);

      // Create basket
      const assets = [weth.target, wbtc.target, dai.target];
      const weights = [3000, 4000, 3000];
      
      const tx = await factory.connect(creator).createBasket(
        assets,
        weights,
        usdc.target,
        "Error Test Basket",
        "ETB",
        { value: CREATION_FEE }
      );

      const receipt = await tx.wait();
      
      // Find the BasketCreated event in the logs
      let basketCreatedEvent = null;
      for (const log of receipt.logs) {
        try {
          const parsed = factory.interface.parseLog(log);
          if (parsed?.name === "BasketCreated") {
            basketCreatedEvent = parsed;
            break;
          }
        } catch (e) {
          // Ignore parsing errors for non-factory logs
        }
      }
      
      const vaultAddress = basketCreatedEvent?.args?.basket;

      const BasketVaultERC7540Factory = await ethers.getContractFactory("BasketVaultERC7540");
      const vault = BasketVaultERC7540Factory.attach(vaultAddress) as BasketVaultERC7540;

      // Test deposit without approval
      await expect(vault.connect(user1).deposit(DEPOSIT_AMOUNT, user1.address))
        .to.be.reverted;

      // Test deposit with zero amount - ERC4626 allows this, returns 0 shares
      await usdc.connect(user1).approve(vault.target, ethers.MaxUint256);
      await expect(vault.connect(user1).deposit(0, user1.address))
        .to.emit(vault, "Deposit")
        .withArgs(user1.address, user1.address, 0, 0);

      // Test withdrawal without balance
      await expect(vault.connect(user1).withdraw(DEPOSIT_AMOUNT, user1.address, user1.address))
        .to.be.reverted;
    });
  });
});