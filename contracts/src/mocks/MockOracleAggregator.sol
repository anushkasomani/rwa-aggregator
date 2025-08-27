// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockOracleAggregator {
    mapping(address => uint256) private _prices;
    
    constructor() {
        // Set default prices (in 18 decimals)
        // USDC = $1.00
        // WETH = $2000
        // WBTC = $40000
    }
    
    function setPrice(address asset, uint256 price) external {
        _prices[asset] = price;
    }
    
    function getPrice(address asset) external view returns (uint256) {
        uint256 price = _prices[asset];
        require(price > 0, "Price not set");
        return price;
    }
}