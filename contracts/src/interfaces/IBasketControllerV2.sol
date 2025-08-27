// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IBasketControllerV2
 * @dev Clean interface for ERC-7540 compatible basket controller
 */
interface IBasketControllerV2 {
    
    // ================================
    // CORE STRUCTS
    // ================================
    
    struct BasketInfo {
        address[] assets;
        uint256[] weights;
        bool isActive;
    }
    
    struct DepositRequest {
        address user;
        uint256 assets;
        uint256 minShares;
        uint256 deadline;
        uint256 vaultRequestId;
    }
    
    struct RedeemRequest {
        address user;
        uint256 shares;
        uint256 minAssets;
        uint256 deadline;
        uint256 vaultRequestId;
    }

    // ================================
    // EVENTS
    // ================================
    
    event DepositRequested(address indexed user, uint256 indexed requestId, uint256 assets);
    event DepositClaimed(address indexed user, uint256 indexed requestId, uint256 shares);
    event RedeemRequested(address indexed user, uint256 indexed requestId, uint256 shares);
    event RedeemClaimed(address indexed user, uint256 indexed requestId, uint256 assets);

    // ================================
    // CORE FUNCTIONS
    // ================================
    
    function requestDeposit(uint256 assets, uint256 minShares, uint256 deadline) external returns (uint256);
    function claimDeposit(uint256 requestId) external returns (uint256);
    function requestRedeem(uint256 shares, uint256 minAssets, uint256 deadline) external returns (uint256);
    function claimRedeem(uint256 requestId) external returns (uint256);

    // ================================
    // VIEW FUNCTIONS
    // ================================
    
    function calculateNAV() external view returns (uint256);
    function getBasketInfo() external view returns (BasketInfo memory);
    function getDepositRequest(uint256 requestId) external view returns (DepositRequest memory);
    function getRedeemRequest(uint256 requestId) external view returns (RedeemRequest memory);
    function getUserRequests(address user) external view returns (uint256[] memory, uint256[] memory);
}