import { useState, useCallback } from 'react';
import { formatUnits } from 'viem';
import { createRefiPoolSDK, USDC_MINT } from '../sdk';
import { Connection, PublicKey } from '@solana/web3.js';
import { useInitProgramVolt } from './useInitProgramVolt';
import { useSolanaConnection } from './useInitSolanaConnection';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useVoltBalances(walletCtx: any, poolPda: PublicKey) {
  const USDC_DECIMALS = 6;
  const connection = useSolanaConnection();
  const [depositBalance, setDepositBalance] = useState('0');
  const [balanceVOLT, setBalanceVOLT] = useState('0');
  const [exchangeRate, setExchangeRate] = useState('0');
  const [withdrawFeeBPS, setWithdrawFeeBPS] = useState(0);
  const [loading, setLoading] = useState(false);

  // ✅ call hook at top level
  const { initProgram } = useInitProgramVolt();

  const fetchBalances = useCallback(async () => {
    setLoading(true);

    try {
      const program = await initProgram();
      const sdk = createRefiPoolSDK({
        program,
        connection,
        wallet: walletCtx,
      });

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
  }, [walletCtx, poolPda, initProgram, connection]);

  return {
    depositBalance,
    balanceVOLT,
    exchangeRate,
    withdrawFeeBPS,
    fetchBalances,
    loading,
  };
}