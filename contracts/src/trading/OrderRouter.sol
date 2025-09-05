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

    function swapExactNATIVEForTokens(
        uint256 amountOutMin,
        Path memory path,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountOut);

    function swapExactTokensForNATIVE(
        uint256 amountIn,
        uint256 amountOutMin,
        Path memory path,
        address to,
        uint256 deadline
    ) external returns (uint256 amountOut);
}

contract SimpleOrderRouter {
    
    ILBRouter public immutable lbRouter;
    IERC20 public immutable USDC;
    IERC20 public immutable USDT;
    IERC20 public immutable WAVAX;
    
    constructor(
        address _lbRouter,
        address _usdc,
        address _usdt,
        address _wavax
    ) {
        lbRouter = ILBRouter(_lbRouter);
        USDC = IERC20(_usdc);
        USDT = IERC20(_usdt);
        WAVAX = IERC20(_wavax);
    }
    
    function swapUSDCtoUSDT(uint256 amountIn) external returns (uint256) {
        USDC.transferFrom(msg.sender, address(this), amountIn);
        USDC.approve(address(lbRouter), amountIn);
        
        IERC20[] memory tokenPath = new IERC20[](2);
        tokenPath[0] = USDC;
        tokenPath[1] = USDT;
        
        uint256[] memory pairBinSteps = new uint256[](1);
        pairBinSteps[0] = 1;
        
        ILBRouter.Version[] memory versions = new ILBRouter.Version[](1);
        versions[0] = ILBRouter.Version.V2_2;
        
        ILBRouter.Path memory path;
        path.pairBinSteps = pairBinSteps;
        path.versions = versions;
        path.tokenPath = tokenPath;
        
        uint256 amountOutMin = amountIn * 99 / 100;
        
        uint256 amountOut = lbRouter.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            msg.sender,
            block.timestamp + 300
        );
        
        return amountOut;
    }
    
    function swapUSDTtoUSDC(uint256 amountIn) external returns (uint256) {
        USDT.transferFrom(msg.sender, address(this), amountIn);
        USDT.approve(address(lbRouter), amountIn);
        
        IERC20[] memory tokenPath = new IERC20[](2);
        tokenPath[0] = USDT;
        tokenPath[1] = USDC;
        
        uint256[] memory pairBinSteps = new uint256[](1);
        pairBinSteps[0] = 1;
        
        ILBRouter.Version[] memory versions = new ILBRouter.Version[](1);
        versions[0] = ILBRouter.Version.V2_2;
        
        ILBRouter.Path memory path;
        path.pairBinSteps = pairBinSteps;
        path.versions = versions;
        path.tokenPath = tokenPath;
        
        uint256 amountOutMin = amountIn * 99 / 100;
        
        uint256 amountOut = lbRouter.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            msg.sender,
            block.timestamp + 300
        );
        
        return amountOut;
    }
    
    function swapUSDCtoAVAX(uint256 amountIn) external returns (uint256) {
        USDC.transferFrom(msg.sender, address(this), amountIn);
        USDC.approve(address(lbRouter), amountIn);
        
        IERC20[] memory tokenPath = new IERC20[](2);
        tokenPath[0] = USDC;
        tokenPath[1] = WAVAX;
        
        uint256[] memory pairBinSteps = new uint256[](1);
        pairBinSteps[0] = 15;
        
        ILBRouter.Version[] memory versions = new ILBRouter.Version[](1);
        versions[0] = ILBRouter.Version.V2_2;
        
        ILBRouter.Path memory path;
        path.pairBinSteps = pairBinSteps;
        path.versions = versions;
        path.tokenPath = tokenPath;
        
        uint256 amountOutMin = amountIn * 1e18 * 99 / (35 * 1e6 * 100);
        
        uint256 amountOut = lbRouter.swapExactTokensForNATIVE(
            amountIn,
            amountOutMin,
            path,
            msg.sender,
            block.timestamp + 300
        );
        
        return amountOut;
    }
    
    function swapAVAXtoUSDC() external payable returns (uint256) {
        IERC20[] memory tokenPath = new IERC20[](2);
        tokenPath[0] = WAVAX;
        tokenPath[1] = USDC;
        
        uint256[] memory pairBinSteps = new uint256[](1);
        pairBinSteps[0] = 15;
        
        ILBRouter.Version[] memory versions = new ILBRouter.Version[](1);
        versions[0] = ILBRouter.Version.V2_2;
        
        ILBRouter.Path memory path;
        path.pairBinSteps = pairBinSteps;
        path.versions = versions;
        path.tokenPath = tokenPath;
        
        uint256 amountOutMin = msg.value * 35 * 99 / (1e18 * 100 / 1e6);
        
        uint256 amountOut = lbRouter.swapExactNATIVEForTokens{value: msg.value}(
            amountOutMin,
            path,
            msg.sender,
            block.timestamp + 300
        );
        
        return amountOut;
    }
    
    function swapAVAXtoUSDT() external payable returns (uint256) {
        IERC20[] memory tokenPath = new IERC20[](2);
        tokenPath[0] = WAVAX;
        tokenPath[1] = USDT;
        
        uint256[] memory pairBinSteps = new uint256[](1);
        pairBinSteps[0] = 15;
        
        ILBRouter.Version[] memory versions = new ILBRouter.Version[](1);
        versions[0] = ILBRouter.Version.V2_2;
        
        ILBRouter.Path memory path;
        path.pairBinSteps = pairBinSteps;
        path.versions = versions;
        path.tokenPath = tokenPath;
        
        uint256 amountOutMin = msg.value * 35 * 99 / (1e18 * 100 / 1e6);
        
        uint256 amountOut = lbRouter.swapExactNATIVEForTokens{value: msg.value}(
            amountOutMin,
            path,
            msg.sender,
            block.timestamp + 300
        );
        
        return amountOut;
    }
    
    function swapUSDTtoAVAX(uint256 amountIn) external returns (uint256) {
        USDT.transferFrom(msg.sender, address(this), amountIn);
        USDT.approve(address(lbRouter), amountIn);
        
        IERC20[] memory tokenPath = new IERC20[](2);
        tokenPath[0] = USDT;
        tokenPath[1] = WAVAX;
        
        uint256[] memory pairBinSteps = new uint256[](1);
        pairBinSteps[0] = 15;
        
        ILBRouter.Version[] memory versions = new ILBRouter.Version[](1);
        versions[0] = ILBRouter.Version.V2_2;
        
        ILBRouter.Path memory path;
        path.pairBinSteps = pairBinSteps;
        path.versions = versions;
        path.tokenPath = tokenPath;
        
        uint256 amountOutMin = amountIn * 1e18 * 99 / (35 * 1e6 * 100);
        
        uint256 amountOut = lbRouter.swapExactTokensForNATIVE(
            amountIn,
            amountOutMin,
            path,
            msg.sender,
            block.timestamp + 300
        );
        
        return amountOut;
    }
}