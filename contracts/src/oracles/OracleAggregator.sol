// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

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

contract AVAXPriceFeed {
    
    AggregatorV3Interface internal priceFeed;
    
    /**
     * Network: Avalanche Fuji Testnet
     * Aggregator: AVAX/USD
     * Address: 0x5498BB86BC934c8D34FDA08E81D444153d0D06aD
     * Source: https://docs.chain.link/data-feeds/price-feeds/addresses
     */
    constructor() {
        priceFeed = AggregatorV3Interface(0x5498BB86BC934c8D34FDA08E81D444153d0D06aD);
    }

    function getLatestPrice() public view returns (int256) {
        (
            /* uint80 roundID */,
            int256 price,
            /* uint256 startedAt */,
            /* uint256 updatedAt */,
            /* uint80 answeredInRound */
        ) = priceFeed.latestRoundData();
        
        return price;
    }
    
    function getLatestRoundData() public view returns (
        uint80 roundId,
        int256 price,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return priceFeed.latestRoundData();
    }

    function getDecimals() public view returns (uint8) {
        return priceFeed.decimals();
    }

    function getDescription() public view returns (string memory) {
        return priceFeed.description();
    }

    function getPriceIn18Decimals() public view returns (uint256) {
        int256 price = getLatestPrice();
        require(price > 0, "Invalid price");
        
        uint8 decimals = getDecimals();
        
        // Scale from 8 decimals to 18 decimals
        if (decimals < 18) {
            return uint256(price) * 10**(18 - decimals);
        } else if (decimals > 18) {
            return uint256(price) / 10**(decimals - 18);
        } else {
            return uint256(price);
        }
    }

    function getPriceWithDecimals(uint8 targetDecimals) public view returns (uint256) {
        int256 price = getLatestPrice();
        require(price > 0, "Invalid price");
        
        uint8 sourceDecimals = getDecimals();
        
        if (sourceDecimals < targetDecimals) {
            return uint256(price) * 10**(targetDecimals - sourceDecimals);
        } else if (sourceDecimals > targetDecimals) {
            return uint256(price) / 10**(sourceDecimals - targetDecimals);
        } else {
            return uint256(price);
        }
    }
}