import { useState, useCallback } from 'react';
import { formatUnits } from 'viem';
import { createRefiPoolSDK, USDC_MINT } from '../sdk';
import { PublicKey } from '@solana/web3.js';
import { useInitProgramVolt } from './useInitProgramVolt';
import { useSolanaConnection } from './useInitSolanaConnection';
import { WalletContext } from './useVoltActions';
import { useInitProgramSdk } from './useInitProgramSdk';

export function useVoltBalances(walletCtx: WalletContext, poolPda: PublicKey | null) {
  const USDC_DECIMALS = 6;
  const program = useInitProgramVolt().initProgram();
  const sdk = useInitProgramSdk(program, walletCtx);
  const [depositBalance, setDepositBalance] = useState('0');
  const [balanceVOLT, setBalanceVOLT] = useState('0');
  const [exchangeRate, setExchangeRate] = useState('0');
  const [withdrawFeeBPS, setWithdrawFeeBPS] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchBalances = useCallback(async () => {
    if (!poolPda || !sdk) return;

    setLoading(true);

    try {
      const poolState = await sdk.getPoolState(program, poolPda);

      setExchangeRate(poolState.currentExchangeRate);
      setWithdrawFeeBPS(poolState.config.withdrawalFeeBps);

      const iptMint = sdk.deriveIptMintPda(poolPda);

      const usdcBalance = await sdk.getTokenBalance(USDC_MINT);
      const iptBalance = await sdk.getTokenBalance(iptMint);

      setDepositBalance(
        formatUnits(BigInt(usdcBalance), USDC_DECIMALS)
      );

      setBalanceVOLT(
        formatUnits(BigInt(iptBalance), USDC_DECIMALS)
      );
    } catch (err) {
      console.error('Error fetching balances:', err);
    } finally {
      setLoading(false);
    }
  }, [poolPda, program, sdk]);

  return {
    depositBalance,
    balanceVOLT,
    exchangeRate,
    withdrawFeeBPS,
    fetchBalances,
    loading,
  };
}