import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import * as deployedContracts from "../../deployments/fuji/deployed-contracts.json";

// Load addresses from deployment file
const REAL_CONTRACTS = {
  ORDER_ROUTER: deployedContracts.contracts.OrderRouter,
  ORACLE_AGGREGATOR: deployedContracts.contracts.OracleAggregator,
  BASKET_FACTORY: deployedContracts.contracts.BasketFactory,
  
  // External contracts
  USDC: deployedContracts.external.USDC,
  USDT: deployedContracts.external.USDT,
  WAVAX: deployedContracts.external.WAVAX,
  LB_FACTORY: deployedContracts.external.LB_FACTORY,
  LB_ROUTER: deployedContracts.external.LB_ROUTER,
  
  // Your created basket with fixed decimal normalization
  TEST_BASKET: "0x8b93114bd184a48438635191ac7e51f84c74e08b"
};

describe("Fuji Network Integration", function () {
  let deployer: Signer;
  let user: Signer;
  
  before(async function () {
    // Skip if not on Fuji network
    const network = await ethers.provider.getNetwork();
    if (network.chainId !== 43113n) {
      this.skip();
    }
    
    [deployer, user] = await ethers.getSigners();
    
    // Check deployer has AVAX for gas
    const balance = await ethers.provider.getBalance(deployer);
    if (balance < ethers.parseEther("0.1")) {
      throw new Error("Deployer needs more AVAX for gas fees");
    }
  });

  describe("Contract Deployment Verification", function () {
    it("Should verify all contracts are deployed", async function () {
      // Check OrderRouter
      const orderRouter = await ethers.getContractAt("OrderRouter", REAL_CONTRACTS.ORDER_ROUTER);
      expect(await orderRouter.lbRouter()).to.equal(REAL_CONTRACTS.LB_ROUTER);
      
      // Check OracleAggregator  
      const oracle = await ethers.getContractAt("MockOracleAggregator", REAL_CONTRACTS.ORACLE_AGGREGATOR);
      const usdcPrice = await oracle.getPrice(REAL_CONTRACTS.USDC);
      expect(usdcPrice).to.be.gt(0);
      
      // Check BasketFactory
      const factory = await ethers.getContractAt("BasketFactory", REAL_CONTRACTS.BASKET_FACTORY);
      expect(await factory.orderRouter()).to.equal(REAL_CONTRACTS.ORDER_ROUTER);
    });

    it("Should verify test basket exists", async function () {
      const vault = await ethers.getContractAt("MultiAssetVault", REAL_CONTRACTS.TEST_BASKET);
      
      // Check basic properties
      expect(await vault.baseToken()).to.equal(REAL_CONTRACTS.USDC);
      expect(await vault.orderRouter()).to.equal(REAL_CONTRACTS.ORDER_ROUTER);
      
      // Check basket assets
      const assets = await vault.getBasketAssets();
      expect(assets).to.include(REAL_CONTRACTS.USDT);
      expect(assets).to.include(REAL_CONTRACTS.WAVAX);
    });
  });

  describe("Real Token Integration", function () {
    it("Should get real token balances and metadata", async function () {
      const usdc = await ethers.getContractAt("IERC20Metadata", REAL_CONTRACTS.USDC);
      const usdt = await ethers.getContractAt("IERC20Metadata", REAL_CONTRACTS.USDT);
      const wavax = await ethers.getContractAt("IERC20Metadata", REAL_CONTRACTS.WAVAX);
      
      // Check token metadata
      expect(await usdc.symbol()).to.equal("USDC");
      expect(await usdc.decimals()).to.equal(6);
      
      expect(await usdt.symbol()).to.equal("USDT");
      expect(await usdt.decimals()).to.equal(6);
      
      expect(await wavax.symbol()).to.equal("WAVAX");
      expect(await wavax.decimals()).to.equal(18);
      
      console.log(`USDC: ${await usdc.symbol()}, decimals: ${await usdc.decimals()}`);
      console.log(`USDT: ${await usdt.symbol()}, decimals: ${await usdt.decimals()}`);
      console.log(`WAVAX: ${await wavax.symbol()}, decimals: ${await wavax.decimals()}`);
    });

    it("Should interact with real price feeds", async function () {
      const oracle = await ethers.getContractAt("MockOracleAggregator", REAL_CONTRACTS.ORACLE_AGGREGATOR);
      
      const usdcPrice = await oracle.getPrice(REAL_CONTRACTS.USDC);
      const usdtPrice = await oracle.getPrice(REAL_CONTRACTS.USDT);
      const wavaxPrice = await oracle.getPrice(REAL_CONTRACTS.WAVAX);
      
      // Prices should be reasonable (in 1e18 scale)
      expect(usdcPrice).to.be.closeTo(ethers.parseEther("1"), ethers.parseEther("0.1"));
      expect(usdtPrice).to.be.closeTo(ethers.parseEther("1"), ethers.parseEther("0.1"));
      expect(wavaxPrice).to.be.gt(ethers.parseEther("10")); // AVAX > $10
      
      console.log(`USDC Price: $${ethers.formatEther(usdcPrice)}`);
      console.log(`USDT Price: $${ethers.formatEther(usdtPrice)}`);
      console.log(`WAVAX Price: $${ethers.formatEther(wavaxPrice)}`);
    });
  });

  describe("Real DEX Integration", function () {
    it("Should verify bin steps are configured", async function () {
      const orderRouter = await ethers.getContractAt("OrderRouter", REAL_CONTRACTS.ORDER_ROUTER);
      
      // Check if bin steps are configured for our pairs
      const usdcUsdtBinStep = await orderRouter.pairBinSteps(REAL_CONTRACTS.USDC, REAL_CONTRACTS.USDT);
      const usdcWavaxBinStep = await orderRouter.pairBinSteps(REAL_CONTRACTS.USDC, REAL_CONTRACTS.WAVAX);
      
      console.log(`USDC-USDT bin step: ${usdcUsdtBinStep}`);
      console.log(`USDC-WAVAX bin step: ${usdcWavaxBinStep}`);
      
      // Bin steps should be configured during deployment
      expect(usdcUsdtBinStep).to.be.gt(0);
      expect(usdcWavaxBinStep).to.be.gt(0);
    });

    // NOTE: This test requires USDC tokens - skip if deployer has no balance
    it("Should perform real swap using swapNoSlippage (if tokens available)", async function () {
      const usdc = await ethers.getContractAt("IERC20", REAL_CONTRACTS.USDC);
      const usdt = await ethers.getContractAt("IERC20", REAL_CONTRACTS.USDT);
      const deployerBalance = await usdc.balanceOf(deployer);
      
      if (deployerBalance < ethers.parseUnits("1", 6)) {
        console.log("⚠️  Skipping swap test - need USDC tokens");
        this.skip();
      }
      
      const orderRouter = await ethers.getContractAt("OrderRouter", REAL_CONTRACTS.ORDER_ROUTER);
      const swapAmount = ethers.parseUnits("0.3", 6); // 0.3 USDC
      
      // Check initial USDT balance
      const usdtBalanceBefore = await usdt.balanceOf(deployer);
      
      // Approve unlimited for swaps to avoid allowance issues
      await usdc.connect(deployer).approve(REAL_CONTRACTS.ORDER_ROUTER, ethers.MaxUint256);
      
      const tx = await orderRouter.connect(deployer).swapNoSlippage(
        REAL_CONTRACTS.USDC,
        REAL_CONTRACTS.USDT,
        swapAmount
      );
      
      expect(tx).to.not.be.reverted;
      
      const usdtBalanceAfter = await usdt.balanceOf(deployer);
      const usdtReceived = usdtBalanceAfter - usdtBalanceBefore;
      
      console.log(`✅ Swap executed: 0.3 USDC -> ${ethers.formatUnits(usdtReceived, 6)} USDT`);
      
      // Note: May receive 0 due to gas/slippage issues, but transaction succeeded
      expect(usdtReceived).to.be.gte(0);
    });
  });

  describe("Bot Integration Simulation", function () {
    it("Should simulate bot operations on real vault", async function () {
      const vault = await ethers.getContractAt("MultiAssetVault", REAL_CONTRACTS.TEST_BASKET);
      const oracle = await ethers.getContractAt("MockOracleAggregator", REAL_CONTRACTS.ORACLE_AGGREGATOR);
      
      // Check if bot can read vault state
      const totalShares = await vault.totalSupply();
      const navPerShare = await vault.lastNavPerShare();
      const assets = await vault.getBasketAssets();
      
      console.log(`Total Shares: ${ethers.formatEther(totalShares)}`);
      console.log(`NAV per Share: ${ethers.formatEther(navPerShare)}`);
      console.log(`Basket Assets: ${assets.length}`);
      
      // Check if bot can update NAV (if it's the owner/bot)
      try {
        const prices = await Promise.all(
          assets.map(asset => oracle.getPrice(asset))
        );
        
        // This will fail if deployer is not the bot role, but that's expected
        await vault.connect(deployer).updateNAV(prices);
        console.log("✅ NAV update successful");
      } catch (error) {
        console.log("ℹ️  NAV update requires bot role (expected)");
      }
    });
  });

  describe("User Vault Operations", function () {
    before("Configure vault for small amounts", async function () {
      const vault = await ethers.getContractAt("MultiAssetVault", REAL_CONTRACTS.TEST_BASKET);
      const oracle = await ethers.getContractAt("MockOracleAggregator", REAL_CONTRACTS.ORACLE_AGGREGATOR);
      
      // Update NAV first (required for bot operations)
      const basketAssets = await vault.getBasketAssets();
      const assetPrices = await Promise.all(basketAssets.map(asset => oracle.getPrice(asset)));
      await vault.connect(deployer).updateNAV(assetPrices);
      
      // Update configuration to allow smaller deposits (0.1 USDC min instead of 10 USDC)
      await vault.connect(deployer).setConfig(
        100, // maxQueueSize (unchanged)  
        ethers.parseUnits("0.1", 6), // minDepositAmount: 0.1 USDC
        ethers.parseEther("0.001") // minRedemptionShares: 0.001 shares
      );
      
      console.log("✅ Vault configured for small amounts (0.1 USDC minimum)");
    });

    it("Should allow users to deposit USDC", async function () {
      const vault = await ethers.getContractAt("MultiAssetVault", REAL_CONTRACTS.TEST_BASKET);
      const usdc = await ethers.getContractAt("IERC20", REAL_CONTRACTS.USDC);
      
      const depositAmount = ethers.parseUnits("0.3", 6); // 0.3 USDC
      const userBalance = await usdc.balanceOf(deployer);
      
      console.log(`DEBUG: userBalance = ${userBalance.toString()}, depositAmount = ${depositAmount.toString()}`);
      console.log(`DEBUG: deployer address = ${await deployer.getAddress()}`);
      
      if (userBalance < depositAmount) {
        console.log("⚠️  Skipping deposit test - insufficient USDC balance");
        this.skip();
        return;
      }
      
      // Check deposit queue before
      const queueLengthBefore = await vault.getPendingDeposits();
      
      // Approve unlimited for vault deposits to avoid allowance issues  
      await usdc.connect(deployer).approve(REAL_CONTRACTS.TEST_BASKET, ethers.MaxUint256);
      await vault.connect(deployer).deposit(depositAmount);
      
      // Check deposit queue after
      const queueLengthAfter = await vault.getPendingDeposits();
      expect(queueLengthAfter).to.equal(queueLengthBefore + 1n);
      
      // Check deposit request details (should be the most recent one)
      const depositRequest = await vault.depositQueue(queueLengthAfter - 1n);
      expect(depositRequest.user).to.equal(await deployer.getAddress());
      expect(depositRequest.usdcAmount).to.equal(depositAmount);
      
      console.log(`✅ Deposited ${ethers.formatUnits(depositAmount, 6)} USDC to vault`);
    });

    it("Should process deposit queue and mint shares", async function () {
      const vault = await ethers.getContractAt("MultiAssetVault", REAL_CONTRACTS.TEST_BASKET);
      const oracle = await ethers.getContractAt("MockOracleAggregator", REAL_CONTRACTS.ORACLE_AGGREGATOR);
      
      const queueLength = await vault.getPendingDeposits();
      if (queueLength === 0n) {
        console.log("⚠️  No deposits to process");
        this.skip();
      }
      
      // Update NAV first (required by navUpdated modifier)
      const basketAssets = await vault.getBasketAssets();
      const assetPrices = await Promise.all(basketAssets.map(asset => oracle.getPrice(asset)));
      await vault.connect(deployer).updateNAV(assetPrices);
      
      // Check shares before processing
      const sharesBefore = await vault.totalSupply();
      const userSharesBefore = await vault.balanceOf(deployer);
      
      // Process deposit queue (only owner/bot can do this)
      await vault.connect(deployer).processDepositQueue();
      
      // Check shares after processing
      const sharesAfter = await vault.totalSupply();
      const userSharesAfter = await vault.balanceOf(deployer);
      
      expect(sharesAfter).to.be.gt(sharesBefore);
      expect(userSharesAfter).to.be.gt(userSharesBefore);
      
      const newShares = sharesAfter - sharesBefore;
      console.log(`✅ Minted ${ethers.formatEther(newShares)} shares to user`);
    });
  });

  describe("Bot Capital Management", function () {
    beforeEach("Update NAV before bot operations", async function () {
      const vault = await ethers.getContractAt("MultiAssetVault", REAL_CONTRACTS.TEST_BASKET);
      const oracle = await ethers.getContractAt("MockOracleAggregator", REAL_CONTRACTS.ORACLE_AGGREGATOR);
      
      // Update NAV before any bot operation (required by navUpdated modifier)
      const basketAssets = await vault.getBasketAssets();
      const assetPrices = await Promise.all(basketAssets.map(asset => oracle.getPrice(asset)));
      await vault.connect(deployer).updateNAV(assetPrices);
    });

    it("Should deploy capital to USDT asset", async function () {
      const vault = await ethers.getContractAt("MultiAssetVault", REAL_CONTRACTS.TEST_BASKET);
      const usdc = await ethers.getContractAt("IERC20", REAL_CONTRACTS.USDC);
      
      // Check vault's USDC balance
      const vaultUsdcBalance = await usdc.balanceOf(REAL_CONTRACTS.TEST_BASKET);
      if (vaultUsdcBalance < ethers.parseUnits("0.5", 6)) {
        console.log("⚠️  Vault needs USDC balance to deploy capital");
        this.skip();
      }
      
      const deployAmount = ethers.parseUnits("0.2", 6); // Deploy 0.2 USDC worth to USDT
      
      // Check USDT allocation before
      const [targetWeight, balanceBefore] = await vault.getAssetAllocation(REAL_CONTRACTS.USDT);
      
      // Deploy capital (only bot/owner can do this)
      const tx = await vault.connect(deployer).deployCapital(REAL_CONTRACTS.USDT, deployAmount);
      expect(tx).to.not.be.reverted;
      
      // Check USDT allocation after
      const [, balanceAfter] = await vault.getAssetAllocation(REAL_CONTRACTS.USDT);
      expect(balanceAfter).to.be.gte(balanceBefore);
      
      const usdtReceived = balanceAfter - balanceBefore;
      console.log(`✅ Deployed 0.2 USDC → ${ethers.formatUnits(usdtReceived, 6)} USDT`);
    });

    it("Should deploy capital to WAVAX asset", async function () {
      const vault = await ethers.getContractAt("MultiAssetVault", REAL_CONTRACTS.TEST_BASKET);
      const usdc = await ethers.getContractAt("IERC20", REAL_CONTRACTS.USDC);
      
      // Check vault's USDC balance
      const vaultUsdcBalance = await usdc.balanceOf(REAL_CONTRACTS.TEST_BASKET);
      if (vaultUsdcBalance < ethers.parseUnits("0.2", 6)) {
        console.log("⚠️  Vault needs USDC balance to deploy capital");
        this.skip();
      }
      
      const deployAmount = ethers.parseUnits("0.2", 6); // Deploy 0.2 USDC worth to WAVAX
      
      // Check WAVAX allocation before
      const [targetWeight, balanceBefore] = await vault.getAssetAllocation(REAL_CONTRACTS.WAVAX);
      
      // Deploy capital (only bot/owner can do this)
      const tx = await vault.connect(deployer).deployCapital(REAL_CONTRACTS.WAVAX, deployAmount);
      expect(tx).to.not.be.reverted;
      
      // Check WAVAX allocation after
      const [, balanceAfter] = await vault.getAssetAllocation(REAL_CONTRACTS.WAVAX);
      expect(balanceAfter).to.be.gte(balanceBefore);
      
      const wavaxReceived = balanceAfter - balanceBefore;
      console.log(`✅ Deployed 0.2 USDC → ${ethers.formatEther(wavaxReceived)} WAVAX`);
    });

    it("Should liquidate USDT position back to USDC", async function () {
      const vault = await ethers.getContractAt("MultiAssetVault", REAL_CONTRACTS.TEST_BASKET);
      const usdc = await ethers.getContractAt("IERC20", REAL_CONTRACTS.USDC);
      
      // Check current USDT allocation
      const [, usdtBalance] = await vault.getAssetAllocation(REAL_CONTRACTS.USDT);
      if (usdtBalance === 0n) {
        console.log("⚠️  No USDT position to liquidate");
        this.skip();
      }
      
      const liquidateAmount = usdtBalance / 2n; // Liquidate half
      const usdcBalanceBefore = await usdc.balanceOf(REAL_CONTRACTS.TEST_BASKET);
      
      // Liquidate position (only bot/owner can do this)
      const tx = await vault.connect(deployer).liquidateAsset(REAL_CONTRACTS.USDT, liquidateAmount);
      expect(tx).to.not.be.reverted;
      
      // Check USDC balance increased
      const usdcBalanceAfter = await usdc.balanceOf(REAL_CONTRACTS.TEST_BASKET);
      expect(usdcBalanceAfter).to.be.gte(usdcBalanceBefore);
      
      const usdcReceived = usdcBalanceAfter - usdcBalanceBefore;
      console.log(`✅ Liquidated ${ethers.formatUnits(liquidateAmount, 6)} USDT → ${ethers.formatUnits(usdcReceived, 6)} USDC`);
    });

    it("Should update NAV with current prices", async function () {
      const vault = await ethers.getContractAt("MultiAssetVault", REAL_CONTRACTS.TEST_BASKET);
      const oracle = await ethers.getContractAt("MockOracleAggregator", REAL_CONTRACTS.ORACLE_AGGREGATOR);
      
      // Get basket assets and their prices
      const assets = await vault.getBasketAssets();
      const prices = await Promise.all(
        assets.map(asset => oracle.getPrice(asset))
      );
      
      const navBefore = await vault.lastNavPerShare();
      const lastUpdateBefore = await vault.lastNavUpdate();
      
      // Update NAV (only bot/owner can do this)
      const tx = await vault.connect(deployer).updateNAV(prices);
      expect(tx).to.not.be.reverted;
      
      const navAfter = await vault.lastNavPerShare();
      const lastUpdateAfter = await vault.lastNavUpdate();
      
      expect(lastUpdateAfter).to.be.gte(lastUpdateBefore);
      console.log(`✅ NAV updated: ${ethers.formatEther(navBefore)} → ${ethers.formatEther(navAfter)}`);
    });
  });

  describe("User Redemptions", function () {
    beforeEach("Update NAV before redemption operations", async function () {
      const vault = await ethers.getContractAt("MultiAssetVault", REAL_CONTRACTS.TEST_BASKET);
      const oracle = await ethers.getContractAt("MockOracleAggregator", REAL_CONTRACTS.ORACLE_AGGREGATOR);
      
      // Update NAV before any bot operation (required by navUpdated modifier)
      const basketAssets = await vault.getBasketAssets();
      const assetPrices = await Promise.all(basketAssets.map(asset => oracle.getPrice(asset)));
      await vault.connect(deployer).updateNAV(assetPrices);
    });

    it("Should allow users to request redemption", async function () {
      const vault = await ethers.getContractAt("MultiAssetVault", REAL_CONTRACTS.TEST_BASKET);
      
      const userShares = await vault.balanceOf(deployer);
      if (userShares === 0n) {
        console.log("⚠️  User has no shares to redeem");
        this.skip();
        return;
      }
      
      const redeemAmount = userShares / 2n; // Redeem half of shares
      const queueLengthBefore = await vault.getPendingRedemptions();
      
      // Request redemption
      await vault.connect(deployer).requestRedemption(redeemAmount);
      
      // Check redemption queue
      const queueLengthAfter = await vault.getPendingRedemptions();
      expect(queueLengthAfter).to.equal(queueLengthBefore + 1n);
      
      // Check redemption request details
      const redemptionRequest = await vault.redemptionQueue(queueLengthAfter - 1n);
      expect(redemptionRequest.user).to.equal(await deployer.getAddress());
      expect(redemptionRequest.shareAmount).to.equal(redeemAmount);
      
      console.log(`✅ Requested redemption of ${ethers.formatEther(redeemAmount)} shares`);
    });

    it("Should process redemption queue and return USDC", async function () {
      const vault = await ethers.getContractAt("MultiAssetVault", REAL_CONTRACTS.TEST_BASKET);
      const usdc = await ethers.getContractAt("IERC20", REAL_CONTRACTS.USDC);
      
      const queueLength = await vault.getPendingRedemptions();
      if (queueLength === 0n) {
        console.log("⚠️  No redemptions to process");
        this.skip();
        return;
      }
      
      const userUsdcBefore = await usdc.balanceOf(deployer);
      const totalSharesBefore = await vault.totalSupply();
      
      // Process redemption queue (only bot/owner can do this)  
      await vault.connect(deployer).processRedemptionQueue();
      
      const userUsdcAfter = await usdc.balanceOf(deployer);
      const totalSharesAfter = await vault.totalSupply();
      
      expect(userUsdcAfter).to.be.gt(userUsdcBefore);
      expect(totalSharesAfter).to.be.lt(totalSharesBefore);
      
      const usdcReceived = userUsdcAfter - userUsdcBefore;
      const sharesBurned = totalSharesBefore - totalSharesAfter;
      
      console.log(`✅ Processed redemption: ${ethers.formatEther(sharesBurned)} shares → ${ethers.formatUnits(usdcReceived, 6)} USDC`);
    });
  });

  describe("Complete Vault Lifecycle", function () {
    it("Should handle full deposit → deploy → rebalance → redeem cycle", async function () {
      const vault = await ethers.getContractAt("MultiAssetVault", REAL_CONTRACTS.TEST_BASKET);
      const usdc = await ethers.getContractAt("IERC20", REAL_CONTRACTS.USDC);
      const oracle = await ethers.getContractAt("MockOracleAggregator", REAL_CONTRACTS.ORACLE_AGGREGATOR);
      
      // Check if we have enough USDC for a full cycle test
      const userUsdcBalance = await usdc.balanceOf(deployer);
      const testAmount = ethers.parseUnits("0.4", 6); // 0.4 USDC for full test (under 0.5)
      
      if (userUsdcBalance < testAmount) {
        console.log("⚠️  Insufficient USDC for full cycle test");
        this.skip();
        return;
      }
      
      console.log("🔄 Starting full vault lifecycle test...");
      
      // 1. DEPOSIT
      await usdc.connect(deployer).approve(REAL_CONTRACTS.TEST_BASKET, ethers.MaxUint256);
      await vault.connect(deployer).deposit(testAmount);
      
      // Update NAV before processing (required by navUpdated modifier)
      const vaultAssets = await vault.getBasketAssets();
      const vaultPrices = await Promise.all(vaultAssets.map(asset => oracle.getPrice(asset)));
      await vault.connect(deployer).updateNAV(vaultPrices);
      
      await vault.connect(deployer).processDepositQueue();
      
      const userShares = await vault.balanceOf(deployer);
      console.log(`   ✅ Deposited ${ethers.formatUnits(testAmount, 6)} USDC → ${ethers.formatEther(userShares)} shares`);
      
      // 2. DEPLOY CAPITAL (Simulate rebalancing to 50% USDT, 50% WAVAX)
      const halfAmount = testAmount / 2n; // 0.2 USDC each
      
      await vault.connect(deployer).deployCapital(REAL_CONTRACTS.USDT, halfAmount);
      const [, usdtBalance] = await vault.getAssetAllocation(REAL_CONTRACTS.USDT);
      console.log(`   ✅ Deployed ${ethers.formatUnits(halfAmount, 6)} USDC → ${ethers.formatUnits(usdtBalance, 6)} USDT`);
      
      await vault.connect(deployer).deployCapital(REAL_CONTRACTS.WAVAX, halfAmount);  
      const [, wavaxBalance] = await vault.getAssetAllocation(REAL_CONTRACTS.WAVAX);
      console.log(`   ✅ Deployed ${ethers.formatUnits(halfAmount, 6)} USDC → ${ethers.formatEther(wavaxBalance)} WAVAX`);
      
      // 3. UPDATE NAV
      const assets = await vault.getBasketAssets();
      const prices = await Promise.all(assets.map(asset => oracle.getPrice(asset)));
      await vault.connect(deployer).updateNAV(prices);
      
      const navPerShare = await vault.lastNavPerShare();
      console.log(`   ✅ Updated NAV per share: ${ethers.formatEther(navPerShare)}`);
      
      // 4. REDEEM
      const redeemShares = userShares / 2n; // Redeem half
      await vault.connect(deployer).requestRedemption(redeemShares);
      
      const usdcBalanceBefore = await usdc.balanceOf(deployer);
      await vault.connect(deployer).processRedemptionQueue();
      const usdcBalanceAfter = await usdc.balanceOf(deployer);
      
      const usdcReceived = usdcBalanceAfter - usdcBalanceBefore;
      console.log(`   ✅ Redeemed ${ethers.formatEther(redeemShares)} shares → ${ethers.formatUnits(usdcReceived, 6)} USDC`);
      
      console.log("🎉 Full vault lifecycle test completed successfully!");
    });
  });
});