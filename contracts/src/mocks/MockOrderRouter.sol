// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockOrderRouter {
    using SafeERC20 for IERC20;
    
    mapping(address => mapping(address => uint256)) public exchangeRates;
    uint256 public slippageBps = 0; // No slippage by default
    bool public shouldRevert = false;
    
    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address indexed to
    );
    
    constructor() {}
    
    function setExchangeRate(address tokenIn, address tokenOut, uint256 rate) external {
        exchangeRates[tokenIn][tokenOut] = rate;
    }
    
    function setSlippage(uint256 _slippageBps) external {
        slippageBps = _slippageBps;
    }
    
    function setShouldRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }
    
    // Implementation of IOrderRouter interface
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external returns (uint256) {
        require(!shouldRevert, "MockOrderRouter: Forced revert");
        
        uint256 rate = exchangeRates[tokenIn][tokenOut];
        require(rate > 0, "No exchange rate set");
        
        uint256 amountOut = (amountIn * rate) / 1e18;
        
        // Apply slippage
        if (slippageBps > 0) {
            uint256 slippageAmount = (amountOut * slippageBps) / 10000;
            amountOut -= slippageAmount;
        }
        
        require(amountOut >= minAmountOut, "Insufficient output amount");
        
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
        
        emit SwapExecuted(tokenIn, tokenOut, amountIn, amountOut, msg.sender);
        return amountOut;
    }
    
    function swapNoSlippage(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external returns (uint256) {
        require(!shouldRevert, "MockOrderRouter: Forced revert");
        
        uint256 rate = exchangeRates[tokenIn][tokenOut];
        require(rate > 0, "No exchange rate set");
        
        uint256 amountOut = (amountIn * rate) / 1e18;
        
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
        
        emit SwapExecuted(tokenIn, tokenOut, amountIn, amountOut, msg.sender);
        return amountOut;
    }
    
    // Helper functions for testing
    function fundRouter(address token, uint256 amount) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }
    
    function quote(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256) {
        uint256 rate = exchangeRates[tokenIn][tokenOut];
        require(rate > 0, "No exchange rate set");
        return (amountIn * rate) / 1e18;
    }
}