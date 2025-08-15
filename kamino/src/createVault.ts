import { getConnectionPool } from './utils/connection';
import { KaminoVaultConfig } from './../src/classes/vault';
import { USDC_MINT } from './utils/constants';
import Decimal from 'decimal.js/decimal';
import { getMedianSlotDurationInMsFromLastEpochs, KaminoManager, sleep } from '@kamino-finance/klend-sdk';
import { TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import { Address, address, createTransactionMessage, appendTransactionMessageInstructions, setTransactionMessageFeePayer, setTransactionMessageLifetimeUsingBlockhash, compileTransaction, getBase64EncodedWireTransaction, pipe } from '@solana/kit';
import { fetchBlockhash } from './utils/tx';

export interface CreateVaultParams {
  userWallet: string; // User's wallet address from browser
  tokenMint?: string;
  performanceFeeRatePercentage?: number;
  managementFeeRatePercentage?: number;
  name: string;
  vaultTokenSymbol: string;
  vaultTokenName: string;
}

export interface PreparedTransaction {
  transaction: string; // Base64 encoded transaction
  message: string;
}

export interface CreateVaultResult {
  success: boolean;
  preparedTransactions?: {
    initVault: PreparedTransaction;
    populateLUT: PreparedTransaction;
  };
  error?: string;
}

export async function prepareCreateVaultTransactions(params: CreateVaultParams): Promise<CreateVaultResult> {
  try {
    const c = getConnectionPool();
    const slotDuration = await getMedianSlotDurationInMsFromLastEpochs();
    const kaminoManager = new KaminoManager(c.rpc, slotDuration);

    const userWalletAddress = address(params.userWallet);
    const tokenMintAddress: Address = params.tokenMint 
      ? address(params.tokenMint) 
      : USDC_MINT;

    // Create vault config with user as admin
    const kaminoVaultConfig = new KaminoVaultConfig({
      admin: { address: userWalletAddress } as any, // Will need proper typing
      tokenMint: tokenMintAddress,
      tokenMintProgramId: TOKEN_PROGRAM_ADDRESS,
      performanceFeeRatePercentage: new Decimal(params.performanceFeeRatePercentage || 1.0),
      managementFeeRatePercentage: new Decimal(params.managementFeeRatePercentage || 2.0),
      name: params.name,
      vaultTokenSymbol: params.vaultTokenSymbol,
      vaultTokenName: params.vaultTokenName
    });

    const { initVaultIxs: instructions } = await kaminoManager.createVaultIxs(kaminoVaultConfig);
    const blockhash = await fetchBlockhash(c.rpc);

    // Prepare first transaction (InitVault) using pipe function
    const initVaultTx = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => appendTransactionMessageInstructions([
        ...instructions.createAtaIfNeededIxs,
        ...instructions.initVaultIxs,
        instructions.createLUTIx,
        instructions.initSharesMetadataIx,
      ], tx),
      (tx) => setTransactionMessageFeePayer(userWalletAddress, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
      (tx) => compileTransaction(tx),
      (tx) => getBase64EncodedWireTransaction(tx)
    );

    // Prepare second transaction (PopulateLUT) using pipe function
    const populateLUTTx = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => appendTransactionMessageInstructions(instructions.populateLUTIxs, tx),
      (tx) => setTransactionMessageFeePayer(userWalletAddress, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
      (tx) => compileTransaction(tx),
      (tx) => getBase64EncodedWireTransaction(tx)
    );

    return {
      success: true,
      preparedTransactions: {
        initVault: {
          transaction: initVaultTx,
          message: 'Initialize Vault, LUT, and Metadata'
        },
        populateLUT: {
          transaction: populateLUTTx,
          message: 'Populate Lookup Table'
        }
      }
    };

  } catch (error) {
    console.error('Error preparing vault transactions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

