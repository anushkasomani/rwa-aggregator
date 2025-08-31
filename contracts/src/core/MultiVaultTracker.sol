// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;


// Define IERC4626 interface locally
interface IERC4626 {
    function asset() external view returns (address);
}

contract MultiVaultTracker {
    struct VaultPosition {
        address vault; // ERC4626 vault address
        address asset; // Underlying asset (for convenience)
        uint256 shares; // User's shares in this vault
        uint256 firstDeposit; // First deposit timestamp
        uint256 lastUpdate; // Last update timestamp
    }

    // User -> all vaults they have positions in
    mapping(address => address[]) private userVaults;
    // User -> vault -> position
    mapping(address => mapping(address => VaultPosition)) private userVaultPositions;
    // Track if user has position in vault (for gas optimization)
    mapping(address => mapping(address => bool)) private hasVaultPosition;

    // Events
    event PositionUpdated(
        address indexed user,
        address indexed vault,
        address indexed asset,
        uint256 shares,
        uint256 timestamp
    );

    function trackDeposit(address user, address vault, uint256 shares) external {
        // Get asset from vault
        address asset = IERC4626(vault).asset();

        // Check if user already has position in this vault
        if (!hasVaultPosition[user][vault]) {
            userVaults[user].push(vault);
            hasVaultPosition[user][vault] = true;
            // Initialize new position
            userVaultPositions[user][vault] = VaultPosition({
                vault: vault,
                asset: asset,
                shares: shares,
                firstDeposit: block.timestamp,
                lastUpdate: block.timestamp
            });
        } else {
            // Update existing position
            userVaultPositions[user][vault].shares += shares;
            userVaultPositions[user][vault].lastUpdate = block.timestamp;
        }
        emit PositionUpdated(user, vault, asset, shares, block.timestamp);
    }

    function trackWithdrawal(address user, address vault, uint256 shares) external {
        if (!hasVaultPosition[user][vault]) {
            revert("No position exists");
        }
        VaultPosition storage position = userVaultPositions[user][vault];
        if (position.shares < shares) {
            revert("Insufficient shares");
        }
        // Update position
        position.shares -= shares;
        position.lastUpdate = block.timestamp;

        // If position is now empty, we could remove it (optional)
        if (position.shares == 0) {
            // Remove vault from user's list (complex operation, consider gas costs)
            // For simplicity, we'll keep the entry but with zero shares
        }

        emit PositionUpdated(user, vault, position.asset, position.shares, block.timestamp);
    }

    // Get all vaults a user has positions in
    function getUserVaults(address user) external view returns (address[] memory) {
        return userVaults[user];
    }

    // Get details for a specific vault position
    function getUserVaultPosition(address user, address vault) external view returns (VaultPosition memory) {
        return userVaultPositions[user][vault];
    }

    // Get all vault positions for a user
    function getAllUserPositions(address user) external view returns (VaultPosition[] memory) {
        address[] memory vaults = userVaults[user];
        VaultPosition[] memory positions = new VaultPosition[](vaults.length);

        for (uint256 i = 0; i < vaults.length; i++) {
            positions[i] = userVaultPositions[user][vaults[i]];
        }

        return positions;
    }
}
