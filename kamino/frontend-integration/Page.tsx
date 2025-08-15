'use client';

import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Transaction, VersionedTransaction } from '@solana/web3.js';

interface CreateVaultFormData {
  name: string;
  vaultTokenSymbol: string;
  vaultTokenName: string;
  performanceFeeRatePercentage: number;
  managementFeeRatePercentage: number;
}

export default function CreateVaultForm() {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const { connection } = useConnection();
  
  const [formData, setFormData] = useState<CreateVaultFormData>({
    name: '',
    vaultTokenSymbol: '',
    vaultTokenName: '',
    performanceFeeRatePercentage: 1.0,
    managementFeeRatePercentage: 2.0,
  });
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!publicKey || !signAllTransactions) {
      alert('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Step 1: Prepare transactions on backend
      const response = await fetch('/api/prepare-vault', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          userWallet: publicKey.toString(),
        }),
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }

      // Step 2: Decode and sign transactions in browser
      const initVaultTxBuffer = Buffer.from(data.preparedTransactions.initVault.transaction, 'base64');
      const populateLUTTxBuffer = Buffer.from(data.preparedTransactions.populateLUT.transaction, 'base64');
      
      const initVaultTx = VersionedTransaction.deserialize(initVaultTxBuffer);
      const populateLUTTx = VersionedTransaction.deserialize(populateLUTTxBuffer);

      // Step 3: Sign transactions with user's wallet
      const signedTransactions = await signAllTransactions([initVaultTx, populateLUTTx]);

      // Step 4: Send transactions
      console.log('Sending init vault transaction...');
      const initSignature = await connection.sendTransaction(signedTransactions[0]);
      await connection.confirmTransaction(initSignature);
      console.log('✅ Init vault transaction confirmed:', initSignature);

      // Wait a bit for LUT to be created
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('Sending populate LUT transaction...');
      const populateSignature = await connection.sendTransaction(signedTransactions[1]);
      await connection.confirmTransaction(populateSignature);
      console.log('✅ Populate LUT transaction confirmed:', populateSignature);

      setResult({
        success: true,
        data: {
          initVaultSignature: initSignature,
          populateLUTSignature: populateSignature,
        }
      });

    } catch (error) {
      console.error('Error creating vault:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create vault'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value
    }));
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Create Kamino Vault</h2>
      
      {/* Wallet Connection */}
      <div className="mb-6">
        <WalletMultiButton className="w-full" />
      </div>

      {publicKey && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Vault Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Token Symbol *
            </label>
            <input
              type="text"
              name="vaultTokenSymbol"
              value={formData.vaultTokenSymbol}
              onChange={handleInputChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Token Name *
            </label>
            <input
              type="text"
              name="vaultTokenName"
              value={formData.vaultTokenName}
              onChange={handleInputChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Performance Fee Rate (%)
            </label>
            <input
              type="number"
              name="performanceFeeRatePercentage"
              value={formData.performanceFeeRatePercentage}
              onChange={handleInputChange}
              step="0.1"
              min="0"
              max="100"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Management Fee Rate (%)
            </label>
            <input
              type="number"
              name="managementFeeRatePercentage"
              value={formData.managementFeeRatePercentage}
              onChange={handleInputChange}
              step="0.1"
              min="0"
              max="100"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating Vault...' : 'Create Vault'}
          </button>
        </form>
      )}

      {result && (
        <div className={`mt-4 p-4 rounded-md ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {result.success ? (
            <div>
              <p className="font-semibold">✅ Vault Created Successfully!</p>
              <p className="text-sm mt-2">Init Signature: {result.data.initVaultSignature}</p>
              <p className="text-sm">Populate LUT Signature: {result.data.populateLUTSignature}</p>
            </div>
          ) : (
            <p>❌ Error: {result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}