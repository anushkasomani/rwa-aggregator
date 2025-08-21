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

    ReentrancyState private _emergencyState;
    mapping(address => ReentrancyState) private _userOperations;
    mapping(ReentrancyState => bool) private _operationActive;
    bool private _globalEmergencyLock;

    event ReentrancyDetected(address user, ReentrancyState state);

    modifier nonReentrantOperation(ReentrancyState requiredState) {
        require(!_globalEmergencyLock, "Emergency lock active");
        require(_userOperations[msg.sender] == ReentrancyState.NONE, "User operation in progress");
        
        // Prevent conflicting operations (e.g., rebalancing blocks all others)
        if (requiredState == ReentrancyState.REBALANCING) {
            require(!_operationActive[ReentrancyState.MINTING] && 
                    !_operationActive[ReentrancyState.REDEEMING], "Other operations active");
        } else if (requiredState == ReentrancyState.MINTING || requiredState == ReentrancyState.REDEEMING) {
            require(!_operationActive[ReentrancyState.REBALANCING], "Rebalancing in progress");
        }

        _userOperations[msg.sender] = requiredState;
        _operationActive[requiredState] = true;
        
        _;
        
        _operationActive[requiredState] = false;
        _userOperations[msg.sender] = ReentrancyState.NONE;
    }

    modifier emergencyOnly() {
        require(_emergencyState == ReentrancyState.EMERGENCY, "Emergency mode required");
        _;
    }

    function _activateEmergencyMode() internal {
        _emergencyState = ReentrancyState.EMERGENCY;
        _globalEmergencyLock = true;
    }

    function getCurrentState() external view returns (ReentrancyState) {
        return _emergencyState;
    }
    
    function getUserOperationState(address user) external view returns (ReentrancyState) {
        return _userOperations[user];
    }
    
    function isOperationActive(ReentrancyState operation) external view returns (bool) {
        return _operationActive[operation];
    }
}