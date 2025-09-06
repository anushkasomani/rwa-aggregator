# Deployment Guide - Fuji Testnet

## Prerequisites

1. **Environment Setup**:
   ```bash
   # Add your private key to .env file
   PRIVATE_KEY=your_private_key_here
   ```

2. **AVAX Balance**: Ensure your account has AVAX for gas fees
   - Get testnet AVAX from: https://faucet.avax.network/

## Deploy Contracts

```bash
# Deploy to Fuji testnet
npx hardhat run scripts/deploy-fuji.ts --network avalancheFuji
```

## Post-Deployment Setup

### 1. Update OrderRouter Bin Steps
The script uses placeholder bin steps. Update with actual TraderJoe V2 values:

```typescript
// Find correct bin steps from TraderJoe V2 UI or contract calls
await orderRouter.setPairBinStep(USDC_ADDRESS, USDT_ADDRESS, actualBinStep);
```

### 2. Replace Mock Oracle (Production)
For production, replace MockOracleAggregator with Chainlink price feeds:

```solidity
// Example Chainlink integration
contract ChainlinkOracleAggregator {
  mapping(address => address) public priceFeeds;
  
  function setChainlinkFeed(address asset, address priceFeed) external onlyOwner {
    priceFeeds[asset] = priceFeed;
  }
  
  function getPrice(address asset) external view returns (uint256) {
    address priceFeed = priceFeeds[asset];
    require(priceFeed != address(0), "No price feed");
    
    (, int256 price, , , ) = AggregatorV3Interface(priceFeed).latestRoundData();
    return uint256(price * 1e10); // Convert to 1e18 scale
  }
}
```

### 3. Create Your First Basket

```typescript
// Multi-asset basket with USDT and WAVAX
await basketFactory.createBasket(
  [
    "0xAb231A5744C8E6c45481754928cCfFFFD4aa0732", // USDT
    "0xd00ae08403B9bbb9124bB305C09058E32C39A48c"  // WAVAX
  ],
  [6000, 4000], // 60% USDT, 40% WAVAX
  "0xB6076C93701D6a07266c31066B298AeC6dd65c2d", // USDC base
  "USDT-WAVAX Basket",
  "UWB"
);
```

## Deployed Addresses

After deployment, you'll get addresses for:
- **MockOracleAggregator**: Price oracle (replace with Chainlink)
- **OrderRouter**: DEX integration via TraderJoe V2
- **BasketFactory**: Creates and manages baskets

## Bot Development

With deployed contracts, you can start bot development:

```typescript
const bot = new BasketBot({
  basketFactoryAddress: "0x...", // From deployment
  rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
  privateKey: process.env.BOT_PRIVATE_KEY
});

await bot.start();
```

## Verification

Verify contracts on Snowtrace (optional):
```bash
npx hardhat verify --network avalancheFuji <contract_address> <constructor_args>
```

## Troubleshooting

1. **Gas Issues**: Increase gas limit or price in hardhat.config.ts
2. **Bin Step Errors**: Check TraderJoe V2 documentation for correct bin steps
3. **Oracle Errors**: Ensure price feeds are set for all basket assets