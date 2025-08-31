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
import "../interfaces/IMultiVaultTracker.sol";
import "../interfaces/IBasketVaultERC7540.sol";

/**
 * @title BasketVaultERC7540
 * @dev ERC-7540 compliant asynchronous tokenized vault for basket assets
 * @notice Implements ERC-4626 + ERC-7540 with asynchronous deposit/redeem functionality
 * @author RWA Aggregator Team
 */
contract BasketVaultERC7540 is ERC4626, IBasketVaultERC7540, Ownable, ReentrancyGuard, IERC165 {
    using SafeERC20 for IERC20;
    using Math for uint256;

    // ================================
    // ERRORS
    // ================================
    error InvalidTrackerAddress();
    error VaultTrackerNotSet();
    error AsyncProcessingRequired();

    // ================================
    // STATE VARIABLES
    // ================================

    /// @notice Vault tracker to record user deposits across multiple vaults
    IMultiVaultTracker public vaultTracker;

    /// @notice Request ID counter
    uint256 private _requestIdCounter;

    /// @notice Mapping from controller to operator approval status
    mapping(address => mapping(address => bool)) private _operators;

    /// @notice Deposit requests array
    VaultDepositRequest[] private _depositRequests;

    /// @notice Redeem requests array
    VaultRedeemRequest[] private _redeemRequests;

    /// @notice Mapping from controller to their deposit request IDs
    mapping(address => uint256[]) private _controllerDepositRequests;

    /// @notice Mapping from controller to their redeem request IDs
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
        if (controller != msg.sender && !isOperator(controller, msg.sender)) revert NotControllerOrOperator();
        _;
    }

    // ================================
    // CONSTRUCTOR
    // ================================

    constructor(
        IERC20 asset_,
        string memory name_,
        string memory symbol_
    ) ERC4626(asset_) ERC20(name_, symbol_) Ownable(msg.sender) {
        // Authorize the asset token by default
        authorizedTokens[address(asset_)] = true;
        emit TokenAuthorized(address(asset_));
    }

    // ================================
    // MULTI TRACKER FUNCTIONS
    // ================================

    /**
     * @notice Set the vault tracker for tracking user positions across multiple vaults
     * @param tracker Address of the tracker contract
     */
    function setVaultTracker(address tracker) external onlyOwner {
        if (tracker == address(0)) revert InvalidTrackerAddress();
        vaultTracker = IMultiVaultTracker(tracker);
    }

    /**
     * @dev Tracks user deposit in the vault tracker
     * @param user Address of the user who owns the shares
     * @param shares Amount of shares to track
     */
    function _trackDeposit(address user, uint256 shares) internal {
        if (address(vaultTracker) == address(0)) return;
        vaultTracker.trackDeposit(user, address(this), shares);
    }

    /**
     * @dev Tracks user withdrawal in the vault tracker
     * @param user Address of the user who owns the shares
     * @param shares Amount of shares to track as withdrawn
     */
    function _trackWithdrawal(address user, uint256 shares) internal {
        if (address(vaultTracker) == address(0)) return;
        vaultTracker.trackWithdrawal(user, address(this), shares);
    }

    // ================================
    // ERC-4626 OVERRIDES
    // ================================

    /**
     * @dev Override deposit to add pause check and tracking
     */
    function deposit(
        uint256 assets,
        address receiver
    ) public override(ERC4626, IERC4626) nonReentrant notPaused returns (uint256 shares) {
        // Use standard ERC4626 deposit
        shares = super.deposit(assets, receiver);

        // Track the deposit
        _trackDeposit(receiver, shares);

        return shares;
    }

    /**
     * @dev Override mint to add pause check and tracking
     */
    function mint(
        uint256 shares,
        address receiver
    ) public override(ERC4626, IERC4626) nonReentrant notPaused returns (uint256 assets) {
        // Use standard ERC4626 mint
        assets = super.mint(shares, receiver);

        // Track the mint operation
        _trackDeposit(receiver, shares);

        return assets;
    }

    /**
     * @dev Override withdraw to add pause check and tracking
     */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override(ERC4626, IERC4626) nonReentrant notPaused returns (uint256 shares) {
        // Use standard ERC4626 withdraw
        shares = super.withdraw(assets, receiver, owner);

        // Track the withdrawal
        _trackWithdrawal(owner, shares);

        return shares;
    }

    /**
     * @dev Override redeem to add pause check and tracking
     */
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public override(ERC4626, IERC4626) nonReentrant notPaused returns (uint256 assets) {
        // Use standard ERC4626 redeem
        assets = super.redeem(shares, receiver, owner);

        // Track the redemption
        _trackWithdrawal(owner, shares);

        return assets;
    }

    /**
     * @dev Override maxDeposit to implement emergency pause functionality
     */

    function maxDeposit(address) public view override(ERC4626, IERC4626) returns (uint256) {
        return emergencyPaused ? 0 : type(uint256).max;
    }

    /**
     * @dev Override maxMint to implement emergency pause functionality
     */
    function maxMint(address) public view override(ERC4626, IERC4626) returns (uint256) {
        return emergencyPaused ? 0 : type(uint256).max;
    }

    /**
     * @dev Override maxWithdraw to implement emergency pause functionality
     */
    function maxWithdraw(address owner) public view override(ERC4626, IERC4626) returns (uint256) {
        if (emergencyPaused) return 0;
        return _convertToAssets(balanceOf(owner), Math.Rounding.Floor);
    }

    /**
     * @dev Override maxRedeem to implement emergency pause functionality
     */
    function maxRedeem(address owner) public view override(ERC4626, IERC4626) returns (uint256) {
        if (emergencyPaused) return 0;
        return balanceOf(owner);
    }

    // ================================
    // ERC-7540 ASYNCHRONOUS REQUEST OPERATIONS
    // ================================

    /**
     * @notice Request an asynchronous deposit
     * @param assets Amount of assets to deposit
     * @param controller Address of the controller
     * @param owner Address that will own the shares
     * @return requestId The ID of the deposit request
     */
    function requestDeposit(
        uint256 assets,
        address controller,
        address owner
    ) external nonReentrant notPaused returns (uint256 requestId) {
        if (assets == 0) revert InvalidAssets();
        if (controller == address(0)) revert InvalidController();
        if (owner == address(0)) revert InvalidOwner();

        // Create new request ID
        requestId = _requestIdCounter++;

        // Transfer assets to vault
        IERC20(asset()).safeTransferFrom(msg.sender, address(this), assets);

        // Create deposit request
        VaultDepositRequest memory request = VaultDepositRequest({
            owner: owner,
            controller: controller,
            assets: assets,
            shares: 0, // Will be calculated when processed
            state: RequestState.Pending,
            timestamp: block.timestamp
        });

        // Store request
        _depositRequests.push(request);

        // Track request for controller
        _controllerDepositRequests[controller].push(requestId);

        emit DepositRequest(controller, owner, requestId, msg.sender, assets);
        return requestId;
    }

    /**
     * @notice Request an asynchronous redemption
     * @param shares Amount of shares to redeem
     * @param controller Address of the controller
     * @param owner Address that owns the shares
     * @return requestId The ID of the redeem request
     */
    function requestRedeem(
        uint256 shares,
        address controller,
        address owner
    ) external nonReentrant notPaused returns (uint256 requestId) {
        if (shares == 0) revert InvalidShares();
        if (controller == address(0)) revert InvalidController();
        if (owner != msg.sender && allowance(owner, msg.sender) < shares) revert InsufficientBalance();

        // Create new request ID
        requestId = _requestIdCounter++;

        // Transfer shares from owner to vault
        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }
        _transfer(owner, address(this), shares);

        // Create redeem request
        VaultRedeemRequest memory request = VaultRedeemRequest({
            owner: owner,
            controller: controller,
            shares: shares,
            assets: 0, // Will be calculated when processed
            state: RequestState.Pending,
            timestamp: block.timestamp
        });

        // Store request
        _redeemRequests.push(request);

        // Track request for controller
        _controllerRedeemRequests[controller].push(requestId);

        emit RedeemRequest(controller, owner, requestId, msg.sender, shares);
        return requestId;
    }

    // ================================
    // ERC-7540 REQUEST INFO FUNCTIONS
    // ================================

    /**
     * @notice Get the pending assets from a deposit request
     * @param requestId The request ID
     * @param controller The controller address
     * @return pendingAssets Amount of pending assets
     */
    function pendingDepositRequest(
        uint256 requestId,
        address controller
    ) external view returns (uint256 pendingAssets) {
        if (requestId >= _depositRequests.length) revert InvalidRequestId();

        VaultDepositRequest storage request = _depositRequests[requestId];
        if (request.controller != controller || request.state != RequestState.Pending) {
            return 0;
        }
        return request.assets;
    }

    /**
     * @notice Get the claimable assets from a deposit request
     * @param requestId The request ID
     * @param controller The controller address
     * @return claimableAssets Amount of claimable assets
     */
    function claimableDepositRequest(
        uint256 requestId,
        address controller
    ) external view returns (uint256 claimableAssets) {
        if (requestId >= _depositRequests.length) revert InvalidRequestId();

        VaultDepositRequest storage request = _depositRequests[requestId];
        if (request.controller != controller || request.state != RequestState.Claimable) {
            return 0;
        }
        return request.assets;
    }

    /**
     * @notice Get the pending shares from a redeem request
     * @param requestId The request ID
     * @param controller The controller address
     * @return pendingShares Amount of pending shares
     */
    function pendingRedeemRequest(uint256 requestId, address controller) external view returns (uint256 pendingShares) {
        if (requestId >= _redeemRequests.length) revert InvalidRequestId();

        VaultRedeemRequest storage request = _redeemRequests[requestId];
        if (request.controller != controller || request.state != RequestState.Pending) {
            return 0;
        }
        return request.shares;
    }

    /**
     * @notice Get the claimable shares from a redeem request
     * @param requestId The request ID
     * @param controller The controller address
     * @return claimableShares Amount of claimable shares
     */
    function claimableRedeemRequest(
        uint256 requestId,
        address controller
    ) external view returns (uint256 claimableShares) {
        if (requestId >= _redeemRequests.length) revert InvalidRequestId();

        VaultRedeemRequest storage request = _redeemRequests[requestId];
        if (request.controller != controller || request.state != RequestState.Claimable) {
            return 0;
        }
        return request.shares;
    }

    // ================================
    // ERC-7540 CLAIM OPERATIONS
    // ================================

    /**
     * @notice Implement the ERC-7540 deposit function with controller
     * @param assets Amount of assets to deposit
     * @param receiver Address to receive the shares
     * @param controller Address of the controller
     * @return shares Amount of shares minted
     */
    function deposit(
        uint256 assets,
        address receiver,
        address controller
    )
        external
        override(IBasketVaultERC7540)
        notPaused
        nonReentrant
        onlyControllerOrOperator(controller)
        returns (uint256 shares)
    {
        // First look for a claimable deposit request
        uint256 requestId = _findClaimableDepositRequest(controller, assets);

        if (requestId != type(uint256).max) {
            // Claim from request
            VaultDepositRequest storage request = _depositRequests[requestId];
            shares = request.shares;
            request.state = RequestState.Claimed;

            // Mint shares to receiver
            _mint(receiver, shares);

            // Track the deposit
            _trackDeposit(receiver, shares);

            emit Deposit(msg.sender, receiver, assets, shares);
        } else {
            // No matching request, do a direct deposit
            IERC20(asset()).safeTransferFrom(msg.sender, address(this), assets);
            // Use ERC4626 preview to handle initial-deposit semantics
            shares = previewDeposit(assets);

            // Mint shares to receiver
            _mint(receiver, shares);

            // Track the deposit
            _trackDeposit(receiver, shares);

            emit Deposit(msg.sender, receiver, assets, shares);
        }

        return shares;
    }

    /**
     * @notice Implement the ERC-7540 mint function with controller
     * @param shares Amount of shares to mint
     * @param receiver Address to receive the shares
     * @param controller Address of the controller
     * @return assets Amount of assets deposited
     */
    function mint(
        uint256 shares,
        address receiver,
        address controller
    )
        external
        override(IBasketVaultERC7540)
        notPaused
        nonReentrant
        onlyControllerOrOperator(controller)
        returns (uint256 assets)
    {
        // First look for a claimable deposit request with matching shares
        uint256 requestId = _findClaimableDepositRequestByShares(controller, shares);

        if (requestId != type(uint256).max) {
            // Claim from request
            VaultDepositRequest storage request = _depositRequests[requestId];
            assets = request.assets;
            request.state = RequestState.Claimed;

            // Mint shares to receiver
            _mint(receiver, shares);

            // Track the mint
            _trackDeposit(receiver, shares);

            emit Deposit(msg.sender, receiver, assets, shares);
        } else {
            // No matching request, do a direct mint
            // Use ERC4626 preview to get required assets for minting shares
            assets = previewMint(shares);

            // Transfer assets from sender
            IERC20(asset()).safeTransferFrom(msg.sender, address(this), assets);

            // Mint shares to receiver
            _mint(receiver, shares);

            // Track the mint
            _trackDeposit(receiver, shares);

            emit Deposit(msg.sender, receiver, assets, shares);
        }

        return assets;
    }

    /**
     * @notice Implement the ERC-7540 withdraw function with controller
     * @param assets Amount of assets to withdraw
     * @param receiver Address to receive the assets
     * @param controller Address of the controller
     * @return shares Amount of shares burned
     */
    function withdrawWithController(
        uint256 assets,
        address receiver,
        address controller
    ) public notPaused nonReentrant onlyControllerOrOperator(controller) returns (uint256 shares) {
        // First look for a claimable redeem request with matching assets
        uint256 requestId = _findClaimableRedeemRequestByAssets(controller, assets);

        if (requestId != type(uint256).max) {
            // Claim from request
            VaultRedeemRequest storage request = _redeemRequests[requestId];
            shares = request.shares;
            request.state = RequestState.Claimed;

            // Transfer assets to receiver
            IERC20(asset()).safeTransfer(receiver, assets);

            // Track the withdrawal
            _trackWithdrawal(request.owner, shares);

            emit Withdraw(msg.sender, receiver, request.owner, assets, shares);
        } else {
            // No matching request, do a direct withdraw
            address owner = msg.sender;
            // Use ERC4626 preview to compute shares to burn for given assets
            shares = previewWithdraw(assets);

            // Handle allowance if needed
            if (msg.sender != owner) {
                _spendAllowance(owner, msg.sender, shares);
            }

            // Burn shares
            _burn(owner, shares);

            // Transfer assets to receiver
            IERC20(asset()).safeTransfer(receiver, assets);

            // Track the withdrawal
            _trackWithdrawal(owner, shares);

            emit Withdraw(msg.sender, receiver, owner, assets, shares);
        }

        return shares;
    }

    /**
     * @notice Implement the ERC-7540 redeem function with controller
     * @param shares Amount of shares to redeem
     * @param receiver Address to receive the assets
     * @param controller Address of the controller
     * @return assets Amount of assets withdrawn
     */
    function redeemWithController(
        uint256 shares,
        address receiver,
        address controller
    ) public notPaused nonReentrant onlyControllerOrOperator(controller) returns (uint256 assets) {
        // First look for a claimable redeem request with matching shares
        uint256 requestId = _findClaimableRedeemRequestByShares(controller, shares);

        if (requestId != type(uint256).max) {
            // Claim from request
            VaultRedeemRequest storage request = _redeemRequests[requestId];
            assets = request.assets;
            request.state = RequestState.Claimed;

            // Transfer assets to receiver
            IERC20(asset()).safeTransfer(receiver, assets);

            // Track the redemption
            _trackWithdrawal(request.owner, shares);

            emit Withdraw(msg.sender, receiver, request.owner, assets, shares);
        } else {
            // No matching request, do a direct redeem
            address owner = msg.sender;
            // Use ERC4626 preview to compute assets for given shares
            assets = previewRedeem(shares);

            // Handle allowance if needed
            if (msg.sender != owner) {
                _spendAllowance(owner, msg.sender, shares);
            }

            // Burn shares
            _burn(owner, shares);

            // Transfer assets to receiver
            IERC20(asset()).safeTransfer(receiver, assets);

            // Track the redemption
            _trackWithdrawal(owner, shares);

            emit Withdraw(msg.sender, receiver, owner, assets, shares);
        }

        return assets;
    }

    // ================================
    // OPERATOR MANAGEMENT
    // ================================

    /**
     * @notice Set an operator for a controller
     * @param operator Address of the operator
     * @param approved Approval status
     * @return success Whether the operation was successful
     */
    function setOperator(address operator, bool approved) external returns (bool) {
        _operators[msg.sender][operator] = approved;
        emit OperatorSet(msg.sender, operator, approved);
        return true;
    }

    /**
     * @notice Check if an address is an operator for a controller
     * @param controller Address of the controller
     * @param operator Address of the operator
     * @return status Whether the operator is approved
     */
    function isOperator(address controller, address operator) public view returns (bool status) {
        return _operators[controller][operator];
    }

    // ================================
    // INTERNAL HELPER FUNCTIONS
    // ================================

    /**
     * @dev Find a claimable deposit request by assets
     * @param controller The controller address
     * @param assets The assets amount
     * @return requestId The request ID or max uint256 if not found
     */
    function _findClaimableDepositRequest(address controller, uint256 assets) internal view returns (uint256) {
        uint256[] storage requests = _controllerDepositRequests[controller];
        for (uint256 i = 0; i < requests.length; i++) {
            uint256 requestId = requests[i];
            if (requestId < _depositRequests.length) {
                VaultDepositRequest storage request = _depositRequests[requestId];
                if (request.state == RequestState.Claimable && request.assets == assets) {
                    return requestId;
                }
            }
        }
        return type(uint256).max;
    }

    /**
     * @dev Find a claimable deposit request by shares
     * @param controller The controller address
     * @param shares The shares amount
     * @return requestId The request ID or max uint256 if not found
     */
    function _findClaimableDepositRequestByShares(address controller, uint256 shares) internal view returns (uint256) {
        uint256[] storage requests = _controllerDepositRequests[controller];
        for (uint256 i = 0; i < requests.length; i++) {
            uint256 requestId = requests[i];
            if (requestId < _depositRequests.length) {
                VaultDepositRequest storage request = _depositRequests[requestId];
                if (request.state == RequestState.Claimable && request.shares == shares) {
                    return requestId;
                }
            }
        }
        return type(uint256).max;
    }

    /**
     * @dev Find a claimable redeem request by assets
     * @param controller The controller address
     * @param assets The assets amount
     * @return requestId The request ID or max uint256 if not found
     */
    function _findClaimableRedeemRequestByAssets(address controller, uint256 assets) internal view returns (uint256) {
        uint256[] storage requests = _controllerRedeemRequests[controller];
        for (uint256 i = 0; i < requests.length; i++) {
            uint256 requestId = requests[i];
            if (requestId < _redeemRequests.length) {
                VaultRedeemRequest storage request = _redeemRequests[requestId];
                if (request.state == RequestState.Claimable && request.assets == assets) {
                    return requestId;
                }
            }
        }
        return type(uint256).max;
    }

    /**
     * @dev Find a claimable redeem request by shares
     * @param controller The controller address
     * @param shares The shares amount
     * @return requestId The request ID or max uint256 if not found
     */
    function _findClaimableRedeemRequestByShares(address controller, uint256 shares) internal view returns (uint256) {
        uint256[] storage requests = _controllerRedeemRequests[controller];
        for (uint256 i = 0; i < requests.length; i++) {
            uint256 requestId = requests[i];
            if (requestId < _redeemRequests.length) {
                VaultRedeemRequest storage request = _redeemRequests[requestId];
                if (request.state == RequestState.Claimable && request.shares == shares) {
                    return requestId;
                }
            }
        }
        return type(uint256).max;
    }

    // ================================
    // ADMIN FUNCTIONS
    // ================================

    /**
     * @notice Process a deposit request
     * @param requestId The request ID
     */
    function processDepositRequest(uint256 requestId) external onlyOwner {
        if (requestId >= _depositRequests.length) revert InvalidRequestId();

        VaultDepositRequest storage request = _depositRequests[requestId];
        if (request.state != RequestState.Pending) revert RequestNotPending();

        // Check if processing delay has passed
        if (block.timestamp < request.timestamp + processingDelay) {
            revert ProcessingDelayNotMet();
        }

        // Calculate shares based on current exchange rate.
        // If the vault is pre-funded (assets > 0) but has no shares yet, previewDeposit from OZ v5 returns 0.
        // To keep a sane initial rate (1:1), special-case first mint to equal assets.
        uint256 shares = totalSupply() == 0 ? request.assets : previewDeposit(request.assets);
        request.shares = shares;
        request.state = RequestState.Claimable;

        emit RequestProcessed(requestId, true);
    }

    /**
     * @notice Process a redeem request
     * @param requestId The request ID
     */
    function processRedeemRequest(uint256 requestId) external onlyOwner {
        if (requestId >= _redeemRequests.length) revert InvalidRequestId();

        VaultRedeemRequest storage request = _redeemRequests[requestId];
        if (request.state != RequestState.Pending) revert RequestNotPending();

        // Check if processing delay has passed
        if (block.timestamp < request.timestamp + processingDelay) {
            revert ProcessingDelayNotMet();
        }

        // Calculate assets based on current exchange rate
        // Use ERC4626 preview for consistent rounding
        uint256 assets = previewRedeem(request.shares);
        request.assets = assets;
        request.state = RequestState.Claimable;

        emit RequestProcessed(requestId, false);
    }

    /**
     * @notice Batch process multiple requests
     * @param depositRequestIds Array of deposit request IDs
     * @param redeemRequestIds Array of redeem request IDs
     */
    function batchProcessRequests(
        uint256[] calldata depositRequestIds,
        uint256[] calldata redeemRequestIds
    ) external onlyOwner {
        // Process deposit requests
        for (uint256 i = 0; i < depositRequestIds.length; i++) {
            uint256 requestId = depositRequestIds[i];
            if (requestId < _depositRequests.length) {
                VaultDepositRequest storage request = _depositRequests[requestId];
                if (request.state == RequestState.Pending && block.timestamp >= request.timestamp + processingDelay) {
                    uint256 shares = totalSupply() == 0 ? request.assets : previewDeposit(request.assets);
                    request.shares = shares;
                    request.state = RequestState.Claimable;
                    emit RequestProcessed(requestId, true);
                }
            }
        }

        // Process redeem requests
        for (uint256 i = 0; i < redeemRequestIds.length; i++) {
            uint256 requestId = redeemRequestIds[i];
            if (requestId < _redeemRequests.length) {
                VaultRedeemRequest storage request = _redeemRequests[requestId];
                if (request.state == RequestState.Pending && block.timestamp >= request.timestamp + processingDelay) {
                    uint256 assets = previewRedeem(request.shares);
                    request.assets = assets;
                    request.state = RequestState.Claimable;
                    emit RequestProcessed(requestId, false);
                }
            }
        }
    }

    // ================================
    // CONFIGURATION FUNCTIONS
    // ================================

    /**
     * @notice Set the processing delay for async operations
     * @param newDelay New delay in seconds
     */
    function setProcessingDelay(uint256 newDelay) external onlyOwner {
        processingDelay = newDelay;
        emit ProcessingDelayUpdated(newDelay);
    }

    /**
     * @notice Authorize a token for vault operations
     * @param token The token address to authorize
     */
    function authorizeToken(address token) external onlyOwner {
        if (token == address(0)) revert InvalidController();
        authorizedTokens[token] = true;
        emit TokenAuthorized(token);
    }

    /**
     * @notice Deauthorize a token from vault operations
     * @param token The token address to deauthorize
     */
    function deauthorizeToken(address token) external onlyOwner {
        authorizedTokens[token] = false;
        emit TokenDeauthorized(token);
    }

    /**
     * @notice Emergency pause all operations
     */
    function emergencyPause() external onlyOwner {
        emergencyPaused = true;
        emit EmergencyPaused();
    }

    /**
     * @notice Unpause operations
     */
    function emergencyUnpause() external onlyOwner {
        emergencyPaused = false;
        emit EmergencyUnpaused();
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================

    /**
     * @notice Get deposit request details
     * @param requestId The request ID
     * @return The deposit request struct
     */
    function getDepositRequest(uint256 requestId) external view returns (VaultDepositRequest memory) {
        if (requestId >= _depositRequests.length) revert InvalidRequestId();
        return _depositRequests[requestId];
    }

    /**
     * @notice Get redeem request details
     * @param requestId The request ID
     * @return The redeem request struct
     */
    function getRedeemRequest(uint256 requestId) external view returns (VaultRedeemRequest memory) {
        if (requestId >= _redeemRequests.length) revert InvalidRequestId();
        return _redeemRequests[requestId];
    }

    /**
     * @notice Get all deposit request IDs for a controller
     * @param controller The controller address
     * @return Array of deposit request IDs
     */
    function getControllerDepositRequests(address controller) external view returns (uint256[] memory) {
        return _controllerDepositRequests[controller];
    }

    /**
     * @notice Get all redeem request IDs for a controller
     * @param controller The controller address
     * @return Array of redeem request IDs
     */
    function getControllerRedeemRequests(address controller) external view returns (uint256[] memory) {
        return _controllerRedeemRequests[controller];
    }

    /**
     * @notice Get the next request ID that will be assigned
     * @return The next request ID
     */
    function getNextRequestId() external view returns (uint256) {
        return _requestIdCounter;
    }

    // ================================
    // IERC165 SUPPORT
    // ================================

    /**
     * @notice Check if the contract supports an interface
     * @param interfaceId The interface ID to check
     * @return True if the interface is supported
     */
    function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
        return interfaceId == type(IBasketVaultERC7540).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    // ================================
    // ERC7575 COMPATIBILITY
    // ================================

    /**
     * @notice Returns the address of the share token (this contract)
     * @return The address of this contract
     */
    function share() external view returns (address) {
        return address(this);
    }
}
