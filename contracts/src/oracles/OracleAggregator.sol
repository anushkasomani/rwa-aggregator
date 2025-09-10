// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

// Chainlink Aggregator Interface
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    
    function description() external view returns (string memory);
    
    function version() external view returns (uint256);
    
    function getRoundData(uint80 _roundId) external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 price,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}

contract OracleAggregator is Ownable {
    
    mapping(address => address) public priceFeeds;
    mapping(address => uint256) public manualPrices;
    mapping(address => bool) public useManualPrice;
    
    event PriceFeedSet(address indexed asset, address indexed priceFeed);
    event ManualPriceSet(address indexed asset, uint256 price);
    
    /**
     * Network: Avalanche Fuji Testnet
     * Default Chainlink Price Feeds
     */
    constructor() Ownable(msg.sender) {
        // AVAX/USD on Fuji
        priceFeeds[0xd00ae08403B9bbb9124bB305C09058E32C39A48c] = 0x5498BB86BC934c8D34FDA08E81D444153d0D06aD;
        
        // Set manual prices for stablecoins (since Chainlink feeds might not be available on testnet)
        manualPrices[0xB6076C93701D6a07266c31066B298AeC6dd65c2d] = 1e18; // USDC = $1
        useManualPrice[0xB6076C93701D6a07266c31066B298AeC6dd65c2d] = true;
        
        manualPrices[0xAb231A5744C8E6c45481754928cCfFFFD4aa0732] = 1e18; // USDT = $1  
        useManualPrice[0xAb231A5744C8E6c45481754928cCfFFFD4aa0732] = true;
    }

    // Admin functions
    function setPriceFeed(address asset, address priceFeed) external onlyOwner {
        priceFeeds[asset] = priceFeed;
        useManualPrice[asset] = false;
        emit PriceFeedSet(asset, priceFeed);
    }
    
    function setManualPrice(address asset, uint256 price) external onlyOwner {
        manualPrices[asset] = price;
        useManualPrice[asset] = true;
        emit ManualPriceSet(asset, price);
    }
    
    function enableRealTimePrice(address asset) external onlyOwner {
        require(priceFeeds[asset] != address(0), "No Chainlink feed configured");
        useManualPrice[asset] = false;
        emit PriceFeedSet(asset, priceFeeds[asset]);
    }
    
    // Main price function - supports multiple assets
    function getPrice(address asset) public view returns (uint256) {
        if (useManualPrice[asset]) {
            require(manualPrices[asset] > 0, "Manual price not set");
            return manualPrices[asset];
        }
        
        address feed = priceFeeds[asset];
        require(feed != address(0), "Price feed not configured");
        
        AggregatorV3Interface priceFeed = AggregatorV3Interface(feed);
        (
            /* uint80 roundID */,
            int256 price,
            /* uint256 startedAt */,
            /* uint256 updatedAt */,
            /* uint80 answeredInRound */
        ) = priceFeed.latestRoundData();
        
        require(price > 0, "Invalid price from feed");
        
        // Scale to 18 decimals
        uint8 feedDecimals = priceFeed.decimals();
        if (feedDecimals < 18) {
            return uint256(price) * 10**(18 - feedDecimals);
        } else if (feedDecimals > 18) {
            return uint256(price) / 10**(feedDecimals - 18);
        } else {
            return uint256(price);
        }
    }
    
    // Chainlink compatibility functions
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        // Default to WAVAX feed for compatibility
        address defaultAsset = 0xd00ae08403B9bbb9124bB305C09058E32C39A48c;
        if (useManualPrice[defaultAsset]) {
            return (1, int256(manualPrices[defaultAsset]), block.timestamp, block.timestamp, 1);
        }
        
        address feed = priceFeeds[defaultAsset];
        require(feed != address(0), "Default price feed not configured");
        return AggregatorV3Interface(feed).latestRoundData();
    }

    function getDecimals() external pure returns (uint8) {
        return 18; // All prices normalized to 18 decimals
    }
}