import { expect } from "chai";
import { ethers } from "hardhat";
import { BasketVaultERC7540, MultiVaultTracker, ERC20Mock } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { parseEther } from "ethers";

describe("BasketVaultERC7540 with MultiVaultTracker", function () {
  let vault: BasketVaultERC7540;
  let vaultTracker: MultiVaultTracker;
  let mockToken: ERC20Mock;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let controller: SignerWithAddress;
  let operator: SignerWithAddress;

  const INITIAL_SUPPLY = parseEther("1000000");
  const DEPOSIT_AMOUNT = parseEther("1000");
  const REDEEM_AMOUNT = parseEther("500");

  beforeEach(async function () {
    // Get signers
    [owner, user1, user2, controller, operator] = await ethers.getSigners();

    // Deploy mock token
    const MockToken = await ethers.getContractFactory("ERC20Mock");
    mockToken = await MockToken.deploy("Mock Token", "MTK", INITIAL_SUPPLY);
    await mockToken.waitForDeployment();

    // Deploy MultiVaultTracker
    const MultiVaultTrackerFactory = await ethers.getContractFactory("MultiVaultTracker");
    vaultTracker = await MultiVaultTrackerFactory.deploy();
    await vaultTracker.waitForDeployment();

    // Deploy BasketVaultERC7540
    const BasketVaultFactory = await ethers.getContractFactory("BasketVaultERC7540");
    vault = await BasketVaultFactory.deploy(
      await mockToken.getAddress(), 
      "Basket Vault Token", 
      "BVT"
    );
    await vault.waitForDeployment();

    // Set vault tracker
    await vault.setVaultTracker(await vaultTracker.getAddress());

    // Mint tokens to users
    await mockToken.mint(user1.address, INITIAL_SUPPLY);
    await mockToken.mint(user2.address, INITIAL_SUPPLY);

    // Approve spending
    await mockToken.connect(user1).approve(await vault.getAddress(), ethers.MaxUint256);
    await mockToken.connect(user2).approve(await vault.getAddress(), ethers.MaxUint256);

    // Set operator for controller
    await vault.connect(controller).setOperator(operator.address, true);
  });

  describe("Basic ERC4626 Functionality", function () {
    it("should initialize correctly", async function () {
      expect(await vault.asset()).to.equal(await mockToken.getAddress());
      expect(await vault.name()).to.equal("Basket Vault Token");
      expect(await vault.symbol()).to.equal("BVT");
      expect(await vault.vaultTracker()).to.equal(await vaultTracker.getAddress());
    });

    it("should allow deposits and track them", async function () {
      // User1 deposits
  await (vault.connect(user1) as any)["deposit(uint256,address)"](DEPOSIT_AMOUNT, user1.address);

      // Check vault state
      expect(await vault.balanceOf(user1.address)).to.equal(DEPOSIT_AMOUNT);
      expect(await vault.totalSupply()).to.equal(DEPOSIT_AMOUNT);
      expect(await mockToken.balanceOf(await vault.getAddress())).to.equal(DEPOSIT_AMOUNT);

      // Check tracking
      const userVaults = await vaultTracker.getUserVaults(user1.address);
      expect(userVaults.length).to.equal(1);
      expect(userVaults[0]).to.equal(await vault.getAddress());

      const position = await vaultTracker.getUserVaultPosition(user1.address, await vault.getAddress());
      expect(position.shares).to.equal(DEPOSIT_AMOUNT);
    });

    it("should allow withdrawals and track them correctly", async function () {
      // User1 deposits first
  await (vault.connect(user1) as any)["deposit(uint256,address)"](DEPOSIT_AMOUNT, user1.address);
      
      // User1 withdraws half
      await vault.connect(user1).withdraw(DEPOSIT_AMOUNT / 2n, user1.address, user1.address);

      // Check vault state
      expect(await vault.balanceOf(user1.address)).to.equal(DEPOSIT_AMOUNT / 2n);
      expect(await vault.totalSupply()).to.equal(DEPOSIT_AMOUNT / 2n);
      expect(await mockToken.balanceOf(await vault.getAddress())).to.equal(DEPOSIT_AMOUNT / 2n);

      // Check tracking
      const position = await vaultTracker.getUserVaultPosition(user1.address, await vault.getAddress());
      expect(position.shares).to.equal(DEPOSIT_AMOUNT / 2n);
    });
  });

  describe("Asynchronous Operations", function () {
    it("should handle deposit requests", async function () {
      // User1 requests deposit
      await vault.connect(user1).requestDeposit(DEPOSIT_AMOUNT, controller.address, user1.address);

      // Check vault state
      expect(await mockToken.balanceOf(await vault.getAddress())).to.equal(DEPOSIT_AMOUNT);
      expect(await vault.balanceOf(user1.address)).to.equal(0);

      // Get request ID
      const requestId = 0; // First request
      const request = await vault.getDepositRequest(requestId);
      expect(request.owner).to.equal(user1.address);
      expect(request.assets).to.equal(DEPOSIT_AMOUNT);
      expect(request.state).to.equal(0); // Pending

      // Check controller requests
      const controllerRequests = await vault.getControllerDepositRequests(controller.address);
      expect(controllerRequests.length).to.equal(1);
      expect(controllerRequests[0]).to.equal(0); // First request
    });

    it("should process deposit requests", async function () {
      // User1 requests deposit
      await vault.connect(user1).requestDeposit(DEPOSIT_AMOUNT, controller.address, user1.address);

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [3600]); // 1 hour
      await ethers.provider.send("evm_mine", []);

      // Process request
      await vault.connect(owner).processDepositRequest(0);

      // Check request state
      const request = await vault.getDepositRequest(0);
      expect(request.state).to.equal(1); // Claimable
      expect(request.shares).to.equal(DEPOSIT_AMOUNT); // 1:1 ratio for simplicity
    });

    it("should claim processed deposit requests", async function () {
      // User1 requests deposit
      await vault.connect(user1).requestDeposit(DEPOSIT_AMOUNT, controller.address, user1.address);

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [3600]); // 1 hour
      await ethers.provider.send("evm_mine", []);

      // Process request
      await vault.connect(owner).processDepositRequest(0);

      // Claim deposit
  // Controller claims using 3-arg controller deposit
  await (vault.connect(controller) as any)["deposit(uint256,address,address)"](DEPOSIT_AMOUNT, user1.address, controller.address);

      // Check vault state
      expect(await vault.balanceOf(user1.address)).to.equal(DEPOSIT_AMOUNT);
      
      // Check request state
      const request = await vault.getDepositRequest(0);
      expect(request.state).to.equal(2); // Claimed

      // Check tracking
      const position = await vaultTracker.getUserVaultPosition(user1.address, await vault.getAddress());
      expect(position.shares).to.equal(DEPOSIT_AMOUNT);
    });

    it("should handle redeem requests", async function () {
      // User1 deposits first
  await (vault.connect(user1) as any)["deposit(uint256,address)"](DEPOSIT_AMOUNT, user1.address);
      
      // User1 requests redeem
      await vault.connect(user1).requestRedeem(REDEEM_AMOUNT, controller.address, user1.address);

      // Check vault state
      expect(await vault.balanceOf(user1.address)).to.equal(DEPOSIT_AMOUNT - REDEEM_AMOUNT);
      
      // Get request ID
      const requestId = 0; // First request
      const request = await vault.getRedeemRequest(requestId);
      expect(request.owner).to.equal(user1.address);
      expect(request.shares).to.equal(REDEEM_AMOUNT);
      expect(request.state).to.equal(0); // Pending
    });

    it("should process redeem requests", async function () {
      // User1 deposits first
  await (vault.connect(user1) as any)["deposit(uint256,address)"](DEPOSIT_AMOUNT, user1.address);
      
      // User1 requests redeem
      await vault.connect(user1).requestRedeem(REDEEM_AMOUNT, controller.address, user1.address);

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [3600]); // 1 hour
      await ethers.provider.send("evm_mine", []);

      // Process request
      await vault.connect(owner).processRedeemRequest(0);

      // Check request state
      const request = await vault.getRedeemRequest(0);
      expect(request.state).to.equal(1); // Claimable
      expect(request.assets).to.equal(REDEEM_AMOUNT); // 1:1 ratio for simplicity
    });

    it("should claim processed redeem requests", async function () {
      // User1 deposits first
  await (vault.connect(user1) as any)["deposit(uint256,address)"](DEPOSIT_AMOUNT, user1.address);

  const initialTokenBalance = await mockToken.balanceOf(user1.address);
      
      // User1 requests redeem
      await vault.connect(user1).requestRedeem(REDEEM_AMOUNT, controller.address, user1.address);

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [3600]); // 1 hour
      await ethers.provider.send("evm_mine", []);

      // Process request
      await vault.connect(owner).processRedeemRequest(0);

      // Claim redeem
  await vault.connect(controller).redeemWithController(REDEEM_AMOUNT, user1.address, controller.address);

      // Check token balance
  // ethers v6 returns bigint; use bigint arithmetic
  expect(await mockToken.balanceOf(user1.address)).to.equal(initialTokenBalance + REDEEM_AMOUNT);
      
      // Check request state
      const request = await vault.getRedeemRequest(0);
      expect(request.state).to.equal(2); // Claimed

      // Check tracking
      const position = await vaultTracker.getUserVaultPosition(user1.address, await vault.getAddress());
      expect(position.shares).to.equal(DEPOSIT_AMOUNT - REDEEM_AMOUNT);
    });
  });

  describe("Multiple Vault Tracking", function () {
    let vault2: BasketVaultERC7540;

    beforeEach(async function () {
      // Deploy a second vault
      const BasketVaultFactory = await ethers.getContractFactory("BasketVaultERC7540");
      vault2 = await BasketVaultFactory.deploy(
        await mockToken.getAddress(), 
        "Basket Vault Token 2", 
        "BVT2"
      );
      await vault2.waitForDeployment();

      // Set vault tracker for second vault
      await vault2.setVaultTracker(await vaultTracker.getAddress());

      // Approve spending for second vault
      await mockToken.connect(user1).approve(await vault2.getAddress(), ethers.MaxUint256);
    });

    it("should track deposits across multiple vaults", async function () {
      // User1 deposits in first vault
  await (vault.connect(user1) as any)["deposit(uint256,address)"](DEPOSIT_AMOUNT, user1.address);
      
      // User1 deposits in second vault
  await (vault2.connect(user1) as any)["deposit(uint256,address)"](DEPOSIT_AMOUNT / 2n, user1.address);

      // Check tracking
      const userVaults = await vaultTracker.getUserVaults(user1.address);
      expect(userVaults.length).to.equal(2);
      
      // Check positions
      const position1 = await vaultTracker.getUserVaultPosition(user1.address, await vault.getAddress());
      expect(position1.shares).to.equal(DEPOSIT_AMOUNT);
      
      const position2 = await vaultTracker.getUserVaultPosition(user1.address, await vault2.getAddress());
      expect(position2.shares).to.equal(DEPOSIT_AMOUNT / 2n);

      // Get all positions
      const allPositions = await vaultTracker.getAllUserPositions(user1.address);
      expect(allPositions.length).to.equal(2);
    });

    it("should track withdrawals across multiple vaults", async function () {
      // User1 deposits in both vaults
  await (vault.connect(user1) as any)["deposit(uint256,address)"](DEPOSIT_AMOUNT, user1.address);
  await (vault2.connect(user1) as any)["deposit(uint256,address)"](DEPOSIT_AMOUNT, user1.address);
      
      // User1 withdraws from first vault
      await vault.connect(user1).withdraw(DEPOSIT_AMOUNT / 2n, user1.address, user1.address);
      
      // User1 withdraws from second vault
      await vault2.connect(user1).withdraw(DEPOSIT_AMOUNT / 4n, user1.address, user1.address);

      // Check positions
      const position1 = await vaultTracker.getUserVaultPosition(user1.address, await vault.getAddress());
      expect(position1.shares).to.equal(DEPOSIT_AMOUNT / 2n);
      
      const position2 = await vaultTracker.getUserVaultPosition(user1.address, await vault2.getAddress());
      expect(position2.shares).to.equal(DEPOSIT_AMOUNT - DEPOSIT_AMOUNT / 4n);
    });
  });

  describe("Operator Management", function () {
    it("should allow operators to act on behalf of controllers", async function () {
      // User1 requests deposit
      await vault.connect(user1).requestDeposit(DEPOSIT_AMOUNT, controller.address, user1.address);

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [3600]); // 1 hour
      await ethers.provider.send("evm_mine", []);

      // Process request
      await vault.connect(owner).processDepositRequest(0);

      // Operator claims deposit on behalf of controller
  await (vault.connect(operator) as any)["deposit(uint256,address,address)"](DEPOSIT_AMOUNT, user1.address, controller.address);

      // Check vault state
      expect(await vault.balanceOf(user1.address)).to.equal(DEPOSIT_AMOUNT);
    });

    it("should reject non-operators from acting on behalf of controllers", async function () {
      // User1 requests deposit
      await vault.connect(user1).requestDeposit(DEPOSIT_AMOUNT, controller.address, user1.address);

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [3600]); // 1 hour
      await ethers.provider.send("evm_mine", []);

      // Process request
      await vault.connect(owner).processDepositRequest(0);

      // User2 tries to claim deposit on behalf of controller (should fail)
      await expect(
  (vault.connect(user2) as any)["deposit(uint256,address,address)"](DEPOSIT_AMOUNT, user1.address, controller.address)
      ).to.be.revertedWith("Vault: not controller or operator");
    });
  });

  describe("Emergency Controls", function () {
    it("should allow pausing and unpausing operations", async function () {
      // Pause operations
      await vault.connect(owner).emergencyPause();

      // Try to deposit (should fail)
      await expect(
  (vault.connect(user1) as any)["deposit(uint256,address)"](DEPOSIT_AMOUNT, user1.address)
      ).to.be.revertedWith("Vault: emergency paused");

      // Unpause operations
      await vault.connect(owner).emergencyUnpause();

      // Try to deposit again (should succeed)
  await (vault.connect(user1) as any)["deposit(uint256,address)"](DEPOSIT_AMOUNT, user1.address);
      expect(await vault.balanceOf(user1.address)).to.equal(DEPOSIT_AMOUNT);
    });
  });

  describe("Batch Processing", function () {
    it("should process multiple requests in a batch", async function () {
      // User1 requests deposit
      await vault.connect(user1).requestDeposit(DEPOSIT_AMOUNT, controller.address, user1.address);
      
      // User2 requests deposit
      await vault.connect(user2).requestDeposit(DEPOSIT_AMOUNT / 2n, controller.address, user2.address);

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [3600]); // 1 hour
      await ethers.provider.send("evm_mine", []);

      // Batch process requests
      await vault.connect(owner).batchProcessRequests([0, 1], []);

      // Check request states
      const request1 = await vault.getDepositRequest(0);
      expect(request1.state).to.equal(1); // Claimable
      
      const request2 = await vault.getDepositRequest(1);
      expect(request2.state).to.equal(1); // Claimable
    });
  });
});
