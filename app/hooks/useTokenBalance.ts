// SPDX-License-Identifier: Apache-2.0

import { useState, useCallback, useMemo } from 'react';
import { formatUnits } from 'viem';
import { USDC_DECIMALS, USDC_MINT } from '../sdk';
import { PublicKey } from '@solana/web3.js';
import { WalletContext } from './useTokenActions';
import { useInitProgramSdk } from './useInitProgramSdk';
import { useInitProgramToken } from './useInitProgramToken';

export function useTokenBalances(walletCtx: WalletContext, poolPda: PublicKey | null) {
  const { initProgram } = useInitProgramToken();
  const program = useMemo(() => {
    return initProgram();
  }, []);
  const sdk = useInitProgramSdk(program, walletCtx);
  const [depositBalance, setDepositBalance] = useState('0');
  const [balanceTOKEN, setBalanceTOKEN] = useState('0');
  const [loading, setLoading] = useState(false);

  const fetchBalances = useCallback(async () => {
    if (!poolPda || !sdk) return;

    setLoading(true);

    try {
      const iptMint = sdk.deriveIptMintPda(poolPda);
      const usdcBalance = await sdk.getTokenBalance(USDC_MINT);
      const iptBalance = await sdk.getTokenBalance(iptMint);
      console.log(usdcBalance);
      setDepositBalance(
        formatUnits(BigInt(usdcBalance), USDC_DECIMALS)
      );

      setBalanceTOKEN(
        formatUnits(BigInt(iptBalance), USDC_DECIMALS)
      );
    } catch (err) {
      console.error('Error fetching balances:', err);
    } finally {
      setLoading(false);
    }
  }, [poolPda, sdk]);

  return {
    depositBalance,
    balanceTOKEN,
    fetchBalances,
    loading,
  };
}