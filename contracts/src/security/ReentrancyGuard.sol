// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// ===================================================================
// 1. ENHANCED REENTRANCY GUARD
// ===================================================================

/**
 * @title Enhanced ReentrancyGuard for multi-token operations
 * @dev Protects against single and cross-token reentrancy attacks
 */
abstract contract EnhancedReentrancyGuard {
    enum ReentrancyState {
        NONE,
        MINTING,
        REDEEMING,
        REBALANCING,
        EMERGENCY
    }

    ReentrancyState private _state;
    mapping(address => uint256) private _userLocks;
    bool private _globalLock;

    event ReentrancyDetected(address user, ReentrancyState state);

    modifier nonReentrantOperation(ReentrancyState requiredState) {
        require(_state == ReentrancyState.NONE, "Operation in progress");
        require(_userLocks[msg.sender] == 0, "User operation locked");
        require(!_globalLock, "Global lock active");

        _state = requiredState;
        _userLocks[msg.sender] = 1;
        _globalLock = true;
        
        _;
        
        _globalLock = false;
        _userLocks[msg.sender] = 0;
        _state = ReentrancyState.NONE;
    }

    modifier emergencyOnly() {
        require(_state == ReentrancyState.EMERGENCY, "Emergency mode required");
        _;
    }

    function _activateEmergencyMode() internal {
        _state = ReentrancyState.EMERGENCY;
        _globalLock = true;
    }

    function getCurrentState() external view returns (ReentrancyState) {
        return _state;
    }
}