import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { 
  BasketFactoryV2, 
  BasketVaultERC7540, 
  MockERC20, 
  MockOracleAggregator,
  MockOrderRouter 
} from "../../typechain-types";

describe("BasketFactoryV2", function () {
  // Test constants
  const CREATION_FEE = ethers.parseEther("0.1");
  const WEIGHTS_100_PERCENT = 10000;

  async function deployFactoryFixture() {
    const [owner, creator, user1, securityCouncil] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20Factory.deploy("USD Coin", "USDC", 6);
    const weth = await MockERC20Factory.deploy("Wrapped Ethereum", "WETH", 18);
    const wbtc = await MockERC20Factory.deploy("Wrapped Bitcoin", "WBTC", 8);
    const dai = await MockERC20Factory.deploy("Dai Stablecoin", "DAI", 18);

    // Deploy mock oracle
    const MockOracleAggregatorFactory = await ethers.getContractFactory("MockOracleAggregator");
    const oracle = await MockOracleAggregatorFactory.deploy();

    // Set prices for assets
    await oracle.setPrice(weth.target, ethers.parseUnits("2000", 18)); // $2000
    await oracle.setPrice(wbtc.target, ethers.parseUnits("40000", 18)); // $40000
    await oracle.setPrice(dai.target, ethers.parseUnits("1", 18)); // $1

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

    // Set creation fee
    await factory.connect(owner).setCreationFee(CREATION_FEE);

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
      securityCouncil
    };
  }

  describe("Deployment & Initial State", function () {
    it("Should deploy with correct initial state", async function () {
      const { factory, oracle, orderRouter, securityCouncil, owner } = await loadFixture(deployFactoryFixture);

      expect(await factory.owner()).to.equal(owner.address);
      expect(await factory.oracleAggregator()).to.equal(oracle.target);
      expect(await factory.securityCouncil()).to.equal(securityCouncil.address);
      expect(await factory.orderRouter()).to.equal(orderRouter.target);
      expect(await factory.basketCreationFee()).to.equal(CREATION_FEE);
      expect(await factory.basketCreationPaused()).to.be.false;
      expect(await factory.getBasketCount()).to.equal(0);
    });

    it("Should set correct constants", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);

      expect(await factory.MIN_ASSETS()).to.equal(3);
      expect(await factory.MAX_ASSETS()).to.equal(10);
      expect(await factory.TOTAL_WEIGHT()).to.equal(WEIGHTS_100_PERCENT);
    });

    it("Should reject deployment with invalid parameters", async function () {
      const BasketFactoryV2Factory = await ethers.getContractFactory("BasketFactoryV2");
      
      await expect(BasketFactoryV2Factory.deploy(
        ethers.ZeroAddress,
        ethers.ZeroAddress, 
        ethers.ZeroAddress
      )).to.be.revertedWithCustomError(BasketFactoryV2Factory, "InvalidInput");
    });
  });

  describe("Basket Creation", function () {
    describe("Valid Basket Creation", function () {
      it("Should create a valid basket", async function () {
        const { factory, creator, usdc, weth, wbtc, dai } = await loadFixture(deployFactoryFixture);

        const assets = [weth.target, wbtc.target, dai.target];
        const weights = [3000, 4000, 3000]; // 30%, 40%, 30%
        const name = "Test Basket";
        const symbol = "TB";

        await expect(factory.connect(creator).createBasket(
          assets,
          weights,
          usdc.target,
          name,
          symbol,
          { value: CREATION_FEE }
        )).to.emit(factory, "BasketCreated");

        expect(await factory.getBasketCount()).to.equal(1);
        
        const baskets = await factory.getAllBaskets();
        expect(baskets).to.have.length(1);
        
        const creatorBaskets = await factory.getBasketsByCreator(creator.address);
        expect(creatorBaskets).to.have.length(1);
        expect(creatorBaskets[0]).to.equal(baskets[0]);
      });

      it("Should deploy ERC-7540 vault with correct configuration", async function () {
        const { factory, creator, usdc, weth, wbtc, dai } = await loadFixture(deployFactoryFixture);

        const assets = [weth.target, wbtc.target, dai.target];
        const weights = [3000, 4000, 3000];

        const tx = await factory.connect(creator).createBasket(
          assets,
          weights,
          usdc.target,
          "Test Basket",
          "TB",
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

        // Get the deployed vault
        const BasketVaultERC7540Factory = await ethers.getContractFactory("BasketVaultERC7540");
        const vault = BasketVaultERC7540Factory.attach(vaultAddress) as BasketVaultERC7540;

        expect(await vault.asset()).to.equal(usdc.target);
        expect(await vault.name()).to.equal("Test Basket Vault");
        expect(await vault.symbol()).to.equal("TBV");
        expect(await vault.processingDelay()).to.equal(3600); // 1 hour
        
        // Check token authorizations
        expect(await vault.authorizedTokens(weth.target)).to.be.true;
        expect(await vault.authorizedTokens(wbtc.target)).to.be.true;
        expect(await vault.authorizedTokens(dai.target)).to.be.true;
        expect(await vault.authorizedTokens(usdc.target)).to.be.true;
      });

      it("Should handle maximum assets", async function () {
        const { factory, creator, usdc, oracle } = await loadFixture(deployFactoryFixture);

        // Create 10 assets (MAX_ASSETS)
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        const assets = [];
        const weights = [];
        
        for (let i = 0; i < 10; i++) {
          const token = await MockERC20Factory.deploy(`Token${i}`, `TK${i}`, 18);
          await oracle.setPrice(token.target, ethers.parseUnits("1", 18));
          assets.push(token.target);
          weights.push(1000); // 10% each
        }

        // This should work (exactly at limit)
        await expect(factory.connect(creator).createBasket(
          assets,
          weights,
          usdc.target,
          "Max Assets Basket",
          "MAB",
          { value: CREATION_FEE }
        )).to.not.be.reverted;
      });
    });

    describe("Input Validation", function () {
      it("Should reject insufficient creation fee", async function () {
        const { factory, creator, usdc, weth, wbtc, dai } = await loadFixture(deployFactoryFixture);

        const assets = [weth.target, wbtc.target, dai.target];
        const weights = [3000, 4000, 3000];

        await expect(factory.connect(creator).createBasket(
          assets,
          weights,
          usdc.target,
          "Test Basket",
          "TB",
          { value: CREATION_FEE - 1n }
        )).to.be.revertedWithCustomError(factory, "InsufficientFee");
      });

      it("Should reject too few assets", async function () {
        const { factory, creator, usdc, weth, wbtc } = await loadFixture(deployFactoryFixture);

        const assets = [weth.target, wbtc.target]; // Only 2 assets
        const weights = [5000, 5000];

        await expect(factory.connect(creator).createBasket(
          assets,
          weights,
          usdc.target,
          "Test Basket",
          "TB",
          { value: CREATION_FEE }
        )).to.be.revertedWithCustomError(factory, "InvalidAssetCount");
      });

      it("Should reject too many assets", async function () {
        const { factory, creator, usdc, oracle } = await loadFixture(deployFactoryFixture);

        // Create 11 assets (exceeds MAX_ASSETS)
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        const assets = [];
        const weights = [];
        
        for (let i = 0; i < 11; i++) {
          const token = await MockERC20Factory.deploy(`Token${i}`, `TK${i}`, 18);
          await oracle.setPrice(token.target, ethers.parseUnits("1", 18));
          assets.push(token.target);
          weights.push(909); // ~9.09% each (total ~100%)
        }
        weights[10] = 1001; // Adjust last weight to sum to 10000

        await expect(factory.connect(creator).createBasket(
          assets,
          weights,
          usdc.target,
          "Too Many Assets",
          "TMA",
          { value: CREATION_FEE }
        )).to.be.revertedWithCustomError(factory, "InvalidAssetCount");
      });

      it("Should reject mismatched array lengths", async function () {
        const { factory, creator, usdc, weth, wbtc, dai } = await loadFixture(deployFactoryFixture);

        const assets = [weth.target, wbtc.target, dai.target];
        const weights = [5000, 5000]; // Wrong length

        await expect(factory.connect(creator).createBasket(
          assets,
          weights,
          usdc.target,
          "Test Basket",
          "TB",
          { value: CREATION_FEE }
        )).to.be.revertedWithCustomError(factory, "InvalidInput");
      });

      it("Should reject invalid weights", async function () {
        const { factory, creator, usdc, weth, wbtc, dai } = await loadFixture(deployFactoryFixture);

        const assets = [weth.target, wbtc.target, dai.target];
        
        // Test zero weight
        await expect(factory.connect(creator).createBasket(
          assets,
          [0, 5000, 5000],
          usdc.target,
          "Test Basket",
          "TB",
          { value: CREATION_FEE }
        )).to.be.revertedWithCustomError(factory, "InvalidWeights");

        // Test weights not summing to 10000
        await expect(factory.connect(creator).createBasket(
          assets,
          [3000, 4000, 2000], // Sum = 9000
          usdc.target,
          "Test Basket",
          "TB",
          { value: CREATION_FEE }
        )).to.be.revertedWithCustomError(factory, "InvalidWeights");
      });

      it("Should reject empty name or symbol", async function () {
        const { factory, creator, usdc, weth, wbtc, dai } = await loadFixture(deployFactoryFixture);

        const assets = [weth.target, wbtc.target, dai.target];
        const weights = [3000, 4000, 3000];

        await expect(factory.connect(creator).createBasket(
          assets,
          weights,
          usdc.target,
          "", // Empty name
          "TB",
          { value: CREATION_FEE }
        )).to.be.revertedWithCustomError(factory, "InvalidInput");

        await expect(factory.connect(creator).createBasket(
          assets,
          weights,
          usdc.target,
          "Test Basket",
          "", // Empty symbol
          { value: CREATION_FEE }
        )).to.be.revertedWithCustomError(factory, "InvalidInput");
      });

      it("Should reject duplicate assets", async function () {
        const { factory, creator, usdc, weth, wbtc } = await loadFixture(deployFactoryFixture);

        const assets = [weth.target, wbtc.target, weth.target]; // Duplicate WETH
        const weights = [3000, 4000, 3000];

        await expect(factory.connect(creator).createBasket(
          assets,
          weights,
          usdc.target,
          "Test Basket",
          "TB",
          { value: CREATION_FEE }
        )).to.be.revertedWithCustomError(factory, "DuplicateAsset");
      });

      it("Should reject asset same as base token", async function () {
        const { factory, creator, usdc, weth, wbtc } = await loadFixture(deployFactoryFixture);

        const assets = [weth.target, wbtc.target, usdc.target]; // USDC in assets
        const weights = [3000, 4000, 3000];

        await expect(factory.connect(creator).createBasket(
          assets,
          weights,
          usdc.target, // Same as base token
          "Test Basket",
          "TB",
          { value: CREATION_FEE }
        )).to.be.revertedWithCustomError(factory, "InvalidInput");
      });

      it("Should reject assets without oracle prices", async function () {
        const { factory, creator, usdc, weth, wbtc } = await loadFixture(deployFactoryFixture);

        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        const unpricedToken = await MockERC20Factory.deploy("Unpriced Token", "UPT", 18);

        const assets = [weth.target, wbtc.target, unpricedToken.target];
        const weights = [3000, 4000, 3000];

        await expect(factory.connect(creator).createBasket(
          assets,
          weights,
          usdc.target,
          "Test Basket",
          "TB",
          { value: CREATION_FEE }
        )).to.be.revertedWithCustomError(factory, "AssetNotSupported");
      });

      it("Should reject duplicate basket configurations", async function () {
        const { factory, creator, user1, usdc, weth, wbtc, dai } = await loadFixture(deployFactoryFixture);

        const assets = [weth.target, wbtc.target, dai.target];
        const weights = [3000, 4000, 3000];

        // Create first basket
        await factory.connect(creator).createBasket(
          assets,
          weights,
          usdc.target,
          "Test Basket",
          "TB",
          { value: CREATION_FEE }
        );

        // Try to create identical basket (should fail)
        await expect(factory.connect(user1).createBasket(
          assets,
          weights,
          usdc.target,
          "Different Name", // Different name/symbol but same config
          "DN",
          { value: CREATION_FEE }
        )).to.be.revertedWithCustomError(factory, "BasketExists");
      });
    });

    describe("Basket Creation Pausing", function () {
      it("Should pause and unpause basket creation", async function () {
        const { factory, owner } = await loadFixture(deployFactoryFixture);

        await expect(factory.connect(owner).pauseBasketCreation())
          .to.emit(factory, "BasketCreationPaused");

        expect(await factory.basketCreationPaused()).to.be.true;

        await expect(factory.connect(owner).unpauseBasketCreation())
          .to.emit(factory, "BasketCreationUnpaused");

        expect(await factory.basketCreationPaused()).to.be.false;
      });

      it("Should block basket creation when paused", async function () {
        const { factory, owner, creator, usdc, weth, wbtc, dai } = await loadFixture(deployFactoryFixture);

        await factory.connect(owner).pauseBasketCreation();

        const assets = [weth.target, wbtc.target, dai.target];
        const weights = [3000, 4000, 3000];

        await expect(factory.connect(creator).createBasket(
          assets,
          weights,
          usdc.target,
          "Test Basket",
          "TB",
          { value: CREATION_FEE }
        )).to.be.revertedWithCustomError(factory, "CreationPaused");
      });
    });
  });

  describe("Fee Management", function () {
    it("Should update creation fee", async function () {
      const { factory, owner } = await loadFixture(deployFactoryFixture);

      const newFee = ethers.parseEther("0.2");
      
      await expect(factory.connect(owner).setCreationFee(newFee))
        .to.emit(factory, "CreationFeeUpdated")
        .withArgs(newFee);

      expect(await factory.basketCreationFee()).to.equal(newFee);
    });

    it("Should allow zero creation fee", async function () {
      const { factory, owner, creator, usdc, weth, wbtc, dai } = await loadFixture(deployFactoryFixture);

      await factory.connect(owner).setCreationFee(0);

      const assets = [weth.target, wbtc.target, dai.target];
      const weights = [3000, 4000, 3000];

      // Should work with no fee
      await expect(factory.connect(creator).createBasket(
        assets,
        weights,
        usdc.target,
        "Free Basket",
        "FB",
        { value: 0 }
      )).to.not.be.reverted;
    });

    it("Should withdraw accumulated fees", async function () {
      const { factory, owner, creator, usdc, weth, wbtc, dai } = await loadFixture(deployFactoryFixture);

      // Create a basket to generate fees
      const assets = [weth.target, wbtc.target, dai.target];
      const weights = [3000, 4000, 3000];

      await factory.connect(creator).createBasket(
        assets,
        weights,
        usdc.target,
        "Test Basket",
        "TB",
        { value: CREATION_FEE }
      );

      const balanceBefore = await ethers.provider.getBalance(owner.address);
      
      await factory.connect(owner).withdrawFees(owner.address);
      
      const balanceAfter = await ethers.provider.getBalance(owner.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should reject fee withdrawal to zero address", async function () {
      const { factory, owner } = await loadFixture(deployFactoryFixture);

      await expect(factory.connect(owner).withdrawFees(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(factory, "InvalidInput");
    });
  });

  describe("Access Control", function () {
    it("Should restrict admin functions to owner", async function () {
      const { factory, creator } = await loadFixture(deployFactoryFixture);

      await expect(factory.connect(creator).pauseBasketCreation())
        .to.be.reverted;

      await expect(factory.connect(creator).setCreationFee(0))
        .to.be.reverted;

      await expect(factory.connect(creator).withdrawFees(creator.address))
        .to.be.reverted;
    });
  });

  describe("View Functions", function () {
    it("Should track baskets correctly", async function () {
      const { factory, creator, user1, usdc, weth, wbtc, dai } = await loadFixture(deployFactoryFixture);

      const assets = [weth.target, wbtc.target, dai.target];
      const weights = [3000, 4000, 3000];

      // Creator creates first basket
      await factory.connect(creator).createBasket(
        assets,
        weights,
        usdc.target,
        "Creator Basket",
        "CB",
        { value: CREATION_FEE }
      );

      // User1 creates second basket (different assets)
      await factory.connect(user1).createBasket(
        [weth.target, wbtc.target, dai.target].reverse(), // Different order = different config
        [4000, 3000, 3000], // Different weights
        usdc.target,
        "User Basket",
        "UB",
        { value: CREATION_FEE }
      );

      expect(await factory.getBasketCount()).to.equal(2);

      const allBaskets = await factory.getAllBaskets();
      expect(allBaskets).to.have.length(2);

      const creatorBaskets = await factory.getBasketsByCreator(creator.address);
      expect(creatorBaskets).to.have.length(1);

      const user1Baskets = await factory.getBasketsByCreator(user1.address);
      expect(user1Baskets).to.have.length(1);

      // Verify isValidBasket mapping
      expect(await factory.isValidBasket(allBaskets[0])).to.be.true;
      expect(await factory.isValidBasket(allBaskets[1])).to.be.true;
      expect(await factory.isValidBasket(ethers.ZeroAddress)).to.be.false;
    });

    it("Should handle empty results correctly", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);

      expect(await factory.getBasketCount()).to.equal(0);
      expect(await factory.getAllBaskets()).to.have.length(0);
      expect(await factory.getBasketsByCreator(user1.address)).to.have.length(0);
    });
  });

  describe("Hash Collision Resistance", function () {
    it("Should handle asset order differences", async function () {
      const { factory, creator, user1, usdc, weth, wbtc, dai } = await loadFixture(deployFactoryFixture);

      // Same assets, different order - should create different baskets
      const assets1 = [weth.target, wbtc.target, dai.target];
      const assets2 = [dai.target, weth.target, wbtc.target];
      const weights = [3000, 4000, 3000];

      await factory.connect(creator).createBasket(
        assets1,
        weights,
        usdc.target,
        "Basket 1",
        "B1",
        { value: CREATION_FEE }
      );

      // This should work because internal sorting will make them different
      await factory.connect(user1).createBasket(
        assets2,
        weights, // Same weights but assets are in different order
        usdc.target,
        "Basket 2",
        "B2",
        { value: CREATION_FEE }
      );

      expect(await factory.getBasketCount()).to.equal(2);
    });
  });
});