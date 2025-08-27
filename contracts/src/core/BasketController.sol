// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../security/EnhancedReentrancyGuard.sol";
import "../interfaces/IBasketController.sol";
import "../interfaces/IOrderRouter.sol";
import "../interfaces/IERC20Extended.sol";
import "./BasketToken.sol";
import "./BasketVault.sol";
import "../oracles/OracleAggregator.sol";

/**
 * @title BasketController with complete integration
 * @dev Core logic for basket operations with all components integrated
 */
contract BasketController is EnhancedReentrancyGuard, IBasketController {
    using SafeERC20 for IERC20;

    struct BasketInfo {
        address[] assets;
        uint256[] weights; // in basis points (10000 = 100%)
        uint256 totalWeights;
        uint256 lastRebalance;
        uint256 highWaterMark;
        bool isActive;
    }

    struct FeeConfig {
        uint256 entryFeeBps;
        uint256 exitFeeBps;
        uint256 performanceFeeBps;
        uint256 streamingFeeBps; // annual
        uint256 emergencyExitFeeBps;
    }

    BasketInfo public basketInfo;
    FeeConfig public feeConfig;
    
    BasketToken public immutable basketToken;
    BasketVault public immutable vault;
    address public immutable baseToken; // USDC
    OracleAggregator public immutable oracle;
    IOrderRouter public immutable orderRouter;
    
    mapping(address => uint256) public feeDebt;
    uint256 public accFeePerShare;
    uint256 public lastFeeUpdate;
    
    // Security controls
    address public securityCouncil;
    bool public emergencyPaused;
    uint256 public maxDepositAmount;
    uint256 public maxTotalSupply;
    
    // MEV protection - TODO: Implement time-delayed operations for large transactions
    // mapping(bytes32 => uint256) public pendingOperations;
    // uint256 public constant OPERATION_DELAY = 15 minutes;
    
    // Constants
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MIN_DEPOSIT = 100 * 1e6; // 100 USDC minimum
    uint256 public constant MAX_SLIPPAGE_BPS = 500; // 5% max slippage

    event Deposit(address indexed user, uint256 usdcAmount, uint256 sharesOut);
    event Withdrawal(address indexed user, uint256 sharesIn, uint256 usdcOut);
    event Rebalance(uint256 timestamp, address[] assets, uint256[] newWeights);
    event EmergencyPaused(string reason);
    event FeesCollected(address indexed user, uint256 amount);

    modifier onlySecurityCouncil() {
        require(msg.sender == securityCouncil, "Only security council");
        _;
    }

    modifier notPaused() {
        require(!emergencyPaused, "Emergency paused");
        _;
    }

    modifier withinLimits(uint256 amount) {
        require(amount >= MIN_DEPOSIT, "Below minimum deposit");
        require(amount <= maxDepositAmount, "Exceeds max deposit");
        // Check that minting new shares won't exceed max supply
        // This is approximate since we don't know exact shares to mint yet
        uint256 currentSupply = basketToken.totalSupply();
        if (currentSupply > 0) {
            uint256 currentNAV = calculateNAV();
            uint256 approxNewShares = (amount * currentSupply) / currentNAV;
            require(currentSupply + approxNewShares <= maxTotalSupply, "Exceeds max supply");
        }
        _;
    }

    constructor(
        address[] memory _assets,
        uint256[] memory _weights,
        address _baseToken,
        address _vault,
        address _oracle,
        address _securityCouncil,
        address _orderRouter,
        string memory _tokenName,
        string memory _tokenSymbol
    ) {
        require(_assets.length == _weights.length, "Length mismatch");
        require(_assets.length >= 3, "Minimum 3 assets required");
        require(_vault != address(0), "Invalid vault");
        require(_oracle != address(0), "Invalid oracle");
        require(_orderRouter != address(0), "Invalid router");

        // Validate weights sum to 10000
        uint256 totalWeights;
        for (uint256 i = 0; i < _weights.length; i++) {
            require(_weights[i] > 0, "Weight must be positive");
            totalWeights += _weights[i];
        }
        require(totalWeights == BASIS_POINTS, "Weights must sum to 10000");

        basketInfo = BasketInfo({
            assets: _assets,
            weights: _weights,
            totalWeights: totalWeights,
            lastRebalance: block.timestamp,
            highWaterMark: 1e18, // Start at 1:1 ratio
            isActive: true
        });

        feeConfig = FeeConfig({
            entryFeeBps: 10, // 0.1%
            exitFeeBps: 10, // 0.1%
            performanceFeeBps: 1500, // 15%
            streamingFeeBps: 95, // 0.95% annually
            emergencyExitFeeBps: 100 // 1%
        });

        baseToken = _baseToken;
        vault = BasketVault(_vault);
        oracle = OracleAggregator(_oracle);
        orderRouter = IOrderRouter(_orderRouter);
        securityCouncil = _securityCouncil;
        
        basketToken = new BasketToken(_tokenName, _tokenSymbol, address(this));
        
        maxDepositAmount = 100000 * 1e6; // 100k USDC
        maxTotalSupply = 10000000 * 1e18; // 10M basket tokens
        lastFeeUpdate = block.timestamp;
    }

    /**
     * @dev Deposit USDC and mint basket tokens with MEV protection
     */
    function depositAndMint(
        uint256 usdcAmount,
        uint256 minSharesOut,
        uint256 deadline
    ) external 
        nonReentrantOperation(ReentrancyState.MINTING)
        notPaused
        withinLimits(usdcAmount)
    {
        require(block.timestamp <= deadline, "Deadline exceeded");
        require(usdcAmount > 0, "Amount must be positive");

        // Update streaming fees before minting
        _updateStreamingFees();

        // Calculate shares to mint BEFORE taking user funds to prevent NAV manipulation
        uint256 currentNAV = calculateNAV();
        uint256 entryFee = (usdcAmount * feeConfig.entryFeeBps) / BASIS_POINTS;
        uint256 netAmount = usdcAmount - entryFee;
        uint256 sharesToMint;
        
        if (basketToken.totalSupply() == 0) {
            sharesToMint = netAmount * 1e12; // Convert from 6 decimals to 18 decimals (USDC to BasketToken)
        } else {
            sharesToMint = (netAmount * basketToken.totalSupply()) / currentNAV;
        }

        require(sharesToMint >= minSharesOut, "Insufficient shares out");

        // Transfer USDC from user
        IERC20(baseToken).safeTransferFrom(msg.sender, address(this), usdcAmount);

        // Distribute entry fee to existing holders
        if (basketToken.totalSupply() > 0 && entryFee > 0) {
            _distributeFee(entryFee);
        }

        // Execute trades to buy basket assets
        _executeBuyOrders(netAmount);

        // Mint basket tokens
        basketToken.mint(msg.sender, sharesToMint);

        emit Deposit(msg.sender, usdcAmount, sharesToMint);
    }

    /**
     * @dev Burn basket tokens and withdraw USDC
     */
    function redeemAndWithdraw(
        uint256 sharesIn,
        uint256 minUsdcOut,
        uint256 deadline
    ) external 
        nonReentrantOperation(ReentrancyState.REDEEMING)
        notPaused
    {
        require(block.timestamp <= deadline, "Deadline exceeded");
        require(sharesIn > 0, "Shares must be positive");
        require(basketToken.balanceOf(msg.sender) >= sharesIn, "Insufficient balance");

        // Update streaming fees
        _updateStreamingFees();

        // Calculate user's share of vault
        uint256 totalSupply = basketToken.totalSupply();
        uint256 userShareBps = (sharesIn * BASIS_POINTS) / totalSupply;

        // Burn shares first to prevent manipulation
        basketToken.burn(msg.sender, sharesIn);

        // Execute sell orders
        uint256 usdcReceived = _executeSellOrders(userShareBps);

        // Calculate performance fee if above high water mark
        uint256 currentNAV = calculateNAV();
        uint256 performanceFee = 0;
        
        if (currentNAV > basketInfo.highWaterMark) {
            uint256 profit = ((currentNAV - basketInfo.highWaterMark) * usdcReceived) / currentNAV;
            performanceFee = (profit * feeConfig.performanceFeeBps) / BASIS_POINTS;
            basketInfo.highWaterMark = currentNAV;
        }

        // Calculate exit fee
        uint256 exitFee = (usdcReceived * feeConfig.exitFeeBps) / BASIS_POINTS;
        uint256 totalFees = performanceFee + exitFee;
        uint256 netAmount = usdcReceived - totalFees;

        require(netAmount >= minUsdcOut, "Insufficient USDC out");

        // Distribute fees to remaining holders
        if (totalFees > 0) {
            _distributeFee(totalFees);
        }

        // Transfer USDC to user
        IERC20(baseToken).safeTransfer(msg.sender, netAmount);

        emit Withdrawal(msg.sender, sharesIn, netAmount);
    }

    /**
     * @dev Emergency pause function
     */
    function emergencyPause(string calldata reason) external onlySecurityCouncil {
        emergencyPaused = true;
        _activateEmergencyMode();
        emit EmergencyPaused(reason);
    }

    /**
     * @dev Calculate current NAV in base token terms
     */
    function calculateNAV() public view override returns (uint256) {
        uint256 totalValue = 0;
        
        for (uint256 i = 0; i < basketInfo.assets.length; i++) {
            address asset = basketInfo.assets[i];
            uint256 balance = vault.getTokenBalance(asset);
            
            if (balance > 0) {
                uint256 price = oracle.getPrice(asset);
                uint8 assetDecimals = IERC20Extended(asset).decimals();
                uint8 baseDecimals = IERC20Extended(baseToken).decimals();
                
                // Normalize to base token decimals
                uint256 normalizedBalance = balance;
                if (assetDecimals > baseDecimals) {
                    normalizedBalance = balance / (10 ** (assetDecimals - baseDecimals));
                } else if (baseDecimals > assetDecimals) {
                    normalizedBalance = balance * (10 ** (baseDecimals - assetDecimals));
                }
                
                totalValue += (normalizedBalance * price) / 1e18;
            }
        }
        
        // Add any remaining base token in vault (not controller)
        totalValue += vault.getTokenBalance(baseToken);
        
        return totalValue;
    }

    /**
     * @dev Execute buy orders for basket assets
     */
    function _executeBuyOrders(uint256 usdcAmount) internal {
        // Approve router to spend USDC
        IERC20(baseToken).forceApprove(address(orderRouter), usdcAmount);
        
        for (uint256 i = 0; i < basketInfo.assets.length; i++) {
            address asset = basketInfo.assets[i];
            uint256 weight = basketInfo.weights[i];
            uint256 assetAmount = (usdcAmount * weight) / BASIS_POINTS;
            
            if (assetAmount > 0) {
                // Calculate minimum amount out with slippage protection
                uint256 expectedOut = orderRouter.quote(baseToken, asset, assetAmount);
                uint256 minAmountOut = (expectedOut * (BASIS_POINTS - MAX_SLIPPAGE_BPS)) / BASIS_POINTS;
                
                try orderRouter.buy(
                    baseToken,
                    asset,
                    assetAmount,
                    minAmountOut,
                    address(vault)
                ) returns (uint256 /* amountOut */) {
                    // Success - tokens sent directly to vault
                } catch {
                    // If trade fails, keep USDC for manual intervention
                    // In production, implement more sophisticated error handling
                    revert("Buy order failed");
                }
            }
        }
    }

    /**
     * @dev Execute sell orders for basket assets
     */
    function _executeSellOrders(uint256 sharePercentageBps) internal returns (uint256 totalUsdcReceived) {
        totalUsdcReceived = 0;
        
        for (uint256 i = 0; i < basketInfo.assets.length; i++) {
            address asset = basketInfo.assets[i];
            uint256 assetBalance = vault.getTokenBalance(asset);
            
            if (assetBalance > 0) {
                uint256 amountToSell = (assetBalance * sharePercentageBps) / BASIS_POINTS;
                
                if (amountToSell > 0) {
                    // Withdraw from vault to this contract for trading
                    vault.pullToken(asset, amountToSell, address(this));
                    
                    // Approve router to spend asset
                    IERC20(asset).forceApprove(address(orderRouter), amountToSell);
                    
                    // Calculate minimum USDC out with slippage protection
                    uint256 expectedOut = orderRouter.quote(asset, baseToken, amountToSell);
                    uint256 minAmountOut = (expectedOut * (BASIS_POINTS - MAX_SLIPPAGE_BPS)) / BASIS_POINTS;
                    
                    try orderRouter.sell(
                        asset,
                        baseToken,
                        amountToSell,
                        minAmountOut,
                        address(this)
                    ) returns (uint256 usdcReceived) {
                        totalUsdcReceived += usdcReceived;
                    } catch {
                        // If trade fails, return asset to vault
                        IERC20(asset).safeTransfer(address(vault), amountToSell);
                        revert("Sell order failed");
                    }
                }
            }
        }
        
        // Add any USDC already in vault
        uint256 vaultUsdcBalance = vault.getTokenBalance(baseToken);
        if (vaultUsdcBalance > 0) {
            uint256 usdcToWithdraw = (vaultUsdcBalance * sharePercentageBps) / BASIS_POINTS;
            if (usdcToWithdraw > 0) {
                vault.pullToken(baseToken, usdcToWithdraw, address(this));
                totalUsdcReceived += usdcToWithdraw;
            }
        }
    }

    /**
     * @dev Update streaming fees
     */
    function _updateStreamingFees() internal {
        if (block.timestamp <= lastFeeUpdate) return;
        
        uint256 timeElapsed = block.timestamp - lastFeeUpdate;
        uint256 annualFeeBps = feeConfig.streamingFeeBps;
        uint256 feeAmount = (annualFeeBps * timeElapsed) / (365 days * BASIS_POINTS);
        
        if (feeAmount > 0 && basketToken.totalSupply() > 0) {
            // Update accumulated fee per share
            accFeePerShare += (feeAmount * 1e18) / basketToken.totalSupply();
        }
        
        lastFeeUpdate = block.timestamp;
    }

    /**
     * @dev Distribute fees to existing holders
     */
    function _distributeFee(uint256 feeAmount) internal {
        if (basketToken.totalSupply() > 0) {
            // Ensure contract has the USDC to distribute
            require(IERC20(baseToken).balanceOf(address(this)) >= feeAmount, "Insufficient fee balance");
            accFeePerShare += (feeAmount * 1e18) / basketToken.totalSupply();
        }
    }

    /**
     * @dev Callback from basket token on transfers
     */
    function onTokenTransfer(address from, address to, uint256 /* amount */) external override {
        require(msg.sender == address(basketToken), "Only basket token");
        
        // Update fee debt for both accounts
        if (from != address(0)) {
            uint256 balance = basketToken.balanceOf(from);
            feeDebt[from] = (balance * accFeePerShare) / 1e18;
        }
        if (to != address(0)) {
            uint256 balance = basketToken.balanceOf(to);
            feeDebt[to] = (balance * accFeePerShare) / 1e18;
        }
    }

    /**
     * @dev Claim accumulated fees
     */
    function claimFees() external {
        uint256 balance = basketToken.balanceOf(msg.sender);
        uint256 accruedFees = (balance * accFeePerShare) / 1e18;
        uint256 debt = feeDebt[msg.sender];
        
        require(accruedFees > debt, "No fees to claim");
        
        uint256 claimableAmount = accruedFees - debt;
        feeDebt[msg.sender] = accruedFees;
        
        // Transfer USDC fees from contract balance
        require(IERC20(baseToken).balanceOf(address(this)) >= claimableAmount, "Insufficient fee balance");
        IERC20(baseToken).safeTransfer(msg.sender, claimableAmount);
        
        emit FeesCollected(msg.sender, claimableAmount);
    }

    /**
     * @dev Get pending fees for an address
     */
    function getPendingFees(address user) external view returns (uint256) {
        uint256 balance = basketToken.balanceOf(user);
        uint256 accruedFees = (balance * accFeePerShare) / 1e18;
        uint256 debt = feeDebt[user];
        
        return accruedFees > debt ? accruedFees - debt : 0;
    }

    /**
     * @dev Get basket composition
     */
    function getBasketComposition() external view override returns (address[] memory, uint256[] memory) {
        return (basketInfo.assets, basketInfo.weights);
    }

    /**
     * @dev Check if address is valid for operations
     */
    function isValidUser(address user) external view override returns (bool) {
        return !basketToken.blacklisted(user) && !emergencyPaused;
    }

    /**
     * @dev Get basket statistics
     */
    function getBasketStats() external view returns (
        uint256 totalSupply,
        uint256 nav,
        uint256 totalAssets,
        uint256 lastRebalanceTime,
        bool isActive
    ) {
        totalSupply = basketToken.totalSupply();
        nav = calculateNAV();
        totalAssets = basketInfo.assets.length;
        lastRebalanceTime = basketInfo.lastRebalance;
        isActive = basketInfo.isActive && !emergencyPaused;
    }

    /**
     * @dev Rebalance basket weights (simplified - manual trigger only in V1)
     * @notice WARNING: This only updates target weights, does NOT execute trades
     * @notice Basket will be rebalanced gradually through natural deposit/withdrawal flow
     * @notice For immediate rebalancing, implement _executeRebalanceTrades() function
     */
    function announceRebalance(
        uint256[] calldata newWeights
    ) external onlySecurityCouncil {
        require(newWeights.length == basketInfo.assets.length, "Length mismatch");
        
        // Validate new weights sum to 10000
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < newWeights.length; i++) {
            require(newWeights[i] > 0, "Weight must be positive");
            totalWeight += newWeights[i];
        }
        require(totalWeight == BASIS_POINTS, "Weights must sum to 10000");
        
        // Update target weights - actual rebalancing happens through deposits/withdrawals
        // TODO: Implement _executeRebalanceTrades() for immediate rebalancing
        basketInfo.weights = newWeights;
        basketInfo.lastRebalance = block.timestamp;
        
        emit Rebalance(block.timestamp, basketInfo.assets, newWeights);
    }

    /**
     * @dev Update security council
     */
    function updateSecurityCouncil(address newCouncil) external onlySecurityCouncil {
        require(newCouncil != address(0), "Invalid address");
        securityCouncil = newCouncil;
    }

    /**
     * @dev Update deposit limits
     */
    function updateLimits(uint256 newMaxDeposit, uint256 newMaxSupply) external onlySecurityCouncil {
        require(newMaxDeposit > MIN_DEPOSIT, "Max deposit too low");
        require(newMaxSupply > basketToken.totalSupply(), "Max supply too low");
        
        maxDepositAmount = newMaxDeposit;
        maxTotalSupply = newMaxSupply;
    }
}