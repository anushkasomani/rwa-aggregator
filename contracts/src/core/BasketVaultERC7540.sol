// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "../interfaces/IERC20Extended.sol";

// Import our clean interfaces
import "../interfaces/IBasketVaultERC7540.sol";

/**
 * @title BasketVaultERC7540
 * @dev ERC-7540 compliant asynchronous tokenized vault for basket assets
 * @notice Implements ERC-4626 + ERC-7540 with asynchronous deposit/redeem functionality
 * @author RWA Aggregator Team
 */
contract BasketVaultERC7540 is 
    ERC4626,  // ✅ Now properly extending OpenZeppelin ERC4626
    IBasketVaultERC7540, 
    Ownable, 
    ReentrancyGuard 
{
    using SafeERC20 for IERC20;
    using Math for uint256;

    // ================================
    // STATE VARIABLES
    // ================================

    /// @notice Request ID counter
    uint256 private _requestIdCounter;

    /// @notice Mapping from controller to operator approval status
    mapping(address => mapping(address => bool)) private _operators;

    /// @notice Mapping from request ID to deposit request
    mapping(uint256 => VaultDepositRequest) private _depositRequests;

    /// @notice Mapping from request ID to redeem request
    mapping(uint256 => VaultRedeemRequest) private _redeemRequests;

    /// @notice Mapping from controller to their request IDs
    mapping(address => uint256[]) private _controllerDepositRequests;
    mapping(address => uint256[]) private _controllerRedeemRequests;

    // Security and operational features
    mapping(address => bool) public authorizedTokens;
    uint256 public constant WITHDRAWAL_COOLDOWN = 1 minutes;
    bool public emergencyPaused;
    uint256 public processingDelay = 1 hours; // Default 1 hour delay for async operations

    // ================================
    // MODIFIERS
    // ================================

    modifier notPaused() {
        if (emergencyPaused) revert VaultEmergencyPaused();
        _;
    }

    modifier onlyControllerOrOperator(address controller) {
        if (controller != msg.sender && !isOperator(controller, msg.sender)) {
            revert NotControllerOrOperator();
        }
        _;
    }

    modifier validRequestId(uint256 requestId) {
        if (requestId >= _requestIdCounter) revert InvalidRequestId();
        _;
    }

    // ================================
    // CONSTRUCTOR
    // ================================

    constructor(
        IERC20 asset_,
        string memory name_,
        string memory symbol_
    ) 
        ERC4626(asset_)  // ✅ Properly initialize ERC4626 with asset
        ERC20(name_, symbol_) 
        Ownable(msg.sender)
    {
        // Authorize the asset token by default
        authorizedTokens[address(asset_)] = true;
        emit TokenAuthorized(address(asset_));
    }

    // ================================
    // ERC-4626 OVERRIDES (only when we need custom behavior)
    // ================================

    /// @dev Override to implement emergency pause functionality
    function maxDeposit(address) public view override(ERC4626, IERC4626) returns (uint256) {
        return emergencyPaused ? 0 : type(uint256).max;
    }

    /// @dev Override to implement emergency pause functionality
    function maxMint(address) public view override(ERC4626, IERC4626) returns (uint256) {
        return emergencyPaused ? 0 : type(uint256).max;
    }

    /// @dev Override to implement emergency pause functionality
    function maxWithdraw(address owner) public view override(ERC4626, IERC4626) returns (uint256) {
        if (emergencyPaused) return 0;
        return _convertToAssets(balanceOf(owner), Math.Rounding.Floor);
    }

    /// @dev Override to implement emergency pause functionality
    function maxRedeem(address owner) public view override(ERC4626, IERC4626) returns (uint256) {
        if (emergencyPaused) return 0;
        return balanceOf(owner);
    }

    /// @dev Override deposit to add pause check
    function deposit(uint256 assets, address receiver) 
        public 
        override(ERC4626, IERC4626) 
        notPaused 
        returns (uint256 shares) 
    {
        return super.deposit(assets, receiver);
    }

    /// @dev Override mint to add pause check
    function mint(uint256 shares, address receiver) 
        public 
        override(ERC4626, IERC4626) 
        notPaused 
        returns (uint256 assets) 
    {
        return super.mint(shares, receiver);
    }

    /// @dev Override withdraw to add pause check
    function withdraw(uint256 assets, address receiver, address owner)
        public
        override(ERC4626, IERC4626)
        notPaused
        returns (uint256 shares)
    {
        return super.withdraw(assets, receiver, owner);
    }

    /// @dev Override redeem to add pause check
    function redeem(uint256 shares, address receiver, address owner)
        public
        override(ERC4626, IERC4626)
        notPaused
        returns (uint256 assets)
    {
        return super.redeem(shares, receiver, owner);
    }

    // ================================
    // ERC-7540 ASYNCHRONOUS OPERATIONS
    // ================================

    /// @dev ERC-7540 deposit function
    function requestDeposit(uint256 assets, address controller, address owner)
        external
        notPaused
        nonReentrant
        returns (uint256 requestId)
    {
        if (assets == 0) revert InvalidAssets();
        if (controller == address(0)) revert InvalidController();
        if (owner != msg.sender) revert InvalidOwner();

        requestId = _requestIdCounter++;
        
        // Transfer assets to vault
        IERC20(asset()).safeTransferFrom(owner, address(this), assets);

        // Store request
        _depositRequests[requestId] = VaultDepositRequest({
            owner: owner,
            controller: controller,
            assets: assets,
            state: IBasketVaultERC7540.RequestState.Pending,
            shares: 0,
            timestamp: block.timestamp
        });

        // Track request for controller
        _controllerDepositRequests[controller].push(requestId);

        emit DepositRequest(controller, owner, requestId, msg.sender, assets);
    }

    /// @dev ERC-7540 redeem function
    function requestRedeem(uint256 shares, address controller, address owner)
        external
        notPaused
        nonReentrant
        returns (uint256 requestId)
    {
        if (shares == 0) revert InvalidShares();
        if (controller == address(0)) revert InvalidController();

        // Handle allowance if needed
        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }

        requestId = _requestIdCounter++;
        
        // Lock shares by transferring to vault
        _transfer(owner, address(this), shares);

        // Store request
        _redeemRequests[requestId] = VaultRedeemRequest({
            owner: owner,
            controller: controller,
            shares: shares,
            state: IBasketVaultERC7540.RequestState.Pending,
            assets: 0,
            timestamp: block.timestamp
        });

        // Track request for controller
        _controllerRedeemRequests[controller].push(requestId);

        emit RedeemRequest(controller, owner, requestId, msg.sender, shares);
    }

    /// @dev ERC-7540 deposit function
    function pendingDepositRequest(uint256 requestId, address controller)
        external
        view
        validRequestId(requestId)
        returns (uint256 pendingAssets)
    {
        VaultDepositRequest storage request = _depositRequests[requestId];
        if (request.controller != controller || request.state != IBasketVaultERC7540.RequestState.Pending) {
            return 0;
        }
        return request.assets;
    }

    /// @dev ERC-7540 deposit function
    function claimableDepositRequest(uint256 requestId, address controller)
        external
        view
        validRequestId(requestId)
        returns (uint256 claimableAssets)
    {
        VaultDepositRequest storage request = _depositRequests[requestId];
        if (request.controller != controller || request.state != IBasketVaultERC7540.RequestState.Claimable) {
            return 0;
        }
        return request.assets;
    }

    /// @dev ERC-7540 redeem function
    function pendingRedeemRequest(uint256 requestId, address controller)
        external
        view
        validRequestId(requestId)
        returns (uint256 pendingShares)
    {
        VaultRedeemRequest storage request = _redeemRequests[requestId];
        if (request.controller != controller || request.state != IBasketVaultERC7540.RequestState.Pending) {
            return 0;
        }
        return request.shares;
    }

    /// @dev ERC-7540 redeem function
    function claimableRedeemRequest(uint256 requestId, address controller)
        external
        view
        validRequestId(requestId)
        returns (uint256 claimableShares)
    {
        VaultRedeemRequest storage request = _redeemRequests[requestId];
        if (request.controller != controller || request.state != IBasketVaultERC7540.RequestState.Claimable) {
            return 0;
        }
        return request.shares;
    }

    // ================================
    // ERC-7540 CLAIM OPERATIONS
    // ================================

    /// @dev ERC-7540 version of deposit that claims from requests
    function deposit(uint256 assets, address receiver, address controller)
        public
        onlyControllerOrOperator(controller)
        notPaused
        nonReentrant
        returns (uint256 shares)
    {
        // Find and claim from a claimable deposit request
        uint256 requestId = _findClaimableDepositRequest(controller, assets);
        
        if (requestId != type(uint256).max) {
            // Claim from request
            VaultDepositRequest storage request = _depositRequests[requestId];
            shares = request.shares;
            request.state = IBasketVaultERC7540.RequestState.Claimed;
            
            _mint(receiver, shares);
            emit Deposit(msg.sender, receiver, assets, shares);
            
        } else {
            // Direct deposit (synchronous fallback) - delegate to ERC4626
            shares = ERC4626.deposit(assets, receiver);
        }
    }

    /// @dev ERC-7540 version of mint that claims from requests
    function mint(uint256 shares, address receiver, address controller)
        public
        onlyControllerOrOperator(controller)
        notPaused
        nonReentrant
        returns (uint256 assets)
    {
        // Find and claim from a claimable deposit request
        uint256 requestId = _findClaimableDepositRequestByShares(controller, shares);
        
        if (requestId != type(uint256).max) {
            // Claim from request
            VaultDepositRequest storage request = _depositRequests[requestId];
            assets = request.assets;
            request.state = IBasketVaultERC7540.RequestState.Claimed;
            
            _mint(receiver, shares);
            emit Deposit(msg.sender, receiver, assets, shares);
            
        } else {
            // Direct mint (synchronous fallback) - delegate to ERC4626
            assets = ERC4626.mint(shares, receiver);
        }
    }

    // ================================
    // OPERATOR MANAGEMENT
    // ================================

    /// @dev ERC-7540 operator function
    function setOperator(address operator, bool approved) 
        external 
        returns (bool) 
    {
        _operators[msg.sender][operator] = approved;
        emit OperatorSet(msg.sender, operator, approved);
        return true;
    }

    /// @dev ERC-7540 operator function
    function isOperator(address controller, address operator) 
        public 
        view 
        returns (bool) 
    {
        return _operators[controller][operator];
    }

    // ================================
    // INTERNAL FUNCTIONS
    // ================================

    function _findClaimableDepositRequest(address controller, uint256 assets) 
        internal 
        view 
        returns (uint256) 
    {
        uint256[] storage requests = _controllerDepositRequests[controller];
        for (uint256 i = 0; i < requests.length; i++) {
            uint256 requestId = requests[i];
            VaultDepositRequest storage request = _depositRequests[requestId];
            if (request.state == IBasketVaultERC7540.RequestState.Claimable && request.assets == assets) {
                return requestId;
            }
        }
        return type(uint256).max;
    }

    function _findClaimableDepositRequestByShares(address controller, uint256 shares) 
        internal 
        view 
        returns (uint256) 
    {
        uint256[] storage requests = _controllerDepositRequests[controller];
        for (uint256 i = 0; i < requests.length; i++) {
            uint256 requestId = requests[i];
            VaultDepositRequest storage request = _depositRequests[requestId];
            if (request.state == IBasketVaultERC7540.RequestState.Claimable && request.shares == shares) {
                return requestId;
            }
        }
        return type(uint256).max;
    }

    // ================================
    // ADMIN FUNCTIONS
    // ================================

    function processDepositRequest(uint256 requestId) 
        external 
        onlyOwner 
        validRequestId(requestId)
    {
        VaultDepositRequest storage request = _depositRequests[requestId];
        if (request.state != IBasketVaultERC7540.RequestState.Pending) revert RequestNotPending();
        
        // Check if processing delay has passed
        if (block.timestamp < request.timestamp + processingDelay) {
            revert ProcessingDelayNotMet();
        }
        
        // Use ERC4626's conversion functions
        uint256 shares = _convertToShares(request.assets, Math.Rounding.Floor);
        request.shares = shares;
        request.state = IBasketVaultERC7540.RequestState.Claimable;
        
        emit RequestProcessed(requestId, true);
    }

    function processRedeemRequest(uint256 requestId) 
        external 
        onlyOwner 
        validRequestId(requestId)
    {
        VaultRedeemRequest storage request = _redeemRequests[requestId];
        if (request.state != IBasketVaultERC7540.RequestState.Pending) revert RequestNotPending();
        
        // Check if processing delay has passed
        if (block.timestamp < request.timestamp + processingDelay) {
            revert ProcessingDelayNotMet();
        }
        
        // Use ERC4626's conversion functions
        uint256 assets = _convertToAssets(request.shares, Math.Rounding.Floor);
        request.assets = assets;
        request.state = IBasketVaultERC7540.RequestState.Claimable;
        
        emit RequestProcessed(requestId, false);
    }

    function batchProcessRequests(uint256[] calldata depositRequestIds, uint256[] calldata redeemRequestIds)
        external
        onlyOwner
    {
        for (uint256 i = 0; i < depositRequestIds.length; i++) {
            uint256 requestId = depositRequestIds[i];
            VaultDepositRequest storage request = _depositRequests[requestId];
            if (request.state == IBasketVaultERC7540.RequestState.Pending && 
                block.timestamp >= request.timestamp + processingDelay) {
                
                uint256 shares = _convertToShares(request.assets, Math.Rounding.Floor);
                request.shares = shares;
                request.state = IBasketVaultERC7540.RequestState.Claimable;
                emit RequestProcessed(requestId, true);
            }
        }

        for (uint256 i = 0; i < redeemRequestIds.length; i++) {
            uint256 requestId = redeemRequestIds[i];
            VaultRedeemRequest storage request = _redeemRequests[requestId];
            if (request.state == IBasketVaultERC7540.RequestState.Pending && 
                block.timestamp >= request.timestamp + processingDelay) {
                
                uint256 assets = _convertToAssets(request.shares, Math.Rounding.Floor);
                request.assets = assets;
                request.state = IBasketVaultERC7540.RequestState.Claimable;
                emit RequestProcessed(requestId, false);
            }
        }
    }

    // ================================
    // CONFIGURATION FUNCTIONS
    // ================================

    function setProcessingDelay(uint256 newDelay) external onlyOwner {
        processingDelay = newDelay;
        emit ProcessingDelayUpdated(newDelay);
    }

    function authorizeToken(address token) external onlyOwner {
        if (token == address(0)) revert InvalidController();
        authorizedTokens[token] = true;
        emit TokenAuthorized(token);
    }

    function deauthorizeToken(address token) external onlyOwner {
        authorizedTokens[token] = false;
        emit TokenDeauthorized(token);
    }

    function emergencyPause() external onlyOwner {
        emergencyPaused = true;
        emit EmergencyPaused();
    }

    function emergencyUnpause() external onlyOwner {
        emergencyPaused = false;
        emit EmergencyUnpaused();
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================

    function getDepositRequest(uint256 requestId) 
        external 
        view 
        validRequestId(requestId)
        returns (VaultDepositRequest memory) 
    {
        return _depositRequests[requestId];
    }

    function getRedeemRequest(uint256 requestId) 
        external 
        view 
        validRequestId(requestId)
        returns (VaultRedeemRequest memory) 
    {
        return _redeemRequests[requestId];
    }

    function getControllerDepositRequests(address controller) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return _controllerDepositRequests[controller];
    }

    function getControllerRedeemRequests(address controller) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return _controllerRedeemRequests[controller];
    }

    function getNextRequestId() external view returns (uint256) {
        return _requestIdCounter;
    }

    // ================================
    // IERC165 SUPPORT
    // ================================

    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return interfaceId == type(IBasketVaultERC7540).interfaceId ||
               interfaceId == type(IERC165).interfaceId;
    }

    // ================================
    // ERC7575 SHARE FUNCTION
    // ================================

    /// @notice Returns the address of the share token (this contract)
    function share() external view returns (address) {
        return address(this);
    }
}