// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IOrderRouter.sol";
import "./UniswapV3Adapter.sol";

/**
 * @title OrderRouter with MEV protection
 * @dev Routes trades through various adapters with slippage protection
 */
contract OrderRouter is IOrderRouter, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct AdapterInfo {
        address adapter;
        bool isActive;
        uint256 gasLimit;
    }

    mapping(address => AdapterInfo) public adapters;
    mapping(address => bool) public authorizedCallers;
    
    address public immutable baseToken; // USDC
    uint256 public constant MAX_SLIPPAGE_BPS = 500; // 5% max slippage
    uint256 public constant MIN_TRADE_AMOUNT = 100; // Minimum trade amount in base token decimals

    event TradeExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address adapter
    );
    event AdapterAdded(address indexed token, address adapter);
    event SlippageExceeded(address tokenIn, address tokenOut, uint256 expectedOut, uint256 actualOut);

    modifier onlyAuthorized() {
        require(authorizedCallers[msg.sender], "Not authorized");
        _;
    }

    constructor(address _baseToken) Ownable(msg.sender) {
        baseToken = _baseToken;
        authorizedCallers[msg.sender] = true;
    }

    /**
     * @dev Buy tokens using base token (USDC)
     */
    function buy(
        address tokenIn, // Should be baseToken (USDC)
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external override onlyAuthorized nonReentrant returns (uint256 amountOut) {
        require(tokenIn == baseToken, "TokenIn must be base token");
        require(amountIn >= MIN_TRADE_AMOUNT, "Amount too small");
        require(adapters[tokenOut].isActive, "No adapter for token");

        // Transfer tokens from caller
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // Get quote and check slippage
        uint256 expectedOut = quote(tokenIn, tokenOut, amountIn);
        require(expectedOut >= minAmountOut, "Insufficient output amount");

        // Execute trade through adapter
        address adapter = adapters[tokenOut].adapter;
        IERC20(tokenIn).forceApprove(adapter, amountIn);
        
        amountOut = IUniswapV3Adapter(adapter).swapExactInputSingle(
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            recipient
        );

        // Verify slippage
        if (amountOut < expectedOut * (10000 - MAX_SLIPPAGE_BPS) / 10000) {
            emit SlippageExceeded(tokenIn, tokenOut, expectedOut, amountOut);
        }

        emit TradeExecuted(tokenIn, tokenOut, amountIn, amountOut, adapter);
    }

    /**
     * @dev Sell tokens for base token (USDC)
     */
    function sell(
        address tokenIn,
        address tokenOut, // Should be baseToken (USDC)
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external override onlyAuthorized nonReentrant returns (uint256 amountOut) {
        require(tokenOut == baseToken, "TokenOut must be base token");
        require(adapters[tokenIn].isActive, "No adapter for token");

        // Transfer tokens from caller
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // Get quote and check slippage
        uint256 expectedOut = quote(tokenIn, tokenOut, amountIn);
        require(expectedOut >= minAmountOut, "Insufficient output amount");

        // Execute trade through adapter
        address adapter = adapters[tokenIn].adapter;
        IERC20(tokenIn).forceApprove(adapter, amountIn);
        
        amountOut = IUniswapV3Adapter(adapter).swapExactInputSingle(
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            recipient
        );

        // Verify slippage (same as buy function)
        if (amountOut < expectedOut * (10000 - MAX_SLIPPAGE_BPS) / 10000) {
            emit SlippageExceeded(tokenIn, tokenOut, expectedOut, amountOut);
        }

        emit TradeExecuted(tokenIn, tokenOut, amountIn, amountOut, adapter);
    }

    /**
     * @dev Get quote for trade
     */
    function quote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) public override returns (uint256 amountOut) {
        if (tokenIn == baseToken) {
            // Buying tokenOut with USDC
            require(adapters[tokenOut].isActive, "No adapter for token");
            return IUniswapV3Adapter(adapters[tokenOut].adapter).getAmountOut(
                tokenIn,
                tokenOut,
                amountIn
            );
        } else {
            // Selling tokenIn for USDC
            require(adapters[tokenIn].isActive, "No adapter for token");
            return IUniswapV3Adapter(adapters[tokenIn].adapter).getAmountOut(
                tokenIn,
                tokenOut,
                amountIn
            );
        }
    }

    /**
     * @dev Add adapter for a token
     */
    function addAdapter(address token, address adapter, uint256 gasLimit) external onlyOwner {
        require(adapter != address(0), "Invalid adapter");
        
        adapters[token] = AdapterInfo({
            adapter: adapter,
            isActive: true,
            gasLimit: gasLimit
        });

        emit AdapterAdded(token, adapter);
    }

    /**
     * @dev Authorize caller to use router
     */
    function authorizeCaller(address caller) external onlyOwner {
        authorizedCallers[caller] = true;
    }

    /**
     * @dev Remove authorization
     */
    function deauthorizeCaller(address caller) external onlyOwner {
        authorizedCallers[caller] = false;
    }
}