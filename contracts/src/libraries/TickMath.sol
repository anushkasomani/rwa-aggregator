// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title TickMath library for Uniswap V3 price calculations
 * @dev Simplified version - use official Uniswap library in production
 */
library TickMath {
    /// @dev The minimum tick that may be passed to #getSqrtRatioAtTick computed from log base 1.0001 of 2**-128
    int24 internal constant MIN_TICK = -887272;
    /// @dev The maximum tick that may be passed to #getSqrtRatioAtTick computed from log base 1.0001 of 2**128
    int24 internal constant MAX_TICK = -MIN_TICK;

    /// @dev The minimum value that can be returned from #getSqrtRatioAtTick. Equivalent to getSqrtRatioAtTick(MIN_TICK)
    uint160 internal constant MIN_SQRT_RATIO = 4295128739;
    /// @dev The maximum value that can be returned from #getSqrtRatioAtTick. Equivalent to getSqrtRatioAtTick(MAX_TICK)
    uint160 internal constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

    /**
     * @notice Calculates sqrt(1.0001^tick) * 2^96
     * @dev Simplified implementation - use official Uniswap library for production
     */
    function getSqrtRatioAtTick(int24 tick) internal pure returns (uint160 sqrtPriceX96) {
        // This is a simplified approximation
        // In production, use the official Uniswap V3 TickMath library
        require(tick >= MIN_TICK && tick <= MAX_TICK, "T");
        
        // Very simplified calculation - replace with official implementation
        if (tick == 0) return 79228162514264337593543950336; // 2^96
        
        // Approximate calculation for demonstration
        // This is NOT accurate and should be replaced
        uint256 absTick = tick < 0 ? uint256(-int256(tick)) : uint256(int256(tick));
        uint256 ratio = absTick > 0 ? 79228162514264337593543950336 + (absTick * 100000000000000000) : 79228162514264337593543950336;
        
        if (tick < 0) ratio = type(uint256).max / ratio;
        
        sqrtPriceX96 = uint160(ratio);
    }

    /**
     * @notice Convert sqrtPriceX96 to human readable price
     */
    function sqrtPriceX96ToPrice(uint160 sqrtPriceX96, uint8 decimalsToken0, uint8 decimalsToken1) 
        internal 
        pure 
        returns (uint256 price) 
    {
        uint256 sqrtPrice = uint256(sqrtPriceX96);
        uint256 price256 = (sqrtPrice * sqrtPrice) >> 192; // Remove 2^96 scaling
        
        // Adjust for decimals
        if (decimalsToken0 > decimalsToken1) {
            price = price256 * (10 ** (decimalsToken0 - decimalsToken1));
        } else if (decimalsToken1 > decimalsToken0) {
            price = price256 / (10 ** (decimalsToken1 - decimalsToken0));
        } else {
            price = price256;
        }
    }
}