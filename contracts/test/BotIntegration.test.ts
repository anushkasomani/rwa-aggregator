import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { 
  deployTestContracts, 
  getTestUsers, 
  fundUsers,
  createBasket,
  CONSTANTS
} from "./utils/TestHelpers";

describe("Bot Integration Issues", function () {
  async function deployVaultFixture() {
    const contracts = await deployTestContracts();
    const users = await getTestUsers();
    await fundUsers(contracts, users);
    
    const basketAddress = await createBasket(contracts, users.alice);
    const vault = await ethers.getContractAt("MultiAssetVault", basketAddress);
    
    return { contracts, users, vault };
  }

  describe("NAV Calculation Scale Issues", function () {
    it("Should reveal NAV calculation scale mismatch", async function () {
      const { vault, contracts, users } = await loadFixture(deployVaultFixture);
      
      // Deposit and deploy capital
      const depositAmount = ethers.parseUnits("100", 6); // 100 USDC
      await contracts.mockUSDC.connect(users.alice).approve(await vault.getAddress(), depositAmount);
      await vault.connect(users.alice).deposit(depositAmount);
      await vault.connect(users.owner).processDepositQueue();
      
      // Deploy to WAVAX (18 decimals)
      const deployAmount = ethers.parseUnits("35", 6); // 35 USDC worth
      await vault.connect(users.owner).deployCapital(
        await contracts.mockWAVAX.getAddress(), 
        deployAmount
      );
      
      // Check deployed balance and exchange rate
      const [, wavaxBalance] = await vault.getAssetAllocation(await contracts.mockWAVAX.getAddress());
      const exchangeRate = await contracts.orderRouter.quote(
        await contracts.mockUSDC.getAddress(),
        await contracts.mockWAVAX.getAddress(),
        ethers.parseUnits("35", 6)
      );
      console.log(`WAVAX Balance: ${wavaxBalance}`); 
      console.log(`Exchange rate for 35 USDC: ${exchangeRate} WAVAX`);
      console.log(`Expected ~1 WAVAX = ${ethers.parseUnits("1", 18)}`);
      
      // Update NAV with 1e6 scale prices (as per comment)
      const prices = [
        ethers.parseUnits("1", 6),   // USDT: $1
        ethers.parseUnits("35", 6)   // WAVAX: $35
      ];
      
      const navBefore = await vault.lastNavPerShare();
      await vault.connect(users.owner).updateNAV(prices);
      const navAfter = await vault.lastNavPerShare();
      
      console.log(`NAV before: ${navBefore}`);
      console.log(`NAV after: ${navAfter}`);
      
      // This will show the scale mismatch issue
      // Expected: NAV should remain ~1e18 (close to original)
      // Actual: NAV will be much higher due to division by 1e18 instead of 1e18
    });
  });

  describe("Stale NAV Blocking Operations", function () {
    it("Should block operations after 1 hour without NAV update", async function () {
      const { vault, contracts, users } = await loadFixture(deployVaultFixture);
      
      // Setup deposit
      const depositAmount = CONSTANTS.MIN_DEPOSIT;
      await contracts.mockUSDC.connect(users.alice).approve(await vault.getAddress(), depositAmount);
      await vault.connect(users.alice).deposit(depositAmount);
      
      // Fast forward time by 2 hours
      await time.increase(2 * 60 * 60); // 2 hours
      
      // Try to process deposits - should fail
      await expect(vault.connect(users.owner).processDepositQueue())
        .to.be.revertedWithCustomError(vault, "StaleNAV");
    });
  });

  describe("OrderRouter Integration Issues", function () {
    it("Should test actual swap flow", async function () {
      const { vault, contracts, users } = await loadFixture(deployVaultFixture);
      
      // Setup
      const depositAmount = CONSTANTS.MIN_DEPOSIT;
      await contracts.mockUSDC.connect(users.alice).approve(await vault.getAddress(), depositAmount);
      await vault.connect(users.alice).deposit(depositAmount);
      await vault.connect(users.owner).processDepositQueue();
      
      // Check vault USDC balance before swap
      const vaultUsdcBefore = await contracts.mockUSDC.balanceOf(await vault.getAddress());
      console.log(`Vault USDC before: ${vaultUsdcBefore}`);
      
      // Try to deploy capital
      const deployAmount = ethers.parseUnits("5", 6);
      await vault.connect(users.owner).deployCapital(
        await contracts.mockUSDT.getAddress(),
        deployAmount
      );
      
      // Check balances after
      const vaultUsdcAfter = await contracts.mockUSDC.balanceOf(await vault.getAddress());
      const vaultUsdtAfter = await contracts.mockUSDT.balanceOf(await vault.getAddress());
      
      console.log(`Vault USDC after: ${vaultUsdcAfter}`);
      console.log(`Vault USDT after: ${vaultUsdtAfter}`);
      
      // Verify the swap actually happened
      expect(vaultUsdcAfter).to.be.lt(vaultUsdcBefore);
      expect(vaultUsdtAfter).to.be.gt(0);
    });
  });

  describe("Multi-Asset Balance Tracking", function () {
    it("Should test balance tracking with multiple assets", async function () {
      const { vault, contracts, users } = await loadFixture(deployVaultFixture);
      
      // Large deposit
      const depositAmount = ethers.parseUnits("100", 6);
      await contracts.mockUSDC.connect(users.alice).approve(await vault.getAddress(), depositAmount);
      await vault.connect(users.alice).deposit(depositAmount);
      await vault.connect(users.owner).processDepositQueue();
      
      // Deploy to both assets
      await vault.connect(users.owner).deployCapital(
        await contracts.mockUSDT.getAddress(),
        ethers.parseUnits("30", 6)
      );
      
      // Check USDT balance
      const [, usdtBalance1] = await vault.getAssetAllocation(await contracts.mockUSDT.getAddress());
      console.log(`USDT Balance after first deploy: ${usdtBalance1}`);
      
      await vault.connect(users.owner).deployCapital(
        await contracts.mockWAVAX.getAddress(),
        ethers.parseUnits("35", 6)
      );
      
      // Check if USDT balance changed (it shouldn't)
      const [, usdtBalance2] = await vault.getAssetAllocation(await contracts.mockUSDT.getAddress());
      console.log(`USDT Balance after second deploy: ${usdtBalance2}`);
      
      expect(usdtBalance1).to.equal(usdtBalance2); // Should remain unchanged
    });
  });
});