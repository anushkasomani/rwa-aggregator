// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./BasketVaultERC7540.sol";
import "../oracles/OracleAggregator.sol";

/**
 * @title BasketFactoryV2
 * @dev Clean factory for creating ERC-7540 compliant baskets
 */
contract BasketFactoryV2 is Ownable, ReentrancyGuard {
    
    // ================================
    // STRUCTS
    // ================================
    
    struct BasketConfig {
        address[] assets;
        uint256[] weights;
        address baseToken;
        string name;
        string symbol;
        address creator;
        uint256 createdAt;
    }

    // ================================
    // STATE VARIABLES
    // ================================
    
    address public immutable oracleAggregator;
    address public immutable securityCouncil;
    address public immutable orderRouter;
    
    address[] public allBaskets;
    mapping(bytes32 => address) public basketsByHash;
    mapping(address => bool) public isValidBasket;
    mapping(address => address[]) public basketsByCreator;
    
    uint256 public constant MIN_ASSETS = 3;
    uint256 public constant MAX_ASSETS = 10;
    uint256 public constant TOTAL_WEIGHT = 10000;
    
    uint256 public basketCreationFee;
    bool public basketCreationPaused;

    // ================================
    // EVENTS
    // ================================
    
    event BasketCreated(
        address indexed basket,
        address indexed vault,
        address indexed creator,
        address[] assets,
        uint256[] weights,
        bytes32 configHash
    );
    
    event BasketCreationPaused();
    event BasketCreationUnpaused();
    event CreationFeeUpdated(uint256 newFee);

    // ================================
    // ERRORS
    // ================================
    
    error CreationPaused();
    error InsufficientFee();
    error InvalidAssetCount();
    error InvalidInput();
    error InvalidWeights();
    error DuplicateAsset();
    error AssetNotSupported();
    error BasketExists();

    // ================================
    // MODIFIERS
    // ================================
    
    modifier basketCreationNotPaused() {
        if (basketCreationPaused) revert CreationPaused();
        _;
    }

    // ================================
    // CONSTRUCTOR
    // ================================
    
    constructor(
        address _oracleAggregator,
        address _securityCouncil,
        address _orderRouter
    ) Ownable(msg.sender) {
        if (_oracleAggregator == address(0)) revert InvalidInput();
        if (_securityCouncil == address(0)) revert InvalidInput();
        if (_orderRouter == address(0)) revert InvalidInput();
        
        oracleAggregator = _oracleAggregator;
        securityCouncil = _securityCouncil;
        orderRouter = _orderRouter;
    }

    // ================================
    // MAIN FUNCTIONS
    // ================================
    
    /**
     * @dev Create a new ERC-7540 compliant basket
     */
    function createBasket(
        address[] memory assets,
        uint256[] memory weights,
        address baseToken,
        string memory name,
        string memory symbol
    ) external payable basketCreationNotPaused nonReentrant returns (address basketVault) {
        
        // Basic validations
        if (msg.value < basketCreationFee) revert InsufficientFee();
        if (assets.length < MIN_ASSETS || assets.length > MAX_ASSETS) revert InvalidAssetCount();
        if (assets.length != weights.length) revert InvalidInput();
        if (bytes(name).length == 0 || bytes(symbol).length == 0) revert InvalidInput();
        if (baseToken == address(0)) revert InvalidInput();

        // Validate weights
        _validateWeights(weights);
        
        // Validate assets
        _validateAssets(assets, baseToken);
        
        // Check for duplicates
        bytes32 configHash = _calculateConfigHash(assets, weights, baseToken);
        if (basketsByHash[configHash] != address(0)) revert BasketExists();

        // Deploy ERC-7540 vault
        basketVault = address(new BasketVaultERC7540(
            IERC20(baseToken),
            string.concat(name, " Vault"),
            string.concat(symbol, "V")
        ));
        
        // Configure vault
        BasketVaultERC7540 vault = BasketVaultERC7540(basketVault);
        
        // Authorize all assets in vault
        for (uint256 i = 0; i < assets.length; i++) {
            vault.authorizeToken(assets[i]);
        }
        
        // Set processing delay for async operations (1 hour default for RWA compliance)
        vault.setProcessingDelay(1 hours);
        
        // Transfer vault ownership to factory owner (enables admin operations)
        vault.transferOwnership(owner());

        // Register basket
        basketsByHash[configHash] = basketVault;
        isValidBasket[basketVault] = true;
        allBaskets.push(basketVault);
        basketsByCreator[msg.sender].push(basketVault);

        emit BasketCreated(
            basketVault, // Note: In V2, the vault is the main contract
            basketVault,
            msg.sender,
            assets,
            weights,
            configHash
        );
    }

    // ================================
    // INTERNAL FUNCTIONS
    // ================================
    
    function _validateWeights(uint256[] memory weights) internal pure {
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < weights.length; i++) {
            if (weights[i] == 0) revert InvalidWeights();
            totalWeight += weights[i];
        }
        if (totalWeight != TOTAL_WEIGHT) revert InvalidWeights();
    }
    
    function _validateAssets(address[] memory assets, address baseToken) internal view {
        for (uint256 i = 0; i < assets.length; i++) {
            if (assets[i] == address(0)) revert InvalidInput();
            if (assets[i] == baseToken) revert InvalidInput();
            
            // Check for duplicates
            for (uint256 j = i + 1; j < assets.length; j++) {
                if (assets[i] == assets[j]) revert DuplicateAsset();
            }
            
            // Validate oracle support
            try OracleAggregator(oracleAggregator).getPrice(assets[i]) returns (uint256 price) {
                if (price == 0) revert AssetNotSupported();
            } catch {
                revert AssetNotSupported();
            }
        }
    }
    
    function _calculateConfigHash(
        address[] memory assets,
        uint256[] memory weights,
        address baseToken
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            _sortArrays(assets, weights),
            baseToken
        ));
    }
    
    function _sortArrays(
        address[] memory assets,
        uint256[] memory weights
    ) internal pure returns (bytes memory) {
        // Bubble sort for small arrays
        for (uint256 i = 0; i < assets.length - 1; i++) {
            for (uint256 j = 0; j < assets.length - i - 1; j++) {
                if (assets[j] > assets[j + 1]) {
                    // Swap assets
                    (assets[j], assets[j + 1]) = (assets[j + 1], assets[j]);
                    // Swap weights
                    (weights[j], weights[j + 1]) = (weights[j + 1], weights[j]);
                }
            }
        }
        return abi.encodePacked(assets, weights);
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================
    
    function getBasketsByCreator(address creator) external view returns (address[] memory) {
        return basketsByCreator[creator];
    }
    
    function getAllBaskets() external view returns (address[] memory) {
        return allBaskets;
    }
    
    function getBasketCount() external view returns (uint256) {
        return allBaskets.length;
    }

    // ================================
    // ADMIN FUNCTIONS
    // ================================
    
    function pauseBasketCreation() external onlyOwner {
        basketCreationPaused = true;
        emit BasketCreationPaused();
    }
    
    function unpauseBasketCreation() external onlyOwner {
        basketCreationPaused = false;
        emit BasketCreationUnpaused();
    }
    
    function setCreationFee(uint256 newFee) external onlyOwner {
        basketCreationFee = newFee;
        emit CreationFeeUpdated(newFee);
    }
    
    function withdrawFees(address to) external onlyOwner {
        if (to == address(0)) revert InvalidInput();
        uint256 balance = address(this).balance;
        if (balance == 0) return;
        
        (bool success, ) = to.call{value: balance}("");
        require(success, "Transfer failed");
    }
}