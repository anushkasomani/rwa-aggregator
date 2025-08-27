// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/interfaces/IERC4626.sol";

/**
 * @title IBasketVaultERC7540
 * @dev Interface for ERC-7540 compliant basket vault with asynchronous functionality
 * @notice ERC-7540 specific functions that extend ERC-4626
 */
interface IBasketVaultERC7540 is IERC4626 {
    
    // ================================
    // STRUCTS
    // ================================
    
    enum RequestState { Pending, Claimable, Claimed }

    struct VaultDepositRequest {
        address owner;
        address controller;
        uint256 assets;
        RequestState state;
        uint256 shares;
        uint256 timestamp;
    }
    
    struct VaultRedeemRequest {
        address owner;
        address controller;
        uint256 shares;
        RequestState state;
        uint256 assets;
        uint256 timestamp;
    }

    // ================================
    // ERC-7540 EVENTS (only non-ERC4626 events)
    // ================================
    
    // ERC-7540 Events  
    event DepositRequest(address indexed controller, address indexed owner, uint256 indexed requestId, address sender, uint256 assets);
    event RedeemRequest(address indexed controller, address indexed owner, uint256 indexed requestId, address sender, uint256 assets);
    event OperatorSet(address indexed controller, address indexed operator, bool approved);
    
    // Vault-specific Events
    event TokenAuthorized(address indexed token);
    event TokenDeauthorized(address indexed token);
    event EmergencyPaused();
    event EmergencyUnpaused();
    event ProcessingDelayUpdated(uint256 newDelay);
    event RequestProcessed(uint256 indexed requestId, bool isDeposit);

    // ================================
    // ERRORS
    // ================================
    
    error InvalidAssets();
    error InvalidShares();
    error InvalidController();
    error InvalidOwner();
    error InvalidRequestId();
    error RequestNotPending();
    error RequestNotClaimable();
    error NotControllerOrOperator();
    error VaultEmergencyPaused();
    error InsufficientBalance();
    error ProcessingDelayNotMet();

    // ================================
    // ERC-7540 FUNCTIONS
    // ================================
    
    // Async Deposit Operations
    function requestDeposit(uint256 assets, address controller, address owner) external returns (uint256 requestId);
    function pendingDepositRequest(uint256 requestId, address controller) external view returns (uint256 pendingAssets);
    function claimableDepositRequest(uint256 requestId, address controller) external view returns (uint256 claimableAssets);
    
    // ERC-7540 claim operations (3-parameter versions with controller)
    function deposit(uint256 assets, address receiver, address controller) external returns (uint256 shares);
    function mint(uint256 shares, address receiver, address controller) external returns (uint256 assets);
    function withdraw(uint256 assets, address receiver, address controller) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address controller) external returns (uint256 assets);
    
    // Async Redeem Operations
    function requestRedeem(uint256 shares, address controller, address owner) external returns (uint256 requestId);
    function pendingRedeemRequest(uint256 requestId, address controller) external view returns (uint256 pendingShares);
    function claimableRedeemRequest(uint256 requestId, address controller) external view returns (uint256 claimableShares);
    
    // Operator Management
    function setOperator(address operator, bool approved) external returns (bool);
    function isOperator(address controller, address operator) external view returns (bool status);

    // ================================
    // ADMINISTRATIVE FUNCTIONS
    // ================================
    
    /**
     * @dev Process a pending deposit request, making it claimable
     * @param requestId The ID of the request to process
     */
    function processDepositRequest(uint256 requestId) external;
    
    /**
     * @dev Process a pending redeem request, making it claimable
     * @param requestId The ID of the request to process
     */
    function processRedeemRequest(uint256 requestId) external;
    
    /**
     * @dev Batch process multiple requests for gas efficiency
     * @param depositRequestIds Array of deposit request IDs to process
     * @param redeemRequestIds Array of redeem request IDs to process
     */
    function batchProcessRequests(
        uint256[] calldata depositRequestIds, 
        uint256[] calldata redeemRequestIds
    ) external;

    // ================================
    // CONFIGURATION FUNCTIONS
    // ================================
    
    /**
     * @dev Set the processing delay for async operations
     * @param newDelay New delay in seconds
     */
    function setProcessingDelay(uint256 newDelay) external;
    
    /**
     * @dev Authorize a token for vault operations
     * @param token The token address to authorize
     */
    function authorizeToken(address token) external;
    
    /**
     * @dev Deauthorize a token from vault operations
     * @param token The token address to deauthorize
     */
    function deauthorizeToken(address token) external;
    
    /**
     * @dev Emergency pause all operations
     */
    function emergencyPause() external;
    
    /**
     * @dev Unpause operations
     */
    function emergencyUnpause() external;

    // ================================
    // VIEW FUNCTIONS
    // ================================
    
    /**
     * @dev Get deposit request details
     * @param requestId The request ID
     * @return The deposit request struct
     */
    function getDepositRequest(uint256 requestId) external view returns (VaultDepositRequest memory);
    
    /**
     * @dev Get redeem request details
     * @param requestId The request ID
     * @return The redeem request struct
     */
    function getRedeemRequest(uint256 requestId) external view returns (VaultRedeemRequest memory);
    
    /**
     * @dev Get all deposit request IDs for a controller
     * @param controller The controller address
     * @return Array of deposit request IDs
     */
    function getControllerDepositRequests(address controller) external view returns (uint256[] memory);
    
    /**
     * @dev Get all redeem request IDs for a controller
     * @param controller The controller address
     * @return Array of redeem request IDs
     */
    function getControllerRedeemRequests(address controller) external view returns (uint256[] memory);
    
    /**
     * @dev Get the next request ID that will be assigned
     * @return The next request ID
     */
    function getNextRequestId() external view returns (uint256);
    
    /**
     * @dev Get current processing delay
     * @return Processing delay in seconds
     */
    function processingDelay() external view returns (uint256);
    
    /**
     * @dev Check if emergency is paused
     * @return True if paused, false otherwise
     */
    function emergencyPaused() external view returns (bool);
    
    /**
     * @dev Check if a token is authorized
     * @param token The token address to check
     * @return True if authorized, false otherwise
     */
    function authorizedTokens(address token) external view returns (bool);

    // ================================
    // ERC-7575 COMPATIBILITY
    // ================================
    
    /**
     * @dev Returns the address of the share token (this contract)
     * @return The address of this contract
     */
    function share() external view returns (address);
}