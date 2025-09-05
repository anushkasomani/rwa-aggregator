// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title MultiAssetVault
 * @dev Vault that holds multiple assets based on moving average strategies
 * @notice Manages USDC deposits, asset deployment, and share redemptions
 */
contract MultiAssetVault is ERC20, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ================================
    // STRUCTS
    // ================================

    struct DepositRequest {
        address user;
        uint256 usdcAmount;
        uint256 timestamp;
        uint256 requestId;
    }

    struct RedemptionRequest {
        address user;
        uint256 shareAmount;
        uint256 timestamp;
        uint256 requestId;
    }

    struct AssetAllocation {
        address asset;
        uint256 weight;      // Weight in basis points (10000 = 100%)
        uint256 balance;     // Current deployed balance
        bool isActive;       // Whether asset is currently held
    }

    // ================================
    // STATE VARIABLES
    // ================================

    // Core dependencies
    IERC20 public immutable baseToken;           // USDC
    address public immutable orderRouter;        // Router for swaps
    address public immutable oracleAggregator;   // Price oracle

    // Queue management
    DepositRequest[] public depositQueue;
    RedemptionRequest[] public redemptionQueue;
    uint256 public nextDepositId;
    uint256 public nextRedemptionId;
    uint256 public depositQueueIndex;       // Index of next deposit to process
    uint256 public redemptionQueueIndex;    // Index of next redemption to process

    // Capital management
    uint256 public pendingUSDC;             // USDC waiting for deployment
    uint256 public deployedUSDC;            // Value of deployed assets in USDC
    mapping(address => AssetAllocation) public assetAllocations;
    address[] public basketAssets;

    // NAV and pricing
    uint256 public lastNavPerShare;         // NAV per share in USDC (scaled by 1e18)
    uint256 public lastNavUpdate;           // Timestamp of last NAV update
    uint256 public constant NAV_SCALE = 1e18;
    uint256 public constant MIN_INITIAL_SHARES = 1000;  // Min shares on first deposit

    // Configuration
    uint256 public maxQueueSize = 100;
    uint256 public minDepositAmount = 10 * 1e6;    // 10 USDC minimum
    uint256 public minRedemptionShares = 1e15;     // 0.001 shares minimum

    // ================================
    // EVENTS
    // ================================

    event DepositQueued(
        address indexed user,
        uint256 amount,
        uint256 requestId
    );

    event RedemptionQueued(
        address indexed user,
        uint256 shares,
        uint256 requestId
    );

    event DepositsProcessed(
        uint256 processedCount,
        uint256 totalUSDC,
        uint256 sharesMinted
    );

    event RedemptionsProcessed(
        uint256 processedCount,
        uint256 totalShares,
        uint256 usdcReturned
    );

    event CapitalDeployed(
        address indexed asset,
        uint256 usdcAmount,
        uint256 assetAmount
    );

    event AssetLiquidated(
        address indexed asset,
        uint256 assetAmount,
        uint256 usdcReceived
    );

    event NAVUpdated(
        uint256 totalValue,
        uint256 navPerShare,
        uint256 timestamp
    );

    event BasketInitialized(
        address[] assets,
        uint256[] weights
    );

    // ================================
    // ERRORS
    // ================================

    error InvalidAmount();
    error InvalidAddress();
    error QueueFull();
    error NoDepositsToProcess();
    error NoRedemptionsToProcess();
    error InsufficientLiquidity();
    error AssetNotInBasket();
    error AlreadyInitialized();
    error NotInitialized();
    error Unauthorized();
    error StaleNAV();
    error ZeroShares();

    // ================================
    // MODIFIERS
    // ================================

    modifier onlyBot() {
        if (msg.sender != owner()) revert Unauthorized();
        _;
    }

    modifier navUpdated() {
        if (block.timestamp - lastNavUpdate > 1 hours) revert StaleNAV();
        _;
    }

    // ================================
    // CONSTRUCTOR
    // ================================

    constructor(
        address _baseToken,
        string memory _name,
        string memory _symbol,
        address _orderRouter,
        address _oracleAggregator
    ) ERC20(_name, _symbol) Ownable(msg.sender) {
        if (_baseToken == address(0)) revert InvalidAddress();
        if (_orderRouter == address(0)) revert InvalidAddress();
        if (_oracleAggregator == address(0)) revert InvalidAddress();

        baseToken = IERC20(_baseToken);
        orderRouter = _orderRouter;
        oracleAggregator = _oracleAggregator;
        
        // Initialize NAV at 1 USDC per share
        lastNavPerShare = NAV_SCALE;
        lastNavUpdate = block.timestamp;
    }

    // ================================
    // INITIALIZATION
    // ================================

    /**
     * @dev Initialize basket composition (called by factory)
     * @param assets Array of asset addresses
     * @param weights Array of weights in basis points (must sum to 10000)
     */
    function initializeBasket(
        address[] calldata assets,
        uint256[] calldata weights
    ) external onlyOwner {
        if (basketAssets.length > 0) revert AlreadyInitialized();
        if (assets.length != weights.length) revert InvalidAmount();

        uint256 totalWeight = 0;
        for (uint256 i = 0; i < assets.length; i++) {
            if (assets[i] == address(0)) revert InvalidAddress();
            
            assetAllocations[assets[i]] = AssetAllocation({
                asset: assets[i],
                weight: weights[i],
                balance: 0,
                isActive: false
            });
            
            basketAssets.push(assets[i]);
            totalWeight += weights[i];
        }

        if (totalWeight != 10000) revert InvalidAmount();

        emit BasketInitialized(assets, weights);
    }

    // ================================
    // USER FUNCTIONS
    // ================================

    /**
     * @dev Queue a deposit request
     * @param usdcAmount Amount of USDC to deposit
     */
    function deposit(uint256 usdcAmount) external whenNotPaused nonReentrant {
        if (usdcAmount < minDepositAmount) revert InvalidAmount();
        if (depositQueue.length - depositQueueIndex >= maxQueueSize) revert QueueFull();

        // Transfer USDC from user
        baseToken.safeTransferFrom(msg.sender, address(this), usdcAmount);

        // Add to pending capital
        pendingUSDC += usdcAmount;

        // Queue the request
        uint256 requestId = nextDepositId++;
        depositQueue.push(DepositRequest({
            user: msg.sender,
            usdcAmount: usdcAmount,
            timestamp: block.timestamp,
            requestId: requestId
        }));

        emit DepositQueued(msg.sender, usdcAmount, requestId);
    }

    /**
     * @dev Queue a redemption request
     * @param shareAmount Amount of shares to redeem
     */
    function requestRedemption(uint256 shareAmount) external whenNotPaused nonReentrant {
        if (shareAmount < minRedemptionShares) revert InvalidAmount();
        if (balanceOf(msg.sender) < shareAmount) revert InvalidAmount();
        if (redemptionQueue.length - redemptionQueueIndex >= maxQueueSize) revert QueueFull();

        // Transfer shares from user to vault
        _transfer(msg.sender, address(this), shareAmount);

        // Queue the request
        uint256 requestId = nextRedemptionId++;
        redemptionQueue.push(RedemptionRequest({
            user: msg.sender,
            shareAmount: shareAmount,
            timestamp: block.timestamp,
            requestId: requestId
        }));

        emit RedemptionQueued(msg.sender, shareAmount, requestId);
    }

    // ================================
    // BOT FUNCTIONS - QUEUE PROCESSING
    // ================================

    /**
     * @dev Process pending deposits in queue
     */
    function processDepositQueue() external onlyBot navUpdated {
        uint256 toProcess = _min(maxQueueSize, depositQueue.length - depositQueueIndex);
        if (toProcess == 0) revert NoDepositsToProcess();

        uint256 totalUSDC = 0;
        uint256 startIndex = depositQueueIndex;

        // Calculate total USDC to process
        for (uint256 i = 0; i < toProcess; i++) {
            totalUSDC += depositQueue[startIndex + i].usdcAmount;
        }

        // Calculate shares to mint based on current NAV
        uint256 sharesToMint = _calculateSharesForUSDC(totalUSDC);
        if (sharesToMint == 0) revert ZeroShares();

        // Mint shares to users
        for (uint256 i = 0; i < toProcess; i++) {
            DepositRequest memory request = depositQueue[startIndex + i];
            uint256 userShares = (sharesToMint * request.usdcAmount) / totalUSDC;
            
            if (userShares > 0) {
                _mint(request.user, userShares);
            }
        }

        depositQueueIndex += toProcess;

        emit DepositsProcessed(toProcess, totalUSDC, sharesToMint);
    }

    /**
     * @dev Process pending redemptions in queue
     */
    function processRedemptionQueue() external onlyBot navUpdated {
        uint256 toProcess = _min(maxQueueSize, redemptionQueue.length - redemptionQueueIndex);
        if (toProcess == 0) revert NoRedemptionsToProcess();

        uint256 totalShares = 0;
        uint256 startIndex = redemptionQueueIndex;

        // Calculate total shares to redeem
        for (uint256 i = 0; i < toProcess; i++) {
            totalShares += redemptionQueue[startIndex + i].shareAmount;
        }

        // Calculate USDC value based on current NAV
        uint256 totalUSDC = _calculateUSDCForShares(totalShares);
        
        // Ensure we have enough liquidity
        uint256 availableUSDC = baseToken.balanceOf(address(this));
        if (availableUSDC < totalUSDC) revert InsufficientLiquidity();

        // Burn shares and distribute USDC
        for (uint256 i = 0; i < toProcess; i++) {
            RedemptionRequest memory request = redemptionQueue[startIndex + i];
            uint256 userUSDC = (totalUSDC * request.shareAmount) / totalShares;
            
            if (userUSDC > 0) {
                _burn(address(this), request.shareAmount);
                baseToken.safeTransfer(request.user, userUSDC);
                
                // Update pending USDC
                if (userUSDC <= pendingUSDC) {
                    pendingUSDC -= userUSDC;
                }
            }
        }

        redemptionQueueIndex += toProcess;

        emit RedemptionsProcessed(toProcess, totalShares, totalUSDC);
    }

    // ================================
    // BOT FUNCTIONS - CAPITAL MANAGEMENT
    // ================================

    /**
     * @dev Deploy pending USDC to buy a specific asset
     * @param asset Address of asset to buy
     * @param usdcAmount Amount of USDC to deploy
     * @param minAssetAmount Minimum amount of asset to receive
     */
    function deployCapital(
        address asset,
        uint256 usdcAmount,
        uint256 minAssetAmount
    ) external onlyBot whenNotPaused returns (uint256 assetAmount) {
        AssetAllocation storage allocation = assetAllocations[asset];
        if (allocation.weight == 0) revert AssetNotInBasket();
        if (usdcAmount > pendingUSDC) revert InvalidAmount();

        // Approve OrderRouter to spend USDC
        baseToken.safeIncreaseAllowance(orderRouter, usdcAmount);

        // Execute swap through OrderRouter
        IOrderRouter(orderRouter).swapBaseToAsset(
            asset,
            usdcAmount,
            minAssetAmount,
            block.timestamp + 300  // 5 minute deadline
        );

        // Update balances
        assetAmount = IERC20(asset).balanceOf(address(this)) - allocation.balance;
        allocation.balance += assetAmount;
        allocation.isActive = true;
        
        pendingUSDC -= usdcAmount;
        deployedUSDC += usdcAmount;  // Track deployed value

        emit CapitalDeployed(asset, usdcAmount, assetAmount);
    }

    /**
     * @dev Liquidate an asset position back to USDC
     * @param asset Address of asset to sell
     * @param assetAmount Amount of asset to sell (0 for all)
     * @param minUSDC Minimum USDC to receive
     */
    function liquidateAsset(
        address asset,
        uint256 assetAmount,
        uint256 minUSDC
    ) external onlyBot returns (uint256 usdcReceived) {
        AssetAllocation storage allocation = assetAllocations[asset];
        if (allocation.weight == 0) revert AssetNotInBasket();
        
        // Use full balance if amount is 0
        if (assetAmount == 0) {
            assetAmount = allocation.balance;
        }
        if (assetAmount > allocation.balance) revert InvalidAmount();

        // Approve OrderRouter to spend asset
        IERC20(asset).safeIncreaseAllowance(orderRouter, assetAmount);

        // Execute swap through OrderRouter
        uint256 usdcBefore = baseToken.balanceOf(address(this));
        IOrderRouter(orderRouter).swapAssetToBase(
            asset,
            assetAmount,
            minUSDC,
            block.timestamp + 300
        );
        usdcReceived = baseToken.balanceOf(address(this)) - usdcBefore;

        // Update balances
        allocation.balance -= assetAmount;
        if (allocation.balance == 0) {
            allocation.isActive = false;
        }
        
        pendingUSDC += usdcReceived;
        deployedUSDC = deployedUSDC > usdcReceived ? deployedUSDC - usdcReceived : 0;

        emit AssetLiquidated(asset, assetAmount, usdcReceived);
    }

    /**
     * @dev Update NAV based on current portfolio value
     * @param assetPrices Array of asset prices in USDC (scaled to 1e6)
     */
    function updateNAV(uint256[] calldata assetPrices) external onlyBot {
        if (assetPrices.length != basketAssets.length) revert InvalidAmount();
        
        // Calculate total portfolio value
        uint256 totalValue = pendingUSDC;
        
        for (uint256 i = 0; i < basketAssets.length; i++) {
            AssetAllocation memory allocation = assetAllocations[basketAssets[i]];
            if (allocation.balance > 0) {
                // Convert asset balance to USDC value
                // Assuming assetPrices are in USDC per token with 1e6 scale
                totalValue += (allocation.balance * assetPrices[i]) / 1e18;
            }
        }

        // Calculate NAV per share
        uint256 totalShares = totalSupply();
        if (totalShares > 0) {
            lastNavPerShare = (totalValue * NAV_SCALE) / totalShares;
        } else {
            lastNavPerShare = NAV_SCALE;  // Reset to 1:1 if no shares
        }
        
        lastNavUpdate = block.timestamp;

        emit NAVUpdated(totalValue, lastNavPerShare, block.timestamp);
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================

    /**
     * @dev Get current total value of the vault in USDC
     */
    function getTotalValue() external view returns (uint256) {
        // This is an estimate - actual value requires price updates
        return pendingUSDC + deployedUSDC;
    }

    /**
     * @dev Get pending deposit queue size
     */
    function getPendingDeposits() external view returns (uint256) {
        return depositQueue.length - depositQueueIndex;
    }

    /**
     * @dev Get pending redemption queue size
     */
    function getPendingRedemptions() external view returns (uint256) {
        return redemptionQueue.length - redemptionQueueIndex;
    }

    /**
     * @dev Get asset allocation details
     */
    function getAssetAllocation(address asset) external view returns (
        uint256 weight,
        uint256 balance,
        bool isActive
    ) {
        AssetAllocation memory allocation = assetAllocations[asset];
        return (allocation.weight, allocation.balance, allocation.isActive);
    }
    
    /**
     * @dev Get all basket assets
     */
    function getBasketAssets() external view returns (address[] memory) {
        return basketAssets;
    }

    // ================================
    // INTERNAL FUNCTIONS
    // ================================

    function _calculateSharesForUSDC(uint256 usdcAmount) internal view returns (uint256) {
        uint256 totalShares = totalSupply();
        
        if (totalShares == 0) {
            // First deposit - ensure minimum shares
            return _max(usdcAmount * NAV_SCALE / 1e6, MIN_INITIAL_SHARES);
        }
        
        return (usdcAmount * NAV_SCALE) / lastNavPerShare;
    }

    function _calculateUSDCForShares(uint256 shareAmount) internal view returns (uint256) {
        return (shareAmount * lastNavPerShare) / NAV_SCALE;
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function _max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }

    // ================================
    // ADMIN FUNCTIONS
    // ================================

    /**
     * @dev Pause vault operations
     */
    function pause() external onlyBot {
        _pause();
    }

    /**
     * @dev Unpause vault operations
     */
    function unpause() external onlyBot {
        _unpause();
    }

    /**
     * @dev Update configuration parameters
     */
    function setConfig(
        uint256 _maxQueueSize,
        uint256 _minDepositAmount,
        uint256 _minRedemptionShares
    ) external onlyOwner {
        maxQueueSize = _maxQueueSize;
        minDepositAmount = _minDepositAmount;
        minRedemptionShares = _minRedemptionShares;
    }

    /**
     * @dev Emergency withdrawal of stuck tokens
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(baseToken)) {
            baseToken.safeTransfer(owner(), amount);
        } else {
            IERC20(token).safeTransfer(owner(), amount);
        }
    }
}

// Interface for OrderRouter
interface IOrderRouter {
    function swapBaseToAsset(
        address targetAsset,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external returns (uint256 amountOut);

    function swapAssetToBase(
        address sourceAsset,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external returns (uint256 amountOut);
}