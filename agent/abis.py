#!/usr/bin/env python3
"""
Contract ABIs for RWA Aggregator Bot
====================================
Contains all the ABI definitions for the contracts used by the executor bot.
"""

# Basic ERC20 ABI
ERC20_ABI = [
    {"constant":True, "inputs":[], "name":"decimals","outputs":[{"name":"","type":"uint8"}], "stateMutability":"view","type":"function"},
    {"constant":True, "inputs":[], "name":"symbol","outputs":[{"name":"","type":"string"}], "stateMutability":"view","type":"function"},
    {"constant":True, "inputs":[{"name":"account","type":"address"}], "name":"balanceOf","outputs":[{"name":"","type":"uint256"}], "stateMutability":"view","type":"function"},
    {"constant":True, "inputs":[{"name":"owner","type":"address"},{"name":"spender","type":"address"}], "name":"allowance","outputs":[{"name":"","type":"uint256"}], "stateMutability":"view","type":"function"},
    {"constant":False, "inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}], "name":"approve","outputs":[{"name":"","type":"bool"}], "stateMutability":"nonpayable","type":"function"},
    {"constant":True, "inputs":[], "name":"totalSupply","outputs":[{"name":"","type":"uint256"}], "stateMutability":"view","type":"function"}
]

# MultiAssetVault ABI
MULTI_ASSET_VAULT_ABI = [
    # ERC20 functions (inherited)
    {"constant":True, "inputs":[{"name":"account","type":"address"}], "name":"balanceOf","outputs":[{"name":"","type":"uint256"}], "stateMutability":"view","type":"function"},
    {"constant":True, "inputs":[], "name":"totalSupply","outputs":[{"name":"","type":"uint256"}], "stateMutability":"view","type":"function"},
    
    # Vault view functions
    {"inputs":[],"name":"getTotalValue","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"getPendingDeposits","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"getPendingRedemptions","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"pendingUSDC","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"deployedUSDC","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"getBasketAssets","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"address","name":"asset","type":"address"}],"name":"getAssetAllocation","outputs":[{"internalType":"uint256","name":"weight","type":"uint256"},{"internalType":"uint256","name":"balance","type":"uint256"},{"internalType":"bool","name":"isActive","type":"bool"}],"stateMutability":"view","type":"function"},
    
    # Bot management functions
    {"inputs":[],"name":"processDepositQueue","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"processRedemptionQueue","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"asset","type":"address"},{"internalType":"uint256","name":"usdcAmount","type":"uint256"}],"name":"deployCapital","outputs":[{"internalType":"uint256","name":"assetAmount","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"asset","type":"address"},{"internalType":"uint256","name":"assetAmount","type":"uint256"}],"name":"liquidateAsset","outputs":[{"internalType":"uint256","name":"usdcReceived","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256[]","name":"assetPrices","type":"uint256[]"}],"name":"updateNAV","outputs":[],"stateMutability":"nonpayable","type":"function"},
    
    # User functions  
    {"inputs":[{"internalType":"uint256","name":"usdcAmount","type":"uint256"}],"name":"deposit","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"shareAmount","type":"uint256"}],"name":"requestRedemption","outputs":[],"stateMutability":"nonpayable","type":"function"}
]


# OrderRouter ABI (TraderJoe LBRouter based)
ORDER_ROUTER_ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "tokenIn", "type": "address"},
            {"internalType": "address", "name": "tokenOut", "type": "address"},
            {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
            {"internalType": "uint256", "name": "minAmountOut", "type": "uint256"}
        ],
        "name": "swap",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "tokenIn", "type": "address"},
            {"internalType": "address", "name": "tokenOut", "type": "address"},
            {"internalType": "uint256", "name": "amountIn", "type": "uint256"}
        ],
        "name": "swapNoSlippage",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "tokenA", "type": "address"},
            {"internalType": "address", "name": "tokenB", "type": "address"},
            {"internalType": "uint256", "name": "binStep", "type": "uint256"}
        ],
        "name": "setPairBinStep",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

# OracleAggregator ABI (includes both Chainlink and custom functions)
ORACLE_AGGREGATOR_ABI = [
    # Standard Chainlink functions
    {"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"latestRoundData","outputs":[
        {"internalType":"uint80","name":"roundId","type":"uint80"},
        {"internalType":"int256","name":"price","type":"int256"},
        {"internalType":"uint256","name":"startedAt","type":"uint256"},
        {"internalType":"uint256","name":"updatedAt","type":"uint256"},
        {"internalType":"uint80","name":"answeredInRound","type":"uint80"}
    ],"stateMutability":"view","type":"function"},
    
    # Custom oracle functions
    {
        "inputs": [{"internalType": "address", "name": "_asset", "type": "address"}],
        "name": "getPrice",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getPriceIn18Decimals",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint8", "name": "targetDecimals", "type": "uint8"}],
        "name": "getPriceWithDecimals",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getDecimals",
        "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getDescription",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    }
]

# Legacy Uniswap V3 Quoter ABI (if still needed for price quotes)
UNIV3_QUOTER_ABI = [
    {
      "inputs": [
        {"internalType":"address","name":"tokenIn","type":"address"},
        {"internalType":"address","name":"tokenOut","type":"address"},
        {"internalType":"uint256","name":"amountIn","type":"uint256"},
        {"internalType":"uint24","name":"fee","type":"uint24"},
        {"internalType":"uint160","name":"sqrtPriceLimitX96","type":"uint160"}
      ],
      "name": "quoteExactInputSingle",
      "outputs": [{"internalType":"uint256","name":"amountOut","type":"uint256"}],
      "stateMutability": "nonpayable",
      "type": "function"
    }
]

# Backward compatibility aliases
CHAINLINK_AGG_ABI = ORACLE_AGGREGATOR_ABI  # For backward compatibility
UNIV3_ROUTER_ABI = ORDER_ROUTER_ABI        # Will be updated in bot.py