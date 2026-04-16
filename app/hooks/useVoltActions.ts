import { PublicKey, Transaction } from '@solana/web3.js';
import { useState, useMemo, useCallback } from 'react';
import { useInitProgramVolt } from './useInitProgramVolt';
import { useInitProgramSdk } from './useInitProgramSdk';
// import { USDC_MINT } from '../sdk';

export interface WalletContext {
  publicKey: PublicKey | null;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signAllTransactions?: (txs: Transaction[]) => Promise<Transaction[]>;
}

export interface PoolContext {
  exchangeRate: number;   // already parsed
  withdrawFeeBPS: number;
  pendingFeeReserve: PublicKey; // already parsed
}

export function useVoltActions(poolCtx: PoolContext, walletCtx: WalletContext, poolPda: PublicKey) {
  const USDC_DECIMALS = 6;
  const program = useInitProgramVolt().initProgram();
  const sdk = useInitProgramSdk(program, walletCtx);
  const [amountDeposit, setAmountDeposit] = useState(0);
  const [amountWithdraw, setAmountWithdraw] = useState(0);
  const [loading, setLoading] = useState(false);

  // ✅ computed → useMemo
  const minReceiveDeposit = useMemo(() => {
    return (
      (amountDeposit * 10 ** USDC_DECIMALS) /
      Number(poolCtx.exchangeRate || 1)
    );
  }, [amountDeposit, poolCtx.exchangeRate]);

  const minReceiveWithdraw = useMemo(() => {
    const gross =
      (amountWithdraw * Number(poolCtx.exchangeRate)) /
      10 ** USDC_DECIMALS;

    const fee = (gross * poolCtx.withdrawFeeBPS) / 10_000;

    return gross - fee;
  }, [amountWithdraw, poolCtx.exchangeRate, poolCtx.withdrawFeeBPS]);

  // =========================
  // Deposit
  // =========================
  const deposit = useCallback(async () => {
    if (amountDeposit <= 0) return;

    setLoading(true);

    try {
      if (!sdk) {
        throw new Error('SDK not initialized');
      }
      const signature = await sdk.userDeposit(
        poolPda,
        poolPda,
        poolCtx.pendingFeeReserve,
        Math.floor(amountDeposit * 10 ** USDC_DECIMALS).toString(),
        '0'
      );

      return signature;
    } finally {
      setLoading(false);
    }
  }, [amountDeposit, poolPda, sdk, poolCtx.pendingFeeReserve]);

  // =========================
  // Withdraw
  // =========================
  // const withdraw = useCallback(async () => {
  //   if (amountWithdraw <= 0) return;

  //   setLoading(true);

  //   try {
  //     await walletCtx.assertConnected();
  //     if(!sdk) {
  //       throw new Error('SDK not initialized');
  //     }
  //     const iptMint = sdk.deriveIptMintPda(poolPda);

  //     const signature = await sdk.userWithdraw(
  //       poolPda,
  //       poolPda,
  //       USDC_MINT,
  //       iptMint,
  //       Math.floor(amountWithdraw * 10 ** USDC_DECIMALS).toString(),
  //       '0'
  //     );

  //     return signature;
  //   } finally {
  //     setLoading(false);
  //   }
  // }, [amountWithdraw, walletCtx, poolPda, sdk]);

  return {
    amountDeposit,
    setAmountDeposit,
    amountWithdraw,
    setAmountWithdraw,
    minReceiveDeposit,
    minReceiveWithdraw,
    deposit,
    // withdraw,
    loading,
  };
}