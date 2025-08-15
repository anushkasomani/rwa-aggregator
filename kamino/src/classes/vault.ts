
import { Address, TransactionSigner } from '@solana/kit';
import Decimal from 'decimal.js';


export class KaminoVaultConfig {
  /** The admin of the vault */
  readonly admin: TransactionSigner;
  /** The token mint for the vault */
  readonly tokenMint: Address;
  /** The token mint program id */
  readonly tokenMintProgramId: Address;
  /** The performance fee rate of the vault, as percents, expressed as a decimal */
  readonly performanceFeeRatePercentage: Decimal;
  /** The management fee rate of the vault, as percents, expressed as a decimal */
  readonly managementFeeRatePercentage: Decimal;
  /** The name to be stored on chain for the vault (max 40 characters). */
  readonly name: string;
  /** The symbol of the vault token to be stored (max 5 characters). E.g. USDC for a vault using USDC as token. */
  readonly vaultTokenSymbol: string;
  /** The name of the vault token to be stored (max 10 characters), after the prefix `Kamino Vault <vaultTokenSymbol>`. E.g. USDC Vault for a vault using USDC as token. */
  readonly vaultTokenName: string;
  constructor(args: {
    admin: TransactionSigner;
    tokenMint: Address;
    tokenMintProgramId: Address;
    performanceFeeRatePercentage: Decimal;
    managementFeeRatePercentage: Decimal;
    name: string;
    vaultTokenSymbol: string;
    vaultTokenName: string;
  }) {
    this.admin = args.admin;
    this.tokenMint = args.tokenMint;
    this.performanceFeeRatePercentage = args.performanceFeeRatePercentage;
    this.managementFeeRatePercentage = args.managementFeeRatePercentage;
    this.tokenMintProgramId = args.tokenMintProgramId;
    this.name = args.name;
    this.vaultTokenSymbol = args.vaultTokenSymbol;
    this.vaultTokenName = args.vaultTokenName;
  }

  getPerformanceFeeBps(): number {
    return this.performanceFeeRatePercentage.mul(100).toNumber();
  }

  getManagementFeeBps(): number {
    return this.managementFeeRatePercentage.mul(100).toNumber();
  }
}
