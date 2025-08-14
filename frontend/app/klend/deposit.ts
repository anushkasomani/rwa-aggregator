import * as dotenv from 'dotenv';
import bs58 from 'bs58';
import { createSolanaRpc, createSolanaRpcFromTransport, createDefaultRpcTransport } from '@solana/kit';
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { KaminoAction, PROGRAM_ID, VanillaObligation, KaminoMarket } from '@kamino-finance/klend-sdk';
import BN from 'bn.js';

// Load environment variables
dotenv.config();

// Constants 
const MAIN_MARKET = new PublicKey('7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF');
const USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');

// Configuration
const CONFIG = {
  rpcEndpoint: process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com',
  secretKey: process.env.SECRET_KEY!,
  depositAmount: parseFloat(process.env.DEPOSIT_AMOUNT || '1'),
};

/**
 * Load wallet keypair from environment variable
 */
function loadWallet(): Keypair {
  if (!CONFIG.secretKey) {
    throw new Error('SECRET_KEY not found in environment variables');
  }

  try {
    // Try to decode as base58 first
    const secretKey = bs58.decode(CONFIG.secretKey);
    return Keypair.fromSecretKey(secretKey);
  } catch (error) {
    try {
      // If base58 fails, try parsing as JSON array
      const secretKeyArray = JSON.parse(CONFIG.secretKey);
      const secretKey = new Uint8Array(secretKeyArray);
      return Keypair.fromSecretKey(secretKey);
    } catch (jsonError) {
      throw new Error('Invalid SECRET_KEY format. Use base58 string or JSON array of bytes');
    }
  }
}

/**
 * Calculate median slot duration using recent available blocks
 */
async function getMedianSlotDurationInMsFromLastEpochs(rpc: any, samplesToCheck: number = 10): Promise<number> {
  try {
    console.log(`📊 Calculating slot duration from recent ${samplesToCheck} available blocks...`);
    
    // Get current slot
    const epochInfo = await rpc.getEpochInfo().send();
    const currentSlot = Number(epochInfo.absoluteSlot);
    
    const slotTimes: Array<{ slot: number; time: number }> = [];
    
    // Sample recent blocks that are more likely to be available
    for (let i = 1; i <= samplesToCheck * 3 && slotTimes.length < samplesToCheck; i++) {
      const slotToCheck = currentSlot - (i * 100); // Sample every 100 slots going back
      
      if (slotToCheck <= 0) break;
      
      try {
        const blockTime = await rpc.getBlockTime(slotToCheck).send();
        if (blockTime) {
          slotTimes.push({ slot: slotToCheck, time: blockTime });
          console.log(`📈 Slot ${slotToCheck}: ${new Date(blockTime * 1000).toISOString()}`);
        }
      } catch (error) {
        // Skip unavailable blocks silently - this is expected for old blocks
      }
    }
    
    if (slotTimes.length < 2) {
      console.warn('⚠️ Not enough block times found, using default 400ms');
      return 400; // Default Solana slot time
    }
    
    // Calculate slot durations between consecutive samples
    const durations: number[] = [];
    slotTimes.sort((a, b) => a.slot - b.slot); // Sort by slot number
    
    for (let i = 1; i < slotTimes.length; i++) {
      const slotDiff = slotTimes[i].slot - slotTimes[i-1].slot;
      const timeDiff = (slotTimes[i].time - slotTimes[i-1].time) * 1000; // Convert to ms
      const avgSlotDuration = timeDiff / slotDiff;
      
      // Only accept reasonable slot durations (200ms to 1000ms)
      if (avgSlotDuration >= 200 && avgSlotDuration <= 1000) {
        durations.push(avgSlotDuration);
      }
    }
    
    if (durations.length === 0) {
      console.warn('⚠️ No valid slot durations calculated, using default 400ms');
      return 400;
    }
    
    // Calculate median
    durations.sort((a, b) => a - b);
    const mid = Math.floor(durations.length / 2);
    const median = durations.length % 2 === 0 
      ? (durations[mid - 1] + durations[mid]) / 2
      : durations[mid];
    
    console.log(`✅ Median slot duration: ${median.toFixed(2)}ms (from ${durations.length} samples)`);
    return median;
  } catch (error) {
    console.warn('⚠️ Error calculating slot duration, using default 400ms:', error instanceof Error ? error.message : String(error));
    return 400; // Default fallback
  }
}

/**
 * Create compatibility wrapper for Kamino SDK
 * The Kamino SDK expects web3.js format, but @solana/kit uses different parameter format
 */
function createKaminoCompatibleRpc(kitRpc: any, connection: Connection) {
  return {
    // Convert @solana/kit RPC to format expected by Kamino SDK
    getAccountInfo: (pubkey: any, config?: any) => ({
      send: async () => {
        try {
          // Use web3.js connection directly for compatibility
          return await connection.getAccountInfo(pubkey, config?.commitment || 'confirmed');
        } catch (error) {
          console.error('getAccountInfo error:', error);
          throw error;
        }
      }
    }),
    
    getMultipleAccounts: (pubkeys: any[], config?: any) => ({
      send: async () => {
        try {
          const result = await connection.getMultipleAccountsInfo(pubkeys, config?.commitment || 'confirmed');
          return { value: result };
        } catch (error) {
          console.error('getMultipleAccounts error:', error);
          throw error;
        }
      }
    }),

    getProgramAccounts: (programId: any, config?: any) => ({
      send: async () => {
        try {
          const result = await connection.getProgramAccounts(programId, config);
          return { value: result };
        } catch (error) {
          console.error('getProgramAccounts error:', error);
          throw error;
        }
      }
    }),

    getLatestBlockhash: (config?: any) => ({
      send: async () => {
        try {
          const result = await connection.getLatestBlockhash(config?.commitment || 'confirmed');
          return { value: result };
        } catch (error) {
          console.error('getLatestBlockhash error:', error);
          throw error;
        }
      }
    }),

    getBalance: (pubkey: any, config?: any) => ({
      send: async () => {
        try {
          const result = await connection.getBalance(pubkey, config?.commitment || 'confirmed');
          return { value: result };
        } catch (error) {
          console.error('getBalance error:', error);
          throw error;
        }
      }
    }),

    getEpochInfo: (config?: any) => ({
      send: async () => {
        try {
          return await connection.getEpochInfo(config?.commitment || 'confirmed');
        } catch (error) {
          console.error('getEpochInfo error:', error);
          throw error;
        }
      }
    }),

    getBlockTime: (slot: number) => ({
      send: async () => {
        try {
          return await connection.getBlockTime(slot);
        } catch (error) {
          console.error('getBlockTime error:', error);
          throw error;
        }
      }
    }),

    // Properties that might be accessed directly
    commitment: connection.commitment,
    rpcEndpoint: connection.rpcEndpoint,
    
    // Make sure this behaves like a proper RPC client
    [Symbol.toStringTag]: 'KaminoCompatibleRpcClient'
  };
}

/**
 * Get connection using compatibility approach
 */
function getConnectionPool() {
  // Create both for different purposes
  const kitRpc = createSolanaRpc(CONFIG.rpcEndpoint);
  const connection = new Connection(CONFIG.rpcEndpoint, 'confirmed');
  
  // Create compatibility wrapper for Kamino SDK
  const rpc = createKaminoCompatibleRpc(kitRpc, connection);
  
  return {
    rpc,
    kitRpc, // Keep the original @solana/kit RPC for future use
    connection // Keep for transaction sending
  };
}

/**
 * Load reserve data (matching GitHub example pattern)
 */
async function loadReserveData(params: {
  rpc: any;
  connection: Connection;
  marketPubkey: PublicKey;
  mintPubkey: PublicKey;
}) {
  console.log(`🔍 Attempting to load market: ${params.marketPubkey.toString()}`);
  console.log(`🔧 Using PROGRAM_ID: ${PROGRAM_ID.toString()}`);
  
  // Verify market address for mainnet
  const expectedMainnetMarket = '7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF';
  if (params.marketPubkey.toString() !== expectedMainnetMarket) {
    console.warn(`⚠️ Using non-standard market address. Expected mainnet: ${expectedMainnetMarket}`);
  }
  
  try {
    // Calculate slot duration first
    const slotDuration = await getMedianSlotDurationInMsFromLastEpochs(params.rpc);
    console.log(`⏱️ Using slot duration: ${slotDuration}ms for timeout calculations`);
    
    console.log('🏪 Loading Kamino market...');
    // Kamino SDK requires the RPC with .send() methods and slot duration
    const market = await KaminoMarket.load(
      params.rpc, // Use our compatibility wrapper
      params.marketPubkey as any,
      slotDuration, // This was missing! It's required
      PROGRAM_ID as any,
      true // withReserves
    );
    
    // Enhanced null checking with detailed error messages
    if (!market) {
      const marketAccountInfo = await params.rpc.getAccountInfo(params.marketPubkey).send();
      
      if (!marketAccountInfo) {
        throw new Error(`❌ Market account does not exist at address: ${params.marketPubkey.toString()}. Please verify the market address for mainnet: ${expectedMainnetMarket}`);
      }
      
      if (marketAccountInfo.owner.toString() !== PROGRAM_ID.toString()) {
        throw new Error(`❌ Market account owner mismatch. Expected: ${PROGRAM_ID.toString()}, Found: ${marketAccountInfo.owner.toString()}`);
      }
      
      throw new Error(`❌ KaminoMarket.load() returned null despite account existing. This may indicate:
        1. RPC client incompatibility with @solana/kit
        2. Market data deserialization issue
        3. Incorrect PROGRAM_ID or market version mismatch
        
        Market Address: ${params.marketPubkey.toString()}
        Expected Program: ${PROGRAM_ID.toString()}
        Account Owner: ${marketAccountInfo.owner.toString()}
      `);
    }

    console.log('✅ Market loaded successfully');
    console.log('📊 Loading market reserves...');
    
    try {
      await market.loadReserves();
    } catch (reserveError) {
      throw new Error(`❌ Failed to load market reserves: ${reserveError instanceof Error ? reserveError.message : String(reserveError)}. This may indicate network issues or market state corruption.`);
    }
    
    // Find the reserve for the given mint
    const reserves = Array.from(market.getReserves().values());
    console.log(`🔍 Found ${reserves.length} reserves in market`);
    
    if (reserves.length === 0) {
      throw new Error(`❌ No reserves found in market. Market may be empty or corrupted.`);
    }
    
    const reserve = reserves.find(r => 
      r.getLiquidityMint().toString() === params.mintPubkey.toString()
    );
    
    if (!reserve) {
      const availableMints = reserves.map(r => r.getLiquidityMint().toString()).slice(0, 10);
      throw new Error(`❌ Reserve not found for mint: ${params.mintPubkey.toString()}
        
        Available mints in market (first 10):
        ${availableMints.map((mint, i) => `  ${i + 1}. ${mint}`).join('\n')}
        
        Total reserves: ${reserves.length}
        
        Please verify the USDT mint address. Expected mainnet USDT: Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`);
    }

    console.log(`✅ Found reserve for ${params.mintPubkey.toString()}`);
    return { market, reserve, slotDuration };
    
  } catch (error) {
    console.error('❌ Error in loadReserveData:', error);
    throw error;
  }
}

/**
 * Check USDT token balance
 */
async function checkUSDTBalance(connection: any, wallet: Keypair): Promise<number> {
  try {
    const { getAssociatedTokenAddress, getAccount } = await import('@solana/spl-token');
    
    const usdtTokenAccount = await getAssociatedTokenAddress(
      USDT_MINT,
      wallet.publicKey
    );

    const accountInfo = await getAccount(connection, usdtTokenAccount);
    const balance = Number(accountInfo.amount) / 1_000_000; // Convert from lamports to USDT (6 decimals)
    
    return balance;
  } catch (error) {
    console.log('💵 No USDT token account found or balance is 0');
    return 0;
  }
}

/**
 * Send and confirm transaction (matching GitHub example pattern)
 */
async function sendAndConfirmTx(
  connectionPool: { rpc: any; connection: any },
  wallet: Keypair,
  instructions: any[],
  signers: Keypair[],
  additionalSigners: Keypair[],
  label: string
) {
  const transaction = new Transaction();
  transaction.add(...instructions);
  
  const allSigners = [wallet, ...signers, ...additionalSigners];
  
  const txHash = await sendAndConfirmTransaction(
    connectionPool.connection, // Use the original connection for transaction sending
    transaction,
    allSigners,
    { commitment: 'confirmed' }
  );
  
  console.log(`✅ ${label} transaction confirmed:`, txHash);
  return txHash;
}

/**
 * Main function to deposit USDT to Kamino - Following GitHub example exactly
 */
async function depositUSDT() {
  console.log('🚀 Starting USDT deposit to Kamino...');
  console.log('🔧 Debug: Function started');
  console.log('🔧 Environment check:', {
    hasSecretKey: !!CONFIG.secretKey,
    rpcEndpoint: CONFIG.rpcEndpoint,
    depositAmount: CONFIG.depositAmount
  });

  try {
    const c = getConnectionPool();
    const wallet = loadWallet();
    console.log(`✅ Wallet loaded: ${wallet.publicKey.toString()}`);

    // Check SOL balance
    const solBalance = await c.connection.getBalance(wallet.publicKey);
    console.log(`💰 SOL Balance: ${(solBalance / 1e9).toFixed(4)} SOL`);
    
    if (solBalance < 1e6) { // Less than 0.001 SOL
      throw new Error('Insufficient SOL balance for transaction fees');
    }

    // Check USDT balance
    console.log('💵 Checking USDT balance...');
    const usdtBalance = await checkUSDTBalance(c.connection, wallet);
    console.log(`💰 USDT Balance: ${usdtBalance.toFixed(6)} USDT`);
    
    if (usdtBalance < CONFIG.depositAmount) {
      throw new Error(`Insufficient USDT balance. Have: ${usdtBalance} USDT, Need: ${CONFIG.depositAmount} USDT`);
    }

    console.log('📊 Loading market and reserve data...');
    const { market, reserve: usdtReserve, slotDuration } = await loadReserveData({
      rpc: c.rpc,
      connection: c.connection,
      marketPubkey: MAIN_MARKET,
      mintPubkey: USDT_MINT,
    });

    console.log(`✅ Found USDT reserve: ${usdtReserve.getLiquidityMint().toString()}`);

    // Convert amount to base units (USDT has 6 decimals)
    const amount = new BN(CONFIG.depositAmount * 1_000_000); // 1 USDT * 10^6 decimals
    console.log(`💵 Depositing ${CONFIG.depositAmount} USDT (${amount.toString()} base units)`);

    console.log('🔨 Building deposit transaction...');
    // Use calculated slot duration for better timeout estimation
    const timeoutMs = Math.max(300_000, slotDuration * 100); // At least 100 slots worth of time
    console.log(`⏱️ Using timeout: ${timeoutMs}ms (based on ${slotDuration}ms slot duration)`);
    
    const depositAction = await KaminoAction.buildDepositReserveLiquidityTxns(
      market,
      amount,
      usdtReserve.getLiquidityMint(),
      wallet as any,
      new VanillaObligation(PROGRAM_ID),
      undefined,
      timeoutMs,
      true
    );

    console.log('depositAction.computeBudgetIxsLabels', depositAction.computeBudgetIxsLabels);
    console.log('depositAction.setupIxsLabels', depositAction.setupIxsLabels);
    console.log('depositAction.lendingIxsLabels', depositAction.lendingIxsLabels);
    console.log('depositAction.cleanupIxsLabels', depositAction.cleanupIxsLabels);

    console.log('✍️ Signing and sending transaction...');
    const txHash = await sendAndConfirmTx(
      c,
      wallet,
      [
        ...depositAction.computeBudgetIxs,
        ...depositAction.setupIxs,
        ...depositAction.lendingIxs,
        ...depositAction.cleanupIxs,
      ],
      [],
      [],
      'deposit'
    );

    console.log('✅ Deposit completed successfully!');
    console.log(`🔗 Explorer: https://explorer.solana.com/tx/${txHash}`);
    console.log(`💰 Successfully deposited ${CONFIG.depositAmount} USDT to Kamino`);

  } catch (error) {
    console.error('❌ Error during deposit:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('insufficient funds') || error.message.includes('insufficient lamports')) {
        console.error('💡 Make sure you have enough USDT and SOL in your wallet');
      } else if (error.message.includes('SECRET_KEY')) {
        console.error('💡 Check your .env file and SECRET_KEY format');
      }
    }
    
    process.exit(1);
  }
}

// Run the script (matching GitHub example pattern)
console.log('🔧 Script starting...');
(async () => {
  console.log('🔧 Async wrapper started');
  await depositUSDT();
})().catch(async (e) => {
  console.error('🔧 Top-level error caught:', e);
});

export { depositUSDT };