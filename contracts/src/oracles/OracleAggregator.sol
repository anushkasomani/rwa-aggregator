import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

interface IUniswapV3Pool {
    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s);
}

/**
 * @title OracleAggregator with manipulation resistance
 * @dev Combines Chainlink and Uniswap V3 TWAP with circuit breakers
 */
contract OracleAggregator {
    struct OracleConfig {
        AggregatorV3Interface chainlinkFeed;
        IUniswapV3Pool uniswapPool;
        uint32 twapPeriod;
        uint256 maxDeviationBps; // basis points
        uint256 maxStaleness;
        bool isActive;
    }

    mapping(address => OracleConfig) public oracles;
    mapping(address => uint256) public lastUpdateTime;
    mapping(address => uint256) public emergencyPrices;
    
    uint256 public constant MAX_DEVIATION_BPS = 1000; // 10%
    uint256 public constant DEFAULT_TWAP_PERIOD = 3600; // 1 hour
    uint256 public constant MAX_STALENESS = 3600; // 1 hour

    address public immutable owner;
    bool public emergencyMode;

    event OracleAdded(address indexed token, address chainlinkFeed, address uniswapPool);
    event PriceDeviationDetected(address indexed token, uint256 chainlinkPrice, uint256 uniswapPrice);
    event EmergencyModeActivated(string reason);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Get price with manipulation protection
     */
    function getPrice(address token) external view returns (uint256) {
        require(oracles[token].isActive, "Oracle not configured");
        
        if (emergencyMode) {
            return emergencyPrices[token];
        }

        OracleConfig memory config = oracles[token];
        
        // Get Chainlink price
        (, int256 chainlinkPrice, , uint256 updatedAt, ) = config.chainlinkFeed.latestRoundData();
        require(chainlinkPrice > 0, "Invalid Chainlink price");
        require(block.timestamp - updatedAt <= config.maxStaleness, "Chainlink price stale");

        // Get Uniswap TWAP price
        uint256 uniswapPrice = _getUniswapTWAP(config.uniswapPool, config.twapPeriod);
        
        // Check for manipulation
        uint256 chainlinkPriceUint = uint256(chainlinkPrice);
        uint256 deviation = _calculateDeviation(chainlinkPriceUint, uniswapPrice);
        
        require(deviation <= config.maxDeviationBps, "Price manipulation detected");

        // Return average of both prices
        return (chainlinkPriceUint + uniswapPrice) / 2;
    }

    function _getUniswapTWAP(IUniswapV3Pool pool, uint32 period) internal view returns (uint256) {
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = period;
        secondsAgos[1] = 0;

        (int56[] memory tickCumulatives, ) = pool.observe(secondsAgos);
        
        int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
        int24 arithmeticMeanTick = int24(tickCumulativesDelta / int56(uint56(period)));

        return _sqrtPriceX96ToPrice(arithmeticMeanTick);
    }

    function _sqrtPriceX96ToPrice(int24 tick) internal pure returns (uint256) {
        // Simplified price calculation - implement proper tick to price conversion
        // This is a placeholder for the actual implementation
        return uint256(int256(tick)) * 1e18 / 1e6;
    }

    function _calculateDeviation(uint256 price1, uint256 price2) internal pure returns (uint256) {
        uint256 diff = price1 > price2 ? price1 - price2 : price2 - price1;
        return (diff * 10000) / ((price1 + price2) / 2);
    }

    function addOracle(
        address token,
        address chainlinkFeed,
        address uniswapPool,
        uint32 twapPeriod,
        uint256 maxDeviationBps
    ) external onlyOwner {
        require(maxDeviationBps <= MAX_DEVIATION_BPS, "Deviation too high");
        
        oracles[token] = OracleConfig({
            chainlinkFeed: AggregatorV3Interface(chainlinkFeed),
            uniswapPool: IUniswapV3Pool(uniswapPool),
            twapPeriod: twapPeriod,
            maxDeviationBps: maxDeviationBps,
            maxStaleness: MAX_STALENESS,
            isActive: true
        });

        emit OracleAdded(token, chainlinkFeed, uniswapPool);
    }

    function activateEmergencyMode(string calldata reason) external onlyOwner {
        emergencyMode = true;
        emit EmergencyModeActivated(reason);
    }
}