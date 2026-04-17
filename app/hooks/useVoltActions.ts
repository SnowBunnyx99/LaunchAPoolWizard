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
}
export function useVoltActions(
  poolCtx: PoolContext,
  walletCtx: WalletContext,
  poolPda: PublicKey | null
) {
  const USDC_DECIMALS = 6;

  const program = useInitProgramVolt().initProgram();
  const sdk = useInitProgramSdk(program, walletCtx);

  const [amountDeposit, setAmountDeposit] = useState(0);
  const [amountWithdraw, setAmountWithdraw] = useState(0);
  const [loading, setLoading] = useState(false);

  // ✅ SAFE: hooks always run
  const minReceiveDeposit = useMemo(() => {
    if (!poolPda) return 0;

    return (
      (amountDeposit * 10 ** USDC_DECIMALS) /
      Number(poolCtx.exchangeRate || 1)
    );
  }, [amountDeposit, poolCtx.exchangeRate, poolPda]);

  const minReceiveWithdraw = useMemo(() => {
    if (!poolPda) return 0;

    const gross =
      (amountWithdraw * Number(poolCtx.exchangeRate)) /
      10 ** USDC_DECIMALS;

    const fee = (gross * poolCtx.withdrawFeeBPS) / 10_000;

    return gross - fee;
  }, [amountWithdraw, poolCtx.exchangeRate, poolCtx.withdrawFeeBPS, poolPda]);

  // =========================
  // Deposit
  // =========================
  const deposit = useCallback(async () => {
    if (!poolPda) {
      throw new Error('Pool PDA is required');
    }

    if (amountDeposit <= 0) return;
    const [pendingFeeReservePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("pending_fee_reserve"), poolPda.toBuffer()],
      program.program.programId
    );
    const pendingFeeReserve = pendingFeeReservePda;
    setLoading(true);

    try {
      if (!sdk) {
        throw new Error('SDK not initialized');
      }
      const signature = await sdk.userDeposit(
        poolPda,
        pendingFeeReserve,
        BigInt(amountDeposit * 10 ** USDC_DECIMALS),
      );

      return signature;
    } finally {
      setLoading(false);
    }
  }, [amountDeposit, poolPda, sdk, program.program.programId]);

  const withdraw = useCallback(async () => {
    if (!poolPda) {
      throw new Error('Pool PDA is required');
    }

    if (amountWithdraw <= 0) return;
    const [usdcReservePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("usdc_reserve"), poolPda.toBuffer()],
      program.program.programId
    );
    const poolUsdcReserve = usdcReservePda;
    setLoading(true);

    try {
      if (!sdk) {
        throw new Error('SDK not initialized');
      }
      const signature = await sdk.userWithdraw(
        poolPda,
        poolUsdcReserve,
        Math.floor(amountWithdraw * 10 ** USDC_DECIMALS).toString(),
      );

      return signature;
    } finally {
      setLoading(false);
    }
  }, [amountWithdraw, poolPda, sdk, program.program.programId]);

  // ✅ Optional: early return AFTER hooks
  if (!poolPda) {
    return {
      amountDeposit,
      setAmountDeposit,
      amountWithdraw,
      setAmountWithdraw,
      minReceiveDeposit: 0,
      minReceiveWithdraw: 0,
      deposit: async () => {
        throw new Error('Pool not initialized');
      },
      withdraw: async () => {
        throw new Error('Pool not initialized');
      },
      loading: false,
    };
  }

  return {
    amountDeposit,
    setAmountDeposit,
    amountWithdraw,
    setAmountWithdraw,
    minReceiveDeposit,
    minReceiveWithdraw,
    deposit,
    withdraw,
    loading,
  };
}