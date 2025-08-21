// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IBasketController {
    function onTokenTransfer(address from, address to, uint256 amount) external;
    function getBasketComposition() external view returns (address[] memory, uint256[] memory);
    function calculateNAV() external view returns (uint256);
    function isValidUser(address user) external view returns (bool);
}
