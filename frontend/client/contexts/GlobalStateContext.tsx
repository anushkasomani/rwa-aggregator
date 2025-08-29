import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export interface GlobalState {
  app: {
    network: string;
    receiptsOpen: boolean;
    receipts: any[];
    positions: any[];
    loadingReceipts: boolean;
    toast: {
      type: 'success' | 'error' | 'info';
      text: string;
    } | null;
  };
  explore: {
    filters: {
      theme: string;
      risk: string;
      gates: string[];
      yield: string;
      chain: string;
      manager: string;
    };
    sort: string;
    items: any[];
    loading: boolean;
  };
  vault: {
    id: string | null;
    data: any | null;
    loading: boolean;
    tabs: string;
    depositAmount: string;
    estShares: number;
    creating: boolean;
  };
  builder: {
    text: string;
    loading: boolean;
    error: string | null;
    plan: any | null;
    preview: any | null;
    backtest: any | null;
    basketName: string;
    overrides: any;
    publish: {
      chain: string;
      asset: string;
      fees: any;
    };
    publishing: boolean;
  };
  port: {
    loading: boolean;
    positions: any[];
    receipts: any[];
  };
}

const initialState: GlobalState = {
  app: {
    network: 'base',
    receiptsOpen: false,
    receipts: [],
    positions: [],
    loadingReceipts: false,
    toast: null
  },
  explore: {
    filters: {
      theme: 'all',
      risk: 'all',
      gates: [],
      yield: 'all',
      chain: 'all',
      manager: 'all'
    },
    sort: 'ytd',
    items: [],
    loading: true
  },
  vault: {
    id: null,
    data: null,
    loading: true,
    tabs: 'equity',
    depositAmount: '',
    estShares: 0,
    creating: false
  },
  builder: {
    text: '',
    loading: false,
    error: null,
    plan: null,
    preview: null,
    backtest: null,
    basketName: '',
    overrides: {},
    publish: {
      chain: 'base',
      asset: 'USDC',
      fees: {}
    },
    publishing: false
  },
  port: {
    loading: true,
    positions: [],
    receipts: []
  }
};

interface GlobalStateContextType {
  state: GlobalState;
  updateState: (updater: (state: GlobalState) => GlobalState) => void;
}

const GlobalStateContext = createContext<GlobalStateContextType | undefined>(undefined);

export function GlobalStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GlobalState>(initialState);

  const updateState = useCallback((updater: (state: GlobalState) => GlobalState) => {
    setState(updater);
  }, []);

  return (
    <GlobalStateContext.Provider value={{ state, updateState }}>
      {children}
    </GlobalStateContext.Provider>
  );
}

export function useGlobalState() {
  const context = useContext(GlobalStateContext);
  if (context === undefined) {
    throw new Error('useGlobalState must be used within a GlobalStateProvider');
  }
  return context;
}

// Helper hooks for specific state sections
export function useAppState() {
  const { state, updateState } = useGlobalState();
  return {
    ...state.app,
    updateApp: (updates: Partial<GlobalState['app']>) => 
      updateState(s => ({ ...s, app: { ...s.app, ...updates } }))
  };
}

export function useExploreState() {
  const { state, updateState } = useGlobalState();
  return {
    ...state.explore,
    updateExplore: (updates: Partial<GlobalState['explore']>) => 
      updateState(s => ({ ...s, explore: { ...s.explore, ...updates } }))
  };
}

export function useVaultState() {
  const { state, updateState } = useGlobalState();
  return {
    ...state.vault,
    updateVault: (updates: Partial<GlobalState['vault']>) => 
      updateState(s => ({ ...s, vault: { ...s.vault, ...updates } }))
  };
}

export function useBuilderState() {
  const { state, updateState } = useGlobalState();
  return {
    ...state.builder,
    updateBuilder: (updates: Partial<GlobalState['builder']>) => 
      updateState(s => ({ ...s, builder: { ...s.builder, ...updates } }))
  };
}

export function usePortfolioState() {
  const { state, updateState } = useGlobalState();
  return {
    ...state.port,
    updatePortfolio: (updates: Partial<GlobalState['port']>) => 
      updateState(s => ({ ...s, port: { ...s.port, ...updates } }))
  };
}
