// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IMultiVaultTracker
 * @dev Interface for tracking user positions across multiple vaults
 */
interface IMultiVaultTracker {
    /**
     * @notice Track a deposit made by a user to a vault
     * @param user The address of the user who deposited
     * @param vault The address of the vault where the deposit was made
     * @param shares The number of shares minted to the user
     */
    function trackDeposit(address user, address vault, uint256 shares) external;

    /**
     * @notice Track a withdrawal made by a user from a vault
     * @param user The address of the user who withdrew
     * @param vault The address of the vault where the withdrawal was made
     * @param shares The number of shares burned from the user
     */
    function trackWithdrawal(address user, address vault, uint256 shares) external;
}
