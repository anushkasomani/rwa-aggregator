import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { 
  deployTestContracts, 
  getTestUsers, 
  fundUsers,
  createBasket,
  CONSTANTS
} from "./utils/TestHelpers";
import { MultiAssetVault } from "../typechain-types";

describe("MultiAssetVault", function () {
  async function deployVaultFixture() {
    const contracts = await deployTestContracts();
    const users = await getTestUsers();
    await fundUsers(contracts, users);
    
    // Create a basket to get a vault instance
    const basketAddress = await createBasket(contracts, users.alice);
    const vault = await ethers.getContractAt("MultiAssetVault", basketAddress) as MultiAssetVault;
    
    return { contracts, users, vault };
  }

  describe("Initialization", function () {
    it("Should initialize with correct parameters", async function () {
      const { vault, contracts } = await loadFixture(deployVaultFixture);
      
      expect(await vault.baseToken()).to.equal(await contracts.mockUSDC.getAddress());
      expect(await vault.orderRouter()).to.equal(await contracts.orderRouter.getAddress());
      expect(await vault.oracleAggregator()).to.equal(await contracts.oracleAggregator.getAddress());
      expect(await vault.lastNavPerShare()).to.equal(CONSTANTS.NAV_SCALE);
    });

    it("Should have correct basket assets", async function () {
      const { vault, contracts } = await loadFixture(deployVaultFixture);
      
      const basketAssets = await vault.getBasketAssets();
      expect(basketAssets.length).to.equal(2);
      
      // Assets might be sorted by factory, so check if all expected assets are present
      const expectedAssets = [
        await contracts.mockUSDT.getAddress(),
        await contracts.mockWAVAX.getAddress()
      ];
      
      for (const expectedAsset of expectedAssets) {
        expect(basketAssets).to.include(expectedAsset);
      }
    });
  });

  describe("User Deposits", function () {
    it("Should queue deposits successfully", async function () {
      const { vault, contracts, users } = await loadFixture(deployVaultFixture);
      
      const depositAmount = CONSTANTS.MIN_DEPOSIT;
      await contracts.mockUSDC.connect(users.alice).approve(await vault.getAddress(), depositAmount);
      
      await expect(vault.connect(users.alice).deposit(depositAmount))
        .to.emit(vault, "DepositQueued")
        .withArgs(users.alice.address, depositAmount, 0);
      
      expect(await vault.getPendingDeposits()).to.equal(1);
      expect(await vault.pendingUSDC()).to.equal(depositAmount);
    });

    it("Should reject deposits below minimum", async function () {
      const { vault, contracts, users } = await loadFixture(deployVaultFixture);
      
      const smallAmount = ethers.parseUnits("5", 6); // 5 USDC, below 10 USDC minimum
      await contracts.mockUSDC.connect(users.alice).approve(await vault.getAddress(), smallAmount);
      
      await expect(vault.connect(users.alice).deposit(smallAmount))
        .to.be.revertedWithCustomError(vault, "InvalidAmount");
    });
  });

  describe("User Redemptions", function () {
    it("Should queue redemptions successfully", async function () {
      const { vault, contracts, users } = await loadFixture(deployVaultFixture);
      
      // First deposit and process to get shares
      const depositAmount = CONSTANTS.MIN_DEPOSIT;
      await contracts.mockUSDC.connect(users.alice).approve(await vault.getAddress(), depositAmount);
      await vault.connect(users.alice).deposit(depositAmount);
      await vault.connect(users.owner).processDepositQueue();
      
      const shareBalance = await vault.balanceOf(users.alice.address);
      expect(shareBalance).to.be.gt(0);
      
      // Now test redemption
      await expect(vault.connect(users.alice).requestRedemption(shareBalance))
        .to.emit(vault, "RedemptionQueued")
        .withArgs(users.alice.address, shareBalance, 0);
      
      expect(await vault.getPendingRedemptions()).to.equal(1);
    });

    it("Should reject redemption of more shares than owned", async function () {
      const { vault, users } = await loadFixture(deployVaultFixture);
      
      const largeAmount = ethers.parseUnits("1000", 18);
      await expect(vault.connect(users.alice).requestRedemption(largeAmount))
        .to.be.revertedWithCustomError(vault, "InvalidAmount");
    });
  });

  describe("Bot Operations - Queue Processing", function () {
    it("Should process deposit queue and mint shares", async function () {
      const { vault, contracts, users } = await loadFixture(deployVaultFixture);
      
      const depositAmount = CONSTANTS.MIN_DEPOSIT;
      await contracts.mockUSDC.connect(users.alice).approve(await vault.getAddress(), depositAmount);
      await vault.connect(users.alice).deposit(depositAmount);
      
      await expect(vault.connect(users.owner).processDepositQueue())
        .to.emit(vault, "DepositsProcessed");
      
      const shareBalance = await vault.balanceOf(users.alice.address);
      expect(shareBalance).to.be.gt(0);
      expect(await vault.getPendingDeposits()).to.equal(0);
    });

    it("Should process redemption queue and return USDC", async function () {
      const { vault, contracts, users } = await loadFixture(deployVaultFixture);
      
      // Setup: deposit and process to get shares
      const depositAmount = CONSTANTS.MIN_DEPOSIT;
      await contracts.mockUSDC.connect(users.alice).approve(await vault.getAddress(), depositAmount);
      await vault.connect(users.alice).deposit(depositAmount);
      await vault.connect(users.owner).processDepositQueue();
      
      const shareBalance = await vault.balanceOf(users.alice.address);
      await vault.connect(users.alice).requestRedemption(shareBalance);
      
      // Update NAV before processing redemptions (required by navUpdated modifier)
      const prices = [
        ethers.parseUnits("1", 6), // USDT price in USDC
        ethers.parseUnits("35", 6)   // WAVAX price in USDC
      ];
      await vault.connect(users.owner).updateNAV(prices);
      
      const usdcBefore = await contracts.mockUSDC.balanceOf(users.alice.address);
      
      await expect(vault.connect(users.owner).processRedemptionQueue())
        .to.emit(vault, "RedemptionsProcessed");
      
      const usdcAfter = await contracts.mockUSDC.balanceOf(users.alice.address);
      expect(usdcAfter).to.be.gt(usdcBefore);
      expect(await vault.getPendingRedemptions()).to.equal(0);
    });
  });

  describe("Bot Operations - Capital Management", function () {
    it("Should deploy capital to assets", async function () {
      const { vault, contracts, users } = await loadFixture(deployVaultFixture);
      
      // Setup: deposit and process to have pending USDC
      const depositAmount = CONSTANTS.MIN_DEPOSIT;
      await contracts.mockUSDC.connect(users.alice).approve(await vault.getAddress(), depositAmount);
      await vault.connect(users.alice).deposit(depositAmount);
      await vault.connect(users.owner).processDepositQueue();
      
      const deployAmount = ethers.parseUnits("5", 6); // 5 USDC
      await expect(
        vault.connect(users.owner).deployCapital(
          await contracts.mockUSDT.getAddress(), 
          deployAmount
        )
      ).to.emit(vault, "CapitalDeployed");
      
      // Check asset allocation was updated
      const [weight, balance, isActive] = await vault.getAssetAllocation(await contracts.mockUSDT.getAddress());
      expect(balance).to.be.gt(0);
      expect(isActive).to.be.true;
    });

    it("Should liquidate asset positions", async function () {
      const { vault, contracts, users } = await loadFixture(deployVaultFixture);
      
      // Setup: deposit, process, and deploy capital
      const depositAmount = CONSTANTS.MIN_DEPOSIT;
      await contracts.mockUSDC.connect(users.alice).approve(await vault.getAddress(), depositAmount);
      await vault.connect(users.alice).deposit(depositAmount);
      await vault.connect(users.owner).processDepositQueue();
      
      const deployAmount = ethers.parseUnits("5", 6);
      await vault.connect(users.owner).deployCapital(await contracts.mockUSDT.getAddress(), deployAmount);
      
      // Now liquidate
      await expect(
        vault.connect(users.owner).liquidateAsset(await contracts.mockUSDT.getAddress(), 0) // 0 = liquidate all
      ).to.emit(vault, "AssetLiquidated");
    });

    it("Should reject deployment of asset not in basket", async function () {
      const { vault, contracts, users } = await loadFixture(deployVaultFixture);
      
      // Try to deploy to a token not in the basket
      const MockERC20Factory = await ethers.getContractFactory("MockERC20");
      const randomToken = await MockERC20Factory.deploy("Random", "RND", 18);
      
      await expect(
        vault.connect(users.owner).deployCapital(await randomToken.getAddress(), 1000)
      ).to.be.revertedWithCustomError(vault, "AssetNotInBasket");
    });
  });

  describe("NAV Management", function () {
    it("Should update NAV successfully", async function () {
      const { vault, contracts, users } = await loadFixture(deployVaultFixture);
      
      // Setup with some deposits
      const depositAmount = CONSTANTS.MIN_DEPOSIT;
      await contracts.mockUSDC.connect(users.alice).approve(await vault.getAddress(), depositAmount);
      await vault.connect(users.alice).deposit(depositAmount);
      await vault.connect(users.owner).processDepositQueue();
      
      // Update NAV with asset prices (in USDC per token, 1e6 scale)
      const prices = [
        ethers.parseUnits("1", 6), // USDT price
        ethers.parseUnits("35", 6)   // WAVAX price
      ];
      
      await expect(vault.connect(users.owner).updateNAV(prices))
        .to.emit(vault, "NAVUpdated");
      
      expect(await vault.lastNavUpdate()).to.be.gt(0);
    });

    it("Should reject NAV update with wrong number of prices", async function () {
      const { vault, users } = await loadFixture(deployVaultFixture);
      
      const wrongPrices = [ethers.parseUnits("1", 6)]; // Only 1 price, need 2
      
      await expect(vault.connect(users.owner).updateNAV(wrongPrices))
        .to.be.revertedWithCustomError(vault, "InvalidAmount");
    });
  });

  describe("Access Control", function () {
    it("Should only allow bot/owner to call restricted functions", async function () {
      const { vault, users } = await loadFixture(deployVaultFixture);
      
      await expect(vault.connect(users.alice).processDepositQueue())
        .to.be.revertedWithCustomError(vault, "Unauthorized");
      
      await expect(vault.connect(users.alice).processRedemptionQueue())
        .to.be.revertedWithCustomError(vault, "Unauthorized");
      
      await expect(
        vault.connect(users.alice).deployCapital(await vault.getAddress(), 100)
      ).to.be.revertedWithCustomError(vault, "Unauthorized");
      
      await expect(
        vault.connect(users.alice).updateNAV([])
      ).to.be.revertedWithCustomError(vault, "Unauthorized");
    });

    it("Should allow owner to pause and unpause", async function () {
      const { vault, contracts, users } = await loadFixture(deployVaultFixture);
      
      await vault.connect(users.owner).pause();
      
      // Should not be able to deposit when paused
      await contracts.mockUSDC.connect(users.alice).approve(await vault.getAddress(), CONSTANTS.MIN_DEPOSIT);
      await expect(vault.connect(users.alice).deposit(CONSTANTS.MIN_DEPOSIT))
        .to.be.revertedWithCustomError(vault, "EnforcedPause");
      
      await vault.connect(users.owner).unpause();
      
      // Should work after unpause
      await expect(vault.connect(users.alice).deposit(CONSTANTS.MIN_DEPOSIT))
        .to.emit(vault, "DepositQueued");
    });
  });
});