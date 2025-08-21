// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BasketVault with enhanced security
 * @dev Secure storage for basket assets with access controls
 */
contract BasketVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    mapping(address => bool) public authorizedTokens;
    mapping(address => uint256) public lastWithdrawal;
    
    uint256 public constant WITHDRAWAL_COOLDOWN = 1 minutes;
    bool public emergencyPaused;

    event TokenAuthorized(address indexed token);
    event TokenDeauthorized(address indexed token);
    event TokensWithdrawn(address indexed token, uint256 amount, address to);
    event EmergencyPaused();
    event EmergencyUnpaused();

    modifier onlyAuthorizedToken(address token) {
        require(authorizedTokens[token], "Token not authorized");
        _;
    }

    modifier notPaused() {
        require(!emergencyPaused, "Emergency paused");
        _;
    }

    modifier cooldownPassed(address token) {
        require(
            block.timestamp >= lastWithdrawal[token] + WITHDRAWAL_COOLDOWN,
            "Withdrawal cooldown active"
        );
        _;
    }

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Authorize a token for vault operations
     */
    function authorizeToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token address");
        authorizedTokens[token] = true;
        emit TokenAuthorized(token);
    }

    /**
     * @dev Deauthorize a token
     */
    function deauthorizeToken(address token) external onlyOwner {
        authorizedTokens[token] = false;
        emit TokenDeauthorized(token);
    }

    /**
     * @dev Transfer tokens from vault to recipient
     */
    function pullToken(
        address token,
        uint256 amount,
        address to
    ) external 
        onlyOwner 
        onlyAuthorizedToken(token) 
        notPaused 
        cooldownPassed(token)
        nonReentrant 
    {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be positive");
        require(getTokenBalance(token) >= amount, "Insufficient balance");

        lastWithdrawal[token] = block.timestamp;
        IERC20(token).safeTransfer(to, amount);
        
        emit TokensWithdrawn(token, amount, to);
    }


    /**
     * @dev Get token balance in vault
     */
    function getTokenBalance(address token) public view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    /**
     * @dev Get all token balances
     */
    function getAllTokenBalances(address[] calldata tokens) 
        external 
        view 
        returns (uint256[] memory balances) 
    {
        balances = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            balances[i] = getTokenBalance(tokens[i]);
        }
    }

    /**
     * @dev Emergency pause function
     */
    function emergencyPause() external onlyOwner {
        emergencyPaused = true;
        emit EmergencyPaused();
    }

    /**
     * @dev Unpause emergency state
     */
    function emergencyUnpause() external onlyOwner {
        emergencyPaused = false;
        emit EmergencyUnpaused();
    }

    /**
     * @dev Emergency token recovery (only when paused)
     */
    function emergencyWithdraw(
        address token,
        uint256 amount,
        address to
    ) external onlyOwner {
        require(emergencyPaused, "Must be paused");
        require(to != address(0), "Invalid recipient");
        
        IERC20(token).safeTransfer(to, amount);
    }
}