// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./BasketController.sol";
import "./BasketVault.sol";
import "../oracles/OracleAggregator.sol";

/**
 * @title BasketFactory for creating new baskets
 * @dev Factory pattern with security controls and validation
 */
contract BasketFactory is Ownable, ReentrancyGuard {
    struct BasketConfig {
        address[] assets;
        uint256[] weights;
        address baseToken;
        string name;
        string symbol;
        address creator;
        uint256 createdAt;
    }

    address public immutable oracleAggregator;
    address public immutable securityCouncil;
    address public immutable orderRouter;
    
    address[] public allBaskets;
    mapping(bytes32 => address) public basketsByHash;
    mapping(address => bool) public isValidBasket;
    mapping(address => address[]) public basketsByCreator;
    
    uint256 public constant MIN_ASSETS = 3;
    uint256 public constant MAX_ASSETS = 10;
    uint256 public constant TOTAL_WEIGHT = 10000; // 100% in basis points
    uint256 public basketCreationFee = 0; // Can be set to prevent spam

    bool public basketCreationPaused;

    event BasketCreated(
        address indexed basket,
        address indexed creator,
        address[] assets,
        uint256[] weights,
        bytes32 configHash
    );
    event BasketCreationPaused();
    event BasketCreationUnpaused();
    event CreationFeeUpdated(uint256 newFee);

    modifier basketCreationNotPaused() {
        require(!basketCreationPaused, "Basket creation paused");
        _;
    }

    constructor(
        address _oracleAggregator,
        address _securityCouncil,
        address _orderRouter
    ) Ownable(msg.sender) {
        require(_oracleAggregator != address(0), "Invalid oracle");
        require(_securityCouncil != address(0), "Invalid security council");
        require(_orderRouter != address(0), "Invalid order router");
        
        oracleAggregator = _oracleAggregator;
        securityCouncil = _securityCouncil;
        orderRouter = _orderRouter;
    }

    /**
     * @dev Create a new basket
     */
    function createBasket(
        address[] memory assets,
        uint256[] memory weights,
        address baseToken,
        string memory name,
        string memory symbol
    ) external payable basketCreationNotPaused nonReentrant returns (address) {
        require(msg.value >= basketCreationFee, "Insufficient creation fee");
        require(assets.length >= MIN_ASSETS, "Too few assets");
        require(assets.length <= MAX_ASSETS, "Too many assets");
        require(assets.length == weights.length, "Length mismatch");
        require(bytes(name).length > 0, "Name required");
        require(bytes(symbol).length > 0, "Symbol required");

        // Validate weights sum to 100%
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < weights.length; i++) {
            require(weights[i] > 0, "Weight must be positive");
            totalWeight += weights[i];
        }
        require(totalWeight == TOTAL_WEIGHT, "Weights must sum to 10000");

        // Validate no duplicate assets and basic checks
        require(baseToken != address(0), "Invalid base token");
        for (uint256 i = 0; i < assets.length; i++) {
            require(assets[i] != address(0), "Invalid asset address");
            require(assets[i] != baseToken, "Asset cannot be base token");
            
            // Check for duplicates
            for (uint256 j = i + 1; j < assets.length; j++) {
                require(assets[i] != assets[j], "Duplicate asset");
            }
        }

        // Validate assets have oracle prices (prevent baskets with unpriceable assets)
        for (uint256 i = 0; i < assets.length; i++) {
            try OracleAggregator(oracleAggregator).getPrice(assets[i]) returns (uint256 price) {
                require(price > 0, "Asset has no valid price");
            } catch {
                revert("Asset not supported by oracle");
            }
        }

        // Calculate config hash to prevent duplicates
        bytes32 configHash = keccak256(
            abi.encodePacked(
                _sortArrays(assets, weights),
                baseToken
            )
        );
        require(basketsByHash[configHash] == address(0), "Basket already exists");

        // Deploy vault
        BasketVault vault = new BasketVault();
        
        // Authorize all assets in vault
        for (uint256 i = 0; i < assets.length; i++) {
            vault.authorizeToken(assets[i]);
        }
        vault.authorizeToken(baseToken); // Also authorize base token

        // Deploy controller
        BasketController controller = new BasketController(
            assets,
            weights,
            baseToken,
            address(vault),
            oracleAggregator,
            securityCouncil,
            orderRouter,
            name,
            symbol
        );

        // Set controller as vault owner
        vault.transferOwnership(address(controller));

        // Register basket
        basketsByHash[configHash] = address(controller);
        isValidBasket[address(controller)] = true;
        allBaskets.push(address(controller));
        basketsByCreator[msg.sender].push(address(controller));

        emit BasketCreated(
            address(controller),
            msg.sender,
            assets,
            weights,
            configHash
        );

        return address(controller);
    }

    /**
     * @dev Sort arrays to ensure consistent hashing
     */
    function _sortArrays(
        address[] memory assets,
        uint256[] memory weights
    ) internal pure returns (bytes memory) {
        // Simple bubble sort for small arrays
        for (uint256 i = 0; i < assets.length - 1; i++) {
            for (uint256 j = 0; j < assets.length - i - 1; j++) {
                if (assets[j] > assets[j + 1]) {
                    // Swap assets
                    address tempAsset = assets[j];
                    assets[j] = assets[j + 1];
                    assets[j + 1] = tempAsset;
                    
                    // Swap corresponding weights
                    uint256 tempWeight = weights[j];
                    weights[j] = weights[j + 1];
                    weights[j + 1] = tempWeight;
                }
            }
        }
        
        return abi.encodePacked(assets, weights);
    }

    /**
     * @dev Get all baskets created by an address
     */
    function getBasketsByCreator(address creator) external view returns (address[] memory) {
        return basketsByCreator[creator];
    }

    /**
     * @dev Get all baskets
     */
    function getAllBaskets() external view returns (address[] memory) {
        return allBaskets;
    }

    /**
     * @dev Get basket count
     */
    function getBasketCount() external view returns (uint256) {
        return allBaskets.length;
    }

    /**
     * @dev Pause basket creation (emergency)
     */
    function pauseBasketCreation() external onlyOwner {
        basketCreationPaused = true;
        emit BasketCreationPaused();
    }

    /**
     * @dev Unpause basket creation
     */
    function unpauseBasketCreation() external onlyOwner {
        basketCreationPaused = false;
        emit BasketCreationUnpaused();
    }

    /**
     * @dev Update creation fee
     */
    function setCreationFee(uint256 newFee) external onlyOwner {
        basketCreationFee = newFee;
        emit CreationFeeUpdated(newFee);
    }

    /**
     * @dev Withdraw accumulated fees
     */
    function withdrawFees(address to) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        
        (bool success, ) = to.call{value: balance}("");
        require(success, "Transfer failed");
    }
}