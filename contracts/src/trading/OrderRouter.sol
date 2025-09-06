// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ILBRouter {
    enum Version {
        V1,
        V2,
        V2_1,
        V2_2
    }

    struct Path {
        uint256[] pairBinSteps;
        Version[] versions;
        IERC20[] tokenPath;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Path memory path,
        address to,
        uint256 deadline
    ) external returns (uint256 amountOut);
}

contract OrderRouter {
    
    ILBRouter public immutable lbRouter;
    
    mapping(address => mapping(address => uint256)) public pairBinSteps;
    
    constructor(address _lbRouter) {
        lbRouter = ILBRouter(_lbRouter);
    }
    
    function setPairBinStep(
        address tokenA,
        address tokenB,
        uint256 binStep
    ) external {
        pairBinSteps[tokenA][tokenB] = binStep;
        pairBinSteps[tokenB][tokenA] = binStep;
    }
    
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut  // Let caller specify exact minimum
    ) external returns (uint256) {
        uint256 binStep = pairBinSteps[tokenIn][tokenOut];
        require(binStep > 0, "Pair not configured");
        
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).approve(address(lbRouter), amountIn);
        
        IERC20[] memory tokenPath = new IERC20[](2);
        tokenPath[0] = IERC20(tokenIn);
        tokenPath[1] = IERC20(tokenOut);
        
        uint256[] memory binSteps = new uint256[](1);
        binSteps[0] = binStep;
        
        ILBRouter.Version[] memory versions = new ILBRouter.Version[](1);
        versions[0] = ILBRouter.Version.V2_2;
        
        ILBRouter.Path memory path;
        path.pairBinSteps = binSteps;
        path.versions = versions;
        path.tokenPath = tokenPath;
        
        uint256 amountOut = lbRouter.swapExactTokensForTokens(
            amountIn,
            minAmountOut,  // Use the provided minimum
            path,
            msg.sender,
            block.timestamp + 300
        );
        
        return amountOut;
    }
    
    // Simple version with no slippage protection
    function swapNoSlippage(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external returns (uint256) {
        uint256 binStep = pairBinSteps[tokenIn][tokenOut];
        require(binStep > 0, "Pair not configured");
        
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).approve(address(lbRouter), amountIn);
        
        IERC20[] memory tokenPath = new IERC20[](2);
        tokenPath[0] = IERC20(tokenIn);
        tokenPath[1] = IERC20(tokenOut);
        
        uint256[] memory binSteps = new uint256[](1);
        binSteps[0] = binStep;
        
        ILBRouter.Version[] memory versions = new ILBRouter.Version[](1);
        versions[0] = ILBRouter.Version.V2_2;
        
        ILBRouter.Path memory path;
        path.pairBinSteps = binSteps;
        path.versions = versions;
        path.tokenPath = tokenPath;
        
        uint256 amountOut = lbRouter.swapExactTokensForTokens(
            amountIn,
            1,  // Accept any amount (be careful with this!)
            path,
            msg.sender,
            block.timestamp + 300
        );
        
        return amountOut;
    }
}