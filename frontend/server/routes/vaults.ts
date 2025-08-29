import { RequestHandler } from "express";

// Mock vault data
const mockVaults = [
  {
    id: "ew-btc-eth",
    title: "EW BTC/ETH (gated)",
    subtitle: "Trend, volume, sentiment gates",
    badges: ["Async 7540", "Sentiment-aware"],
    risk: "Medium",
    stats: {
      pps: 1.034,
      d30: 0.042,
      ytd: 0.187,
      maxDD: -0.091,
      fees: {
        mgmt: "1.5%",
        perf: "15%"
      }
    }
  },
  {
    id: "real-estate-diversified",
    title: "Real Estate Diversified",
    subtitle: "Global REIT exposure with momentum signals",
    badges: ["Yield On", "Geographic diversification"],
    risk: "Low",
    stats: {
      pps: 1.156,
      d30: 0.023,
      ytd: 0.089,
      maxDD: -0.045,
      fees: {
        mgmt: "1.2%",
        perf: "10%"
      }
    }
  },
  {
    id: "commodities-trend",
    title: "Commodities Trend Following",
    subtitle: "Momentum-based commodity exposure",
    badges: ["Async 7540", "Inflation hedge"],
    risk: "High",
    stats: {
      pps: 0.967,
      d30: -0.018,
      ytd: 0.234,
      maxDD: -0.156,
      fees: {
        mgmt: "1.8%",
        perf: "18%"
      }
    }
  }
];

const mockVaultDetails = {
  "ew-btc-eth": {
    id: "ew-btc-eth",
    title: "EW BTC/ETH (gated)",
    accountingAsset: "USDC",
    status: "ACCEPTING",
    metrics: {
      nav: 1234567,
      pps: 1.034,
      shares: 1194000
    },
    charts: {
      equity: [
        { t: "2024-01-01", v: 1000000 },
        { t: "2024-02-01", v: 1050000 },
        { t: "2024-03-01", v: 940000 }
      ],
      drawdown: [
        { t: "2024-01-01", v: 0 },
        { t: "2024-02-01", v: -0.02 },
        { t: "2024-03-01", v: -0.06 }
      ],
      allocations: [
        { t: "2024-01-01", BTC: 0.5, ETH: 0.5 },
        { t: "2024-02-01", BTC: 0.52, ETH: 0.48 },
        { t: "2024-03-01", BTC: 0.5, ETH: 0.5 }
      ]
    },
    explain: [
      {
        asset: "BTC",
        trend: true,
        volume: true,
        sentiment: 0.31,
        current: 0.52,
        target: 0.5
      },
      {
        asset: "ETH",
        trend: true,
        volume: false,
        sentiment: 0.22,
        current: 0.48,
        target: 0.5
      }
    ],
    safety: {
      feeCaps: {
        entry: "≤1%",
        exit: "≤0.5%",
        mgmt: "≤2% APR",
        perf: "≤20% HWM"
      },
      roles: [
        {
          contract: "UniswapV3Router",
          fn: "exactInputSingle",
          slippageBpsMax: 80,
          orderMaxUSD: 2000
        }
      ],
      timelock: {
        pending: []
      },
      guardian: {
        paused: false
      }
    }
  }
};

export const handleGetVaults: RequestHandler = (req, res) => {
  const { theme, risk, chain, manager, yield: yieldFilter } = req.query;
  
  let filteredVaults = mockVaults;

  // Apply filters
  if (theme && theme !== 'all') {
    filteredVaults = filteredVaults.filter(vault => 
      vault.title.toLowerCase().includes(theme as string)
    );
  }

  if (risk && risk !== 'all') {
    filteredVaults = filteredVaults.filter(vault => 
      vault.risk.toLowerCase() === (risk as string).toLowerCase()
    );
  }

  res.json({
    items: filteredVaults
  });
};

export const handleGetVault: RequestHandler = (req, res) => {
  const { id } = req.params;
  
  const vault = mockVaultDetails[id as keyof typeof mockVaultDetails];
  
  if (!vault) {
    return res.status(404).json({ error: 'Vault not found' });
  }

  res.json(vault);
};

export const handleCreateDeposit: RequestHandler = (req, res) => {
  const { id } = req.params;
  const { amount, asset } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const receipt = {
    id: `receipt-${Date.now()}`,
    vaultId: id,
    vaultName: mockVaults.find(v => v.id === id)?.title || `Vault ${id}`,
    type: 'DEPOSIT',
    status: 'PENDING',
    amount: amount,
    asset: asset || 'USDC',
    estimatedShares: (amount / 1.034).toFixed(6),
    createdAt: new Date().toISOString()
  };

  res.json({
    receipt
  });
};

export const handleCreateVault: RequestHandler = (req, res) => {
  const { name, plan, config, publish } = req.body;

  if (!name || !plan) {
    return res.status(400).json({ error: 'Name and plan are required' });
  }

  const newVaultId = `vault-${Date.now()}`;

  res.json({
    vaultId: newVaultId,
    message: 'Vault created successfully'
  });
};
