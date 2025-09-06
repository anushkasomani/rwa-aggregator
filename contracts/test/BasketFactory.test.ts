import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { 
  deployTestContracts, 
  getTestUsers, 
  getDefaultBasketConfig
} from "./utils/TestHelpers";

describe("BasketFactory", function () {
  async function deployFixture() {
    const contracts = await deployTestContracts();
    const users = await getTestUsers();
    return { contracts, users };
  }

  describe("Deployment", function () {
    it("Should deploy with correct parameters", async function () {
      const { contracts } = await loadFixture(deployFixture);
      
      expect(await contracts.basketFactory.oracleAggregator()).to.equal(
        await contracts.oracleAggregator.getAddress()
      );
      expect(await contracts.basketFactory.orderRouter()).to.equal(
        await contracts.orderRouter.getAddress()
      );
    });
  });

  describe("Basket Creation", function () {
    it("Should create a basket successfully", async function () {
      const { contracts, users } = await loadFixture(deployFixture);
      const config = getDefaultBasketConfig(contracts);
      
      const assets = await Promise.all(config.assets);
      const baseToken = await config.baseToken;
      
      await expect(
        contracts.basketFactory.connect(users.alice).createBasket(
          assets,
          config.weights,
          baseToken,
          config.name,
          config.symbol
        )
      ).to.emit(contracts.basketFactory, "BasketCreated");

      expect(await contracts.basketFactory.getBasketCount()).to.equal(1);
    });

    it("Should reject invalid asset count", async function () {
      const { contracts, users } = await loadFixture(deployFixture);
      
      await expect(
        contracts.basketFactory.connect(users.alice).createBasket(
          [], // Empty assets array
          [],
          await contracts.mockUSDC.getAddress(),
          "Test",
          "T"
        )
      ).to.be.revertedWithCustomError(contracts.basketFactory, "InvalidAssetCount");
    });

    it("Should reject duplicate assets", async function () {
      const { contracts, users } = await loadFixture(deployFixture);

      await expect(
        contracts.basketFactory.connect(users.alice).createBasket(
          [
            await contracts.mockUSDT.getAddress(),
            await contracts.mockUSDT.getAddress(), // Duplicate
            await contracts.mockWAVAX.getAddress()
          ],
          [3000, 4000, 3000],
          await contracts.mockUSDC.getAddress(),
          "Test",
          "T"
        )
      ).to.be.revertedWithCustomError(contracts.basketFactory, "DuplicateAsset");
    });
  });

  describe("Admin Functions", function () {
    it("Should pause basket creation", async function () {
      const { contracts, users } = await loadFixture(deployFixture);
      
      await contracts.basketFactory.pauseBasketCreation();
      expect(await contracts.basketFactory.basketCreationPaused()).to.be.true;

      const config = getDefaultBasketConfig(contracts);
      const assets = await Promise.all(config.assets);
      const baseToken = await config.baseToken;

      await expect(
        contracts.basketFactory.connect(users.alice).createBasket(
          assets,
          config.weights,
          baseToken,
          config.name,
          config.symbol
        )
      ).to.be.revertedWithCustomError(contracts.basketFactory, "CreationPaused");
    });
  });
});