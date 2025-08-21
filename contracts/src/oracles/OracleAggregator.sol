// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
// import "../libraries/TickMath.sol";  // TODO: Implement proper TickMath for TWAP
import "../interfaces/IERC20Extended.sol";

// TODO: Re-enable when implementing proper TWAP
// interface IUniswapV3Pool {
//     function observe(uint32[] calldata secondsAgos)
//         external
//         view
//         returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s);
//     
//     function token0() external view returns (address);
//     function token1() external view returns (address);
//     function fee() external view returns (uint24);
// }

/**
 * @title OracleAggregator with Chainlink integration (TWAP temporarily disabled)
 * @dev Currently uses Chainlink only - TWAP integration pending proper TickMath implementation
 * @notice TWAP functionality commented out due to incomplete TickMath library
 */
contract OracleAggregator is Ownable {
    struct OracleConfig {
        AggregatorV3Interface chainlinkFeed;
        // IUniswapV3Pool uniswapPool;      // TODO: Re-enable for TWAP
        // uint32 twapPeriod;               // TODO: Re-enable for TWAP
        // uint256 maxDeviationBps;         // TODO: Re-enable for TWAP (basis points)
        uint256 maxStaleness;
        // bool token0IsBase;               // TODO: Re-enable for TWAP (true if token0 is the base token)
        bool isActive;
    }

    struct PriceData {
        uint256 chainlinkPrice;
        // uint256 uniswapPrice;            // TODO: Re-enable for TWAP
        uint256 finalPrice;
        // uint256 deviation;               // TODO: Re-enable for TWAP
        uint256 timestamp;
    }

    mapping(address => OracleConfig) public oracles;
    mapping(address => PriceData) public lastPriceData;
    mapping(address => uint256) public priceUpdateCount;
    mapping(address => uint256) public emergencyPrices;
    
    // Circuit breaker state
    mapping(address => bool) public circuitBreakerTriggered;
    mapping(address => uint256) public circuitBreakerTime;
    
    // uint256 public constant MAX_DEVIATION_BPS = 1000; // TODO: Re-enable for TWAP (10%)
    // uint256 public constant DEFAULT_TWAP_PERIOD = 3600; // TODO: Re-enable for TWAP (1 hour)
    uint256 public constant MAX_STALENESS = 3600; // 1 hour
    uint256 public constant CIRCUIT_BREAKER_DURATION = 7200; // 2 hours
    uint256 public constant BASIS_POINTS = 10000;

    bool public emergencyMode;
    address public emergencyOracle;

    event OracleAdded(address indexed token, address chainlinkFeed, address uniswapPool);
    event PriceUpdated(address indexed token, uint256 chainlinkPrice, uint256 uniswapPrice, uint256 finalPrice);
    event PriceDeviationDetected(address indexed token, uint256 chainlinkPrice, uint256 uniswapPrice, uint256 deviation);
    event CircuitBreakerTriggered(address indexed token, string reason);
    event CircuitBreakerReset(address indexed token);
    event EmergencyModeActivated(string reason);
    event EmergencyPriceSet(address indexed token, uint256 price);

    modifier validToken(address token) {
        require(oracles[token].isActive, "Oracle not configured");
        _;
    }

    modifier circuitBreakerCheck(address token) {
        if (circuitBreakerTriggered[token]) {
            require(
                block.timestamp >= circuitBreakerTime[token] + CIRCUIT_BREAKER_DURATION,
                "Circuit breaker active"
            );
            // Auto-reset circuit breaker after duration
            circuitBreakerTriggered[token] = false;
            emit CircuitBreakerReset(token);
        }
        _;
    }

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Get price using Chainlink only (TWAP temporarily disabled)
     * @notice TWAP validation disabled until proper TickMath implementation
     */
    function getPrice(address token) external view validToken(token) returns (uint256) {
        // Check emergency mode first
        if (emergencyMode) {
            return emergencyPrices[token];
        }

        // Check circuit breaker
        if (circuitBreakerTriggered[token]) {
            if (block.timestamp < circuitBreakerTime[token] + CIRCUIT_BREAKER_DURATION) {
                return emergencyPrices[token];
            }
        }

        OracleConfig memory config = oracles[token];
        
        // Get Chainlink price only (TWAP disabled)
        uint256 chainlinkPrice = _getChainlinkPrice(config.chainlinkFeed);
        
        // TODO: Re-enable TWAP validation when proper TickMath is implemented
        // uint256 uniswapPrice = _getUniswapTWAP(token, config);
        // uint256 deviation = _calculateDeviation(chainlinkPrice, uniswapPrice);
        // if (deviation > config.maxDeviationBps) {
        //     if (emergencyPrices[token] > 0) {
        //         return emergencyPrices[token];
        //     }
        //     revert("Price manipulation detected");
        // }

        // Return Chainlink price only
        return chainlinkPrice;
    }

    /**
     * @dev Get price with detailed information (for monitoring) - Chainlink only mode
     */
    function getPriceDetails(address token) 
        external 
        view 
        validToken(token) 
        returns (
            uint256 chainlinkPrice,
            uint256 uniswapPrice,        // Always 0 (TWAP disabled)
            uint256 finalPrice,
            uint256 deviation,           // Always 0 (TWAP disabled)
            bool isCircuitBreakerActive
        ) 
    {
        OracleConfig memory config = oracles[token];
        
        chainlinkPrice = _getChainlinkPrice(config.chainlinkFeed);
        uniswapPrice = 0;  // TWAP disabled
        deviation = 0;     // No deviation check without TWAP
        isCircuitBreakerActive = circuitBreakerTriggered[token] && 
            (block.timestamp < circuitBreakerTime[token] + CIRCUIT_BREAKER_DURATION);
        
        if (emergencyMode || isCircuitBreakerActive) {
            finalPrice = emergencyPrices[token];
        } else {
            finalPrice = chainlinkPrice;  // Chainlink only
        }
    }

    /**
     * @dev Get Chainlink price with staleness check
     */
    function _getChainlinkPrice(AggregatorV3Interface feed) internal view returns (uint256) {
        (, int256 price, , uint256 updatedAt, ) = feed.latestRoundData();
        require(price > 0, "Invalid Chainlink price");
        require(block.timestamp - updatedAt <= MAX_STALENESS, "Chainlink price stale");
        
        return uint256(price) * 1e10; // Convert from 8 decimals to 18 decimals
    }

    // TODO: Re-enable when proper TickMath is implemented
    // /**
    //  * @dev Get Uniswap V3 TWAP price with proper tick math
    //  */
    // function _getUniswapTWAP(address token, OracleConfig memory config) internal view returns (uint256) {
    //     IUniswapV3Pool pool = config.uniswapPool;
    //     uint32 period = config.twapPeriod;
    //     
    //     // Get tick cumulatives
    //     uint32[] memory secondsAgos = new uint32[](2);
    //     secondsAgos[0] = period;
    //     secondsAgos[1] = 0;

    //     (int56[] memory tickCumulatives, ) = pool.observe(secondsAgos);
    //     
    //     // Calculate TWAP tick
    //     int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
    //     int24 arithmeticMeanTick = int24(tickCumulativesDelta / int56(uint56(period)));

    //     // Convert tick to price
    //     uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(arithmeticMeanTick);
    //     
    //     // Convert sqrtPriceX96 to actual price
    //     address token0 = pool.token0();
    //     address token1 = pool.token1();
    //     
    //     uint8 decimals0 = IERC20Extended(token0).decimals();
    //     uint8 decimals1 = IERC20Extended(token1).decimals();
    //     
    //     uint256 price = TickMath.sqrtPriceX96ToPrice(sqrtPriceX96, decimals0, decimals1);
    //     
    //     // Adjust price based on token position and base token
    //     if (config.token0IsBase) {
    //         // If token0 is base (USDC), price is token1/token0
    //         if (token == token1) {
    //             return price;
    //         } else {
    //             return price > 0 ? (1e36 / price) : 0; // Invert for token0 price
    //         }
    //     } else {
    //         // If token1 is base (USDC), price is token0/token1
    //         if (token == token0) {
    //             return price > 0 ? (1e36 / price) : 0; // Invert for token0 price
    //         } else {
    //             return price;
    //         }
    //     }
    // }

    // TODO: Re-enable when TWAP is implemented
    // /**
    //  * @dev Calculate price deviation in basis points
    //  */
    // function _calculateDeviation(uint256 price1, uint256 price2) internal pure returns (uint256) {
    //     if (price1 == 0 || price2 == 0) return BASIS_POINTS; // 100% deviation
    //     
    //     uint256 diff = price1 > price2 ? price1 - price2 : price2 - price1;
    //     uint256 average = (price1 + price2) / 2;
    //     
    //     return (diff * BASIS_POINTS) / average;
    // }

    /**
     * @dev Add oracle configuration for a token (Chainlink only - TWAP disabled)
     */
    function addOracle(
        address token,
        address chainlinkFeed
        // address uniswapPool,     // TODO: Re-enable for TWAP
        // uint32 twapPeriod,       // TODO: Re-enable for TWAP
        // uint256 maxDeviationBps, // TODO: Re-enable for TWAP
        // bool token0IsBase        // TODO: Re-enable for TWAP
    ) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(chainlinkFeed != address(0), "Invalid Chainlink feed");
        
        // TODO: Re-enable TWAP validation when implemented
        // require(uniswapPool != address(0), "Invalid Uniswap pool");
        // require(maxDeviationBps <= MAX_DEVIATION_BPS, "Deviation too high");
        // require(twapPeriod >= 300, "TWAP period too short"); // Minimum 5 minutes
        
        // // Verify pool contains the token
        // IUniswapV3Pool pool = IUniswapV3Pool(uniswapPool);
        // require(
        //     pool.token0() == token || pool.token1() == token,
        //     "Token not in pool"
        // );
        
        oracles[token] = OracleConfig({
            chainlinkFeed: AggregatorV3Interface(chainlinkFeed),
            // uniswapPool: pool,           // TODO: Re-enable for TWAP
            // twapPeriod: twapPeriod,      // TODO: Re-enable for TWAP
            // maxDeviationBps: maxDeviationBps, // TODO: Re-enable for TWAP
            maxStaleness: MAX_STALENESS,
            // token0IsBase: token0IsBase,  // TODO: Re-enable for TWAP
            isActive: true
        });

        // Set initial emergency price
        try this.getPrice(token) returns (uint256 price) {
            emergencyPrices[token] = price;
        } catch {
            // If price fetch fails, set a default emergency price
            emergencyPrices[token] = 1e18; // $1 default
        }

        emit OracleAdded(token, chainlinkFeed, address(0)); // uniswapPool disabled
    }

    /**
     * @dev Update price data for monitoring (Chainlink only mode)
     */
    function updatePrice(address token) external validToken(token) circuitBreakerCheck(token) {
        OracleConfig memory config = oracles[token];
        
        uint256 chainlinkPrice = _getChainlinkPrice(config.chainlinkFeed);
        
        // Store price data for monitoring (TWAP fields disabled)
        lastPriceData[token] = PriceData({
            chainlinkPrice: chainlinkPrice,
            // uniswapPrice: 0,             // TODO: Re-enable for TWAP
            finalPrice: chainlinkPrice,     // Chainlink only
            // deviation: 0,                // TODO: Re-enable for TWAP
            timestamp: block.timestamp
        });
        
        priceUpdateCount[token]++;
        
        // TODO: Re-enable manipulation check when TWAP is implemented
        // if (deviation > config.maxDeviationBps) {
        //     _triggerCircuitBreaker(token, "Price deviation exceeded");
        //     emit PriceDeviationDetected(token, chainlinkPrice, uniswapPrice, deviation);
        // } else {
            emit PriceUpdated(token, chainlinkPrice, 0, lastPriceData[token].finalPrice); // uniswapPrice = 0
        // }
    }

    /**
     * @dev Trigger circuit breaker for a token
     */
    function _triggerCircuitBreaker(address token, string memory reason) internal {
        circuitBreakerTriggered[token] = true;
        circuitBreakerTime[token] = block.timestamp;
        emit CircuitBreakerTriggered(token, reason);
    }

    /**
     * @dev Manually trigger circuit breaker (security council only)
     */
    function triggerCircuitBreaker(address token, string calldata reason) external onlyOwner {
        require(oracles[token].isActive, "Oracle not configured");
        _triggerCircuitBreaker(token, reason);
    }

    /**
     * @dev Reset circuit breaker manually
     */
    function resetCircuitBreaker(address token) external onlyOwner {
        require(circuitBreakerTriggered[token], "Circuit breaker not active");
        circuitBreakerTriggered[token] = false;
        emit CircuitBreakerReset(token);
    }

    /**
     * @dev Set emergency price (security measure)
     */
    function setEmergencyPrice(address token, uint256 price) external onlyOwner {
        require(oracles[token].isActive, "Oracle not configured");
        require(price > 0, "Price must be positive");
        
        emergencyPrices[token] = price;
        emit EmergencyPriceSet(token, price);
    }

    /**
     * @dev Activate emergency mode (all prices use emergency values)
     */
    function activateEmergencyMode(string calldata reason) external onlyOwner {
        emergencyMode = true;
        emit EmergencyModeActivated(reason);
    }

    /**
     * @dev Deactivate emergency mode
     */
    function deactivateEmergencyMode() external onlyOwner {
        emergencyMode = false;
    }

    // TODO: Re-enable when TWAP is implemented
    // /**
    //  * @dev Update oracle configuration
    //  */
    // function updateOracleConfig(
    //     address token,
    //     uint32 newTwapPeriod,
    //     uint256 newMaxDeviationBps
    // ) external onlyOwner validToken(token) {
    //     require(newTwapPeriod >= 300, "TWAP period too short");
    //     require(newMaxDeviationBps <= MAX_DEVIATION_BPS, "Deviation too high");
    //     
    //     oracles[token].twapPeriod = newTwapPeriod;
    //     oracles[token].maxDeviationBps = newMaxDeviationBps;
    // }

    /**
     * @dev Deactivate oracle (emergency)
     */
    function deactivateOracle(address token) external onlyOwner {
        oracles[token].isActive = false;
    }

    /**
     * @dev Get oracle health status
     */
    function getOracleHealth(address token) 
        external 
        view 
        returns (
            bool isActive,
            bool isCircuitBreakerActive,
            uint256 lastUpdateTime,
            uint256 updateCount,
            uint256 lastDeviation
        ) 
    {
        isActive = oracles[token].isActive && !emergencyMode;
        isCircuitBreakerActive = circuitBreakerTriggered[token] && 
            (block.timestamp < circuitBreakerTime[token] + CIRCUIT_BREAKER_DURATION);
        lastUpdateTime = lastPriceData[token].timestamp;
        updateCount = priceUpdateCount[token];
        lastDeviation = 0; // Deviation disabled (TWAP not implemented)
    }
}