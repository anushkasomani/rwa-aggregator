// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockOracleAggregator {
    mapping(address => uint256) private _prices;
    mapping(address => bool) private _supported;
    uint8 private constant DECIMALS = 18;
    
    event PriceUpdated(address indexed asset, uint256 price);
    
    constructor() {}
    
    function setPrice(address asset, uint256 price) external {
        _prices[asset] = price;
        _supported[asset] = true;
        emit PriceUpdated(asset, price);
    }
    
    function getPrice(address asset) external view returns (uint256) {
        require(_supported[asset], "Asset not supported");
        return _prices[asset];
    }
    
    function isSupported(address asset) external view returns (bool) {
        return _supported[asset];
    }
    
    function removeAsset(address asset) external {
        _supported[asset] = false;
        _prices[asset] = 0;
    }
    
    // Chainlink compatibility functions
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        // For mock purposes, return dummy round data
        // In a real oracle, this would be the actual round data
        return (1, 0, block.timestamp, block.timestamp, 1);
    }
    
    function getDecimals() external pure returns (uint8) {
        return DECIMALS;
    }
}