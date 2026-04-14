/* eslint-disable @typescript-eslint/no-explicit-any */
import { PublicKey, Connection, SystemProgram, Transaction } from '@solana/web3.js';
export const REFI_POOL_PROGRAM_ID = new PublicKey('HpPJBUex6FdSw7CGvYzjtUmM1629RNTqgCyu6pfcyNBx');
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

let IDL: any | null = null;

export interface PoolConfig {
  adminAuthority: PublicKey;
  oracleAuthority: PublicKey;
  feeCollector: PublicKey;
  depositFeeBps: number;
  withdrawalFeeBps: number;
  managementFeeBps: number;
  initialExchangeRate: any;
  maxTotalSupply: any;
  maxQueueSize: number;
}

export interface PoolState {
  config: {
    adminAuthority: string;
    oracleAuthority: string;
    feeCollector: string;
    depositFeeBps: number;
    withdrawalFeeBps: number;
    managementFeeBps: number;
    initialExchangeRate: string;
    maxTotalSupply: string;
    maxQueueSize: number;
  };
  iptMint: string;
  usdcReserve: string;
  totalIptSupply: string;
  totalUsdcReserves: string;
  totalAccumulatedFees: string;
  currentExchangeRate: string;
  pendingQueue: Array<{
    user: string;
    iptAmount: string;
    timestamp: string;
  }>;
}

/* --------------------------------------------------
   Wallet adapter interface (frontend-safe)
-------------------------------------------------- */

export interface FrontendWallet {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signAllTransactions?: (txs: Transaction[]) => Promise<Transaction[]>;
}

/* --------------------------------------------------
   SDK factory
-------------------------------------------------- */

export const createRefiPoolSDK = ({
  program,
  connection,
  wallet,
}: {
  program: any;
  connection: Connection;
  wallet: FrontendWallet | null; // allow read-only mode
}) => {
  const assertWallet = () => {
    if (!wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }
  };
  const derivePoolPda = (usdcMint: PublicKey): PublicKey =>
    PublicKey.findProgramAddressSync(
      [Buffer.from('pool'), usdcMint.toBuffer()],
      program.programId
    )[0];

  const deriveIptMintPda = (poolPda: PublicKey): PublicKey =>
    PublicKey.findProgramAddressSync(
      [Buffer.from('ipt_mint'), poolPda.toBuffer()],
      program.programId
    )[0];

  const deriveUsdcReservePda = (poolPda: PublicKey): PublicKey =>
    PublicKey.findProgramAddressSync(
      [Buffer.from('usdc_reserve'), poolPda.toBuffer()],
      program.programId
    )[0];

  const buildAndSendTx = async (tx: Transaction) => {
    assertWallet();

    tx.feePayer = wallet!.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    const signed = await wallet!.signTransaction(tx);
    return connection.sendRawTransaction(signed.serialize());
  };
  /* ---------------- Pool state ---------------- */

  const getPoolState = async (poolPda: PublicKey): Promise<PoolState> => {
    const pool: any = await (program.account as any).pool.fetch(poolPda);

    return {
      config: {
        adminAuthority: pool.config.adminAuthority.toString(),
        oracleAuthority: pool.config.oracleAuthority.toString(),
        feeCollector: pool.config.feeCollector.toString(),
        depositFeeBps: pool.config.depositFeeBps,
        withdrawalFeeBps: pool.config.withdrawalFeeBps,
        managementFeeBps: pool.config.managementFeeBps,
        initialExchangeRate: pool.config.initialExchangeRate.toString(),
        maxTotalSupply: pool.config.maxTotalSupply.toString(),
        maxQueueSize: pool.config.maxQueueSize,
      },
      iptMint: pool.iptMint.toString(),
      usdcReserve: pool.usdcReserve.toString(),
      totalIptSupply: pool.totalIptSupply.toString(),
      totalUsdcReserves: pool.totalUsdcReserves.toString(),
      totalAccumulatedFees: pool.totalAccumulatedFees.toString(),
      currentExchangeRate: pool.currentExchangeRate.toString(),
      pendingQueue: (pool.pendingQueue || []).map((x: any) => ({
        user: x.user?.toString(),
        iptAmount: x.iptAmount?.toString(),
        timestamp: x.timestamp?.toString(),
      })),
    };
  };

  /* ---------------- Init pool ---------------- */

  const initPool = async (usdcMint: PublicKey, config: PoolConfig) => {

    const poolPda = derivePoolPda(usdcMint);

    const tx = await program.methods
      .initPool(config)
      .accounts({
        payer: wallet!.publicKey,
        usdcMint,
        pool: poolPda,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    const sig = await buildAndSendTx(tx);
    return { sig, poolPda };
  };

  const initPoolStep2 = async (usdcMint: PublicKey, poolPda: PublicKey) => {
    assertWallet();

    const iptMint = deriveIptMintPda(poolPda);
    const usdcReserve = deriveUsdcReservePda(poolPda);

    const tx = await program.methods
      .initPoolStep2()
      .accounts({
        payer: wallet!.publicKey,
        pool: poolPda,
        poolAuthority: poolPda,
        usdcMint,
        iptMint,
        usdcReserve,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    const sig = await buildAndSendTx(tx);
    return { sig, iptMint, usdcReserve };
  };
  const derivePendingFeeReservePda = (poolPda: PublicKey): PublicKey => {
    const [pendingFeeReserve] = PublicKey.findProgramAddressSync(
      [Buffer.from("pending_fee_reserve"), poolPda.toBuffer()],
      program.programId
    );
    return pendingFeeReserve;
  };
  const initWallets = async (
    poolPda: PublicKey,
    usdcMint: PublicKey,
    navWallet: PublicKey,
    navWalletUsdc: PublicKey
  ): Promise<{ tx: string; pendingFeeReserve: PublicKey }> => {
    try {
      const pendingFeeReserve = derivePendingFeeReservePda(poolPda);
      const poolAuthority = poolPda;

      const tx = await program.methods
        .initWallets()
        .accounts({
          admin: wallet!.publicKey,
          pool: poolPda,
          poolAuthority: poolAuthority,
          usdcMint: usdcMint,
          pendingFeeReserve: pendingFeeReserve,
          navWallet: navWallet,
          navWalletUsdc: navWalletUsdc,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log(`✅ Wallets initialized (Phase 2): ${tx}`);
      return { tx, pendingFeeReserve };
    } catch (error: unknown) {
      throw new Error(`Failed to init wallets: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    getPoolState,
    initPool,
    initPoolStep2,
    initWallets,
  };
};

/* ------------------------------------------------------------------ */
/* IDL helpers */
/* ------------------------------------------------------------------ */

export const loadIDL = () => IDL;
export const setIDL = (idl: any) => {
  IDL = idl;
};
