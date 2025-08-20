interface IBasketController {
    function onTokenTransfer(address from, address to, uint256 amount) external;
}

/**
 * @title BasketController with enhanced security
 * @dev Core logic for basket operations with MEV protection
 */
contract BasketController is EnhancedReentrancyGuard, IBasketController {
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
    address public immutable vault;
    address public immutable baseToken; // USDC
    OracleAggregator public immutable oracle;
    
    mapping(address => uint256) public feeDebt;
    uint256 public accFeePerShare;
    uint256 public lastFeeUpdate;
    
    // Security controls
    address public securityCouncil;
    bool public emergencyPaused;
    uint256 public maxDepositAmount;
    uint256 public maxTotalSupply;
    
    // MEV protection
    mapping(bytes32 => uint256) public pendingOperations;
    uint256 public constant OPERATION_DELAY = 15 minutes;

    event Deposit(address indexed user, uint256 usdcAmount, uint256 sharesOut);
    event Withdrawal(address indexed user, uint256 sharesIn, uint256 usdcOut);
    event EmergencyPaused(string reason);
    event OperationScheduled(bytes32 indexed operationHash, uint256 executeTime);

    modifier onlySecurityCouncil() {
        require(msg.sender == securityCouncil, "Only security council");
        _;
    }

    modifier notPaused() {
        require(!emergencyPaused, "Emergency paused");
        _;
    }

    modifier withinLimits(uint256 amount) {
        require(amount <= maxDepositAmount, "Exceeds max deposit");
        require(basketToken.totalSupply() + amount <= maxTotalSupply, "Exceeds max supply");
        _;
    }

    constructor(
        address[] memory _assets,
        uint256[] memory _weights,
        address _baseToken,
        address _vault,
        address _oracle,
        address _securityCouncil,
        string memory _tokenName,
        string memory _tokenSymbol
    ) {
        require(_assets.length == _weights.length, "Length mismatch");
        require(_assets.length >= 3, "Minimum 3 assets required");

        // Validate weights sum to 10000
        uint256 totalWeights;
        for (uint256 i = 0; i < _weights.length; i++) {
            totalWeights += _weights[i];
        }
        require(totalWeights == 10000, "Weights must sum to 10000");

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
        vault = _vault;
        oracle = OracleAggregator(_oracle);
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

        // Calculate entry fee
        uint256 entryFee = (usdcAmount * feeConfig.entryFeeBps) / 10000;
        uint256 netAmount = usdcAmount - entryFee;

        // Transfer USDC from user
        IERC20(baseToken).transferFrom(msg.sender, address(this), usdcAmount);

        // Distribute entry fee to existing holders
        if (basketToken.totalSupply() > 0 && entryFee > 0) {
            _distributeFee(entryFee);
        }

        // Calculate shares to mint based on current NAV
        uint256 currentNAV = _calculateNAV();
        uint256 sharesToMint;
        
        if (basketToken.totalSupply() == 0) {
            sharesToMint = netAmount; // 1:1 for first deposit
        } else {
            sharesToMint = (netAmount * basketToken.totalSupply()) / currentNAV;
        }

        require(sharesToMint >= minSharesOut, "Insufficient shares out");

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
        uint256 userShare = (sharesIn * 10000) / totalSupply;

        // Burn shares first to prevent manipulation
        basketToken.burn(msg.sender, sharesIn);

        // Execute sell orders
        uint256 usdcReceived = _executeSellOrders(userShare);

        // Calculate performance fee if above high water mark
        uint256 currentNAV = _calculateNAV();
        uint256 performanceFee = 0;
        
        if (currentNAV > basketInfo.highWaterMark) {
            uint256 profit = ((currentNAV - basketInfo.highWaterMark) * usdcReceived) / currentNAV;
            performanceFee = (profit * feeConfig.performanceFeeBps) / 10000;
            basketInfo.highWaterMark = currentNAV;
        }

        // Calculate exit fee
        uint256 exitFee = (usdcReceived * feeConfig.exitFeeBps) / 10000;
        uint256 totalFees = performanceFee + exitFee;
        uint256 netAmount = usdcReceived - totalFees;

        require(netAmount >= minUsdcOut, "Insufficient USDC out");

        // Distribute fees to remaining holders
        if (totalFees > 0) {
            _distributeFee(totalFees);
        }

        // Transfer USDC to user
        IERC20(baseToken).transfer(msg.sender, netAmount);

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
    function _calculateNAV() internal view returns (uint256) {
        uint256 totalValue = 0;
        
        for (uint256 i = 0; i < basketInfo.assets.length; i++) {
            address asset = basketInfo.assets[i];
            uint256 balance = IERC20(asset).balanceOf(vault);
            uint256 price = oracle.getPrice(asset);
            totalValue += (balance * price) / 1e18;
        }
        
        // Add any remaining base token
        totalValue += IERC20(baseToken).balanceOf(vault);
        
        return totalValue;
    }

    /**
     * @dev Update streaming fees
     */
    function _updateStreamingFees() internal {
        if (block.timestamp <= lastFeeUpdate) return;
        
        uint256 timeElapsed = block.timestamp - lastFeeUpdate;
        uint256 annualFee = feeConfig.streamingFeeBps;
        uint256 feeAmount = (annualFee * timeElapsed) / (365 days * 10000);
        
        if (feeAmount > 0 && basketToken.totalSupply() > 0) {
            // Mint new tokens to fee recipient (simplified)
            accFeePerShare += (feeAmount * 1e18) / basketToken.totalSupply();
        }
        
        lastFeeUpdate = block.timestamp;
    }

    /**
     * @dev Distribute fees to existing holders
     */
    function _distributeFee(uint256 feeAmount) internal {
        if (basketToken.totalSupply() > 0) {
            accFeePerShare += (feeAmount * 1e18) / basketToken.totalSupply();
        }
    }

    /**
     * @dev Execute buy orders for basket assets (placeholder)
     */
    function _executeBuyOrders(uint256 usdcAmount) internal {
        // Implementation would interact with OrderRouter
        // This is a simplified placeholder
    }

    /**
     * @dev Execute sell orders for basket assets (placeholder)
     */
    function _executeSellOrders(uint256 sharePercentage) internal returns (uint256) {
        // Implementation would interact with OrderRouter
        // This is a simplified placeholder
        return 0;
    }

    /**
     * @dev Callback from basket token on transfers
     */
    function onTokenTransfer(address from, address to, uint256 amount) external override {
        require(msg.sender == address(basketToken), "Only basket token");
        
        // Update fee debt for both accounts
        if (from != address(0)) {
            feeDebt[from] = (basketToken.balanceOf(from) * accFeePerShare) / 1e18;
        }
        if (to != address(0)) {
            feeDebt[to] = (basketToken.balanceOf(to) * accFeePerShare) / 1e18;
        }
    }

    /**
     * @dev Get basket composition
     */
    function getBasketComposition() external view returns (address[] memory, uint256[] memory) {
        return (basketInfo.assets, basketInfo.weights);
    }

    /**
     * @dev Check if address is valid for operations
     */
    function isValidUser(address user) external view returns (bool) {
        return !basketToken.blacklisted(user) && !emergencyPaused;
    }
}