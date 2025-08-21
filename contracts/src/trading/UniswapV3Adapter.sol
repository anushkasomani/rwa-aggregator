// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/interfaces/IQuoter.sol";

interface IUniswapV3Adapter {
    function swapExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMinimum,
        address recipient
    ) external returns (uint256 amountOut);

    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external returns (uint256 amountOut);
}

/**
 * @title UniswapV3Adapter for secure token swaps
 * @dev Handles Uniswap V3 interactions with slippage protection
 */
contract UniswapV3Adapter is IUniswapV3Adapter {
    using SafeERC20 for IERC20;

    ISwapRouter public immutable swapRouter;
    IQuoter public immutable quoter;
    
    mapping(address => mapping(address => uint24)) public poolFees;
    address public immutable owner;

    // Common pool fees
    uint24 public constant POOL_FEE_LOW = 500;      // 0.05%
    uint24 public constant POOL_FEE_MEDIUM = 3000;  // 0.3%
    uint24 public constant POOL_FEE_HIGH = 10000;   // 1%

    event PoolFeeSet(address indexed tokenA, address indexed tokenB, uint24 fee);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address _swapRouter, address _quoter) {
        swapRouter = ISwapRouter(_swapRouter);
        quoter = IQuoter(_quoter);
        owner = msg.sender;
    }

    /**
     * @dev Execute exact input swap
     */
    function swapExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMinimum,
        address recipient
    ) external override returns (uint256 amountOut) {
        require(amountIn > 0, "Amount must be positive");
        
        uint24 fee = getPoolFee(tokenIn, tokenOut);
        require(fee > 0, "Pool not configured");

        // Transfer tokens to this contract
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Approve router
        IERC20(tokenIn).forceApprove(address(swapRouter), amountIn);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            recipient: recipient,
            deadline: block.timestamp + 300, // 5 minutes
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: 0
        });

        amountOut = swapRouter.exactInputSingle(params);
    }

    /**
     * @dev Get quote for swap
     */
    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external override returns (uint256 amountOut) {
        uint24 fee = getPoolFee(tokenIn, tokenOut);
        require(fee > 0, "Pool not configured");

        try quoter.quoteExactInputSingle(tokenIn, tokenOut, fee, amountIn, 0) returns (uint256 quote) {
            return quote;
        } catch {
            return 0;
        }
    }

    /**
     * @dev Get pool fee for token pair
     */
    function getPoolFee(address tokenA, address tokenB) public view returns (uint24) {
        uint24 fee = poolFees[tokenA][tokenB];
        if (fee == 0) {
            fee = poolFees[tokenB][tokenA];
        }
        return fee;
    }

    /**
     * @dev Set pool fee for token pair
     */
    function setPoolFee(address tokenA, address tokenB, uint24 fee) external onlyOwner {
        require(fee == POOL_FEE_LOW || fee == POOL_FEE_MEDIUM || fee == POOL_FEE_HIGH, "Invalid fee");
        
        poolFees[tokenA][tokenB] = fee;
        poolFees[tokenB][tokenA] = fee;

        emit PoolFeeSet(tokenA, tokenB, fee);
    }

    /**
     * @dev Emergency token recovery
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner, amount);
    }
}