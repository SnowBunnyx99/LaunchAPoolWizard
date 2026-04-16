/* eslint-disable @typescript-eslint/no-explicit-any */
import { Idl } from '@project-serum/anchor/dist/cjs/idl';
import { Program } from '@project-serum/anchor/dist/cjs/program';
import {
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { WalletContextState } from '@solana/wallet-adapter-react';
import { PublicKey, Connection, SystemProgram, Transaction, SendTransactionError, TransactionInstruction } from '@solana/web3.js';
import BN from 'bn.js';
import { Pool } from './page';
export const REFI_POOL_PROGRAM_ID = new PublicKey('DoCrin3rSc5wiPMaCSjBk3rN5RnswrDqNnghw6VVmf8m');
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const USDC_MINT = new PublicKey('7TrvqwZpZyRJM67YUW8U3bfx346rhdzBYM9vcyxqXcj5');
export const NAV_WALLET = new PublicKey('26TbGcvMErPNmihXtqa2ZCp7WvDhpthNeNnKFaUMJfuA');
export const GENERATED_POOLS_KEY = new PublicKey('9pbtq29M9ixSCndtXj6tdWaybuknnqqU2Wz9PgQSwa6c');
let IDL: any | null = null;

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface PoolConfig {
  adminAuthority: PublicKey;
  oracleAuthority: PublicKey;
  feeCollector: PublicKey;
  depositFeeBps: number;
  withdrawalFeeBps: number;
  managementFeeBps: number;
  initialExchangeRate: BN;
  maxTotalSupply: BN;
  maxQueueSize: number;
}



type GetOrCreateATAResult = {
  ata: PublicKey;
  ix: TransactionInstruction | null;
};

export interface FrontendWallet {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signAllTransactions?: (txs: Transaction[]) => Promise<Transaction[]>;
}


export class AnchorTxError extends Error {
  code?: string;
  number?: number;
  logs?: string[];

  constructor({
    message,
    code,
    number,
    logs,
  }: {
    message: string;
    code?: string;
    number?: number;
    logs?: string[];
  }) {
    super(message);
    this.name = 'AnchorTxError';
    this.code = code;
    this.number = number;
    this.logs = logs;
  }
}
export const handleSolanaError = async (
  err: unknown,
  connection: Connection
) => {
  if (err instanceof SendTransactionError) {
    const logs = await err.getLogs(connection);

    if (!logs) {
      throw new Error('No logs found');
    }

    const hex = logs
      .map(l => l.match(/0x[0-9a-fA-F]+/)?.[0])
      .find(Boolean);

    throw new Error(hex || 'UNKNOWN_ERROR');
  }

  throw err;
};

export const getPoolState = async (program: any, poolPda: PublicKey): Promise<Pool> => {
  const pool: any = await (program.program.account as any).pool.fetch(poolPda);
  console.log("Raw on-chain pool data:", pool);
  return {
    ...pool,
    pendingQueue: (pool.pendingQueue || []).map((x: any) => ({
      user: x.user?.toString(),
      iptAmount: x.iptAmount?.toString(),
      timestamp: x.timestamp?.toString(),
    })),
  };
};

export const getFormattedPrice = (
  val = 0,
  moreOptions?: Intl.NumberFormatOptions,
  locale = 'en-US'
) => {
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'code',
    ...moreOptions,
  });

  return formatter.format(val).slice(4);
}

export const createRefiPoolSDK = ({
  program,
  connection,
  wallet,
}: {
  program: {
    program: Program<Idl>;
    connection: Connection;
    wallet: WalletContextState;
  };
  connection: Connection;
  wallet: FrontendWallet | null; // allow read-only mode
}) => {
  const assertWallet = () => {
    if (!wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }
  };

  const toFixedBytes = (value: string, size: number): number[] => {
    const bytes = Buffer.from(value, 'utf8');
    const out = new Array(size).fill(0);
    for (let i = 0; i < Math.min(bytes.length, size); i += 1) out[i] = bytes[i];
    return out;
  }
  const poolIdToSeed = (poolId: BN | number): Buffer => {
    const idBn = BN.isBN(poolId) ? poolId : new BN(poolId);
    const seed = Buffer.from(idBn.toArray('le', 8));
    return seed;
  };

  const derivePoolPda = (poolId: BN | number): PublicKey => {
    const usdcBuffer = USDC_MINT.toBuffer()
    console.log("usdcBuffer", usdcBuffer);
    console.log('programId:', program.program.programId);
    const [poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), usdcBuffer, poolIdToSeed(poolId)],
      program.program.programId
    );
    return poolPda;
  }

  const deriveIptMintPda = (poolPda: PublicKey): PublicKey => {
    debugger;
    console.log(program);
    const pda = PublicKey.findProgramAddressSync(
      [Buffer.from('ipt_mint'), poolPda.toBuffer()],
      program.program.programId
    )[0];
    return pda;
  };

  const deriveUsdcReservePda = (poolPda: PublicKey): PublicKey =>
    PublicKey.findProgramAddressSync(
      [Buffer.from('usdc_reserve'), poolPda.toBuffer()],
      program.program.programId
    )[0];


  const getTokenBalance = async (tokenAccount: PublicKey): Promise<string> => {
    try {
      if (!wallet?.publicKey) {
        throw new Error('Wallet not connected');
      }
      const { ata: ataTokenAccount } = await getOrCreateTokenAccountIx(tokenAccount, wallet.publicKey, wallet.publicKey);
      const account = await getAccount(connection, ataTokenAccount);
      return account.amount.toString();
    } catch (error) {
      console.log(`Failed to get token balance: ${error}`);
      return '0';
    }
  };

  const buildAndSendTx = async (tx: Transaction) => {
    assertWallet();

    tx.feePayer = wallet!.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    const signed = await wallet!.signTransaction(tx);
    return connection.sendRawTransaction(signed.serialize());
  };
  /**
   * Pool state
   *
   * Represents the full on-chain state of a ReFi pool.
   * Includes configuration, reserves, supply, fees,
   * and the pending withdrawal queue.
   */

  const getOrCreateTokenAccountIx = async (
    mint: PublicKey,
    owner: PublicKey,
    payer: PublicKey
  ): Promise<GetOrCreateATAResult> => {
    const ata = getAssociatedTokenAddressSync(mint, owner);
    const accountInfo = await connection.getAccountInfo(ata);

    // ATA already exists
    if (accountInfo) {
      return { ata, ix: null };
    }

    // Create ATA instruction
    const ix = createAssociatedTokenAccountInstruction(
      payer, // payer
      ata,
      owner,
      mint
    );

    return { ata, ix };
  };


  /**
    * Initialize Pool (Step 1)
    * @param poolId - u64; with the same `usdc_mint`, use a new id for a new pool
    */
  const initPool = async (
    usdcMint: PublicKey,
    poolId: BN | number,
    config: PoolConfig
  ): Promise<{ sig: string; poolPda: PublicKey }> => {
    try {
      const poolPda = derivePoolPda(poolId);
      const poolIdBn = BN.isBN(poolId) ? poolId : new BN(poolId);
      if (!wallet?.publicKey) {
        throw new Error('Wallet not connected');
      }
      const tx = await program.program.methods
        .initPool(poolIdBn, config)
        .accounts({
          payer: wallet.publicKey,
          usdcMint: usdcMint,
          pool: poolPda,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      const sig = await buildAndSendTx(tx);
      return { sig, poolPda };
    } catch (err: any) {
      await handleSolanaError(err, connection);
      throw err;
    }
  };

  /**
   * Initialize Pool Step 2 (Create mints and reserve)
   */
  const initPoolStep2 = async (usdcMint: PublicKey, poolPda: PublicKey): Promise<{ sig: string; iptMint: PublicKey; usdcReserve: PublicKey }> => {
    try {
      if (!wallet?.publicKey) {
        throw new Error('Wallet not connected');
      }
      const poolAuthority = poolPda;
      const iptMint = deriveIptMintPda(poolPda);
      const usdcReserve = deriveUsdcReservePda(poolPda);

      const tx = await program.program.methods
        .initPoolStep2()
        .accounts({
          payer: wallet.publicKey,
          pool: poolPda,
          poolAuthority: poolAuthority,
          usdcMint: usdcMint,
          iptMint: iptMint,
          usdcReserve: usdcReserve,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .transaction();
      const sig = await buildAndSendTx(tx);
      console.log(`✅ Pool initialized (step 2): ${tx}`);
      return { sig, iptMint, usdcReserve };
    } catch (error: any) {
      throw new Error(`Failed to initialize pool step 2: ${error.message}`);
    }
  }

  /**
   * Phase 2: Initialize NAV wallet and pending_fee_reserve PDA.
   * Admin only, call once per pool. Required before user_deposit.
   * (Appreciation, Fee, Buffer, Claim wallets are off-chain only.)
   */
  const initWallets = async (
    poolPda: PublicKey,
  ): Promise<{ sig: string; pendingFeeReserve: PublicKey }> => {
    try {
      if (!wallet?.publicKey) {
        throw new Error('Wallet not connected');
      }

      const { ata: navWalletUsdc } = (
        await getOrCreateTokenAccountIx(USDC_MINT, NAV_WALLET, wallet.publicKey)
      );
      const pendingFeeReserve = derivePendingFeeReservePda(poolPda);
      const poolAuthority = poolPda;

      const tx = await program.program.methods
        .initWallets()
        .accounts({
          admin: wallet.publicKey,
          pool: poolPda,
          poolAuthority: poolAuthority,
          usdcMint: USDC_MINT,
          pendingFeeReserve: pendingFeeReserve,
          navWallet: NAV_WALLET,
          navWalletUsdc: navWalletUsdc,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .transaction();
      const sig = await buildAndSendTx(tx);
      console.log(`✅ Wallets initialized (Phase 2): ${sig}`);
      return { sig, pendingFeeReserve };
    } catch (error: any) {
      throw new Error(`Failed to init wallets: ${error.message}`);
    }
  }

  /**
   * Phase 2: User deposit USDC to receive IPT.
   * Net USDC is split: nav_allocation_bps % to NAV wallet, rest to pending_fee_reserve. IPT is minted to user.
   * Requires initWallets to have been called first.
   * @param navWalletUsdc - NAV wallet's USDC token account (owner = pool.wallet_config.nav_wallet)
   * @param pendingFeeReserve - Pool's pending fee reserve token account (PDA)
   */
  const userDeposit = async (
    poolPda: PublicKey,
    poolAuthority: PublicKey,
    pendingFeeReserve: PublicKey,
    netUsdcAmount: string,
    minIptAmount: string
  ): Promise<string> => {
    try {
      if (!wallet?.publicKey) {
        throw new Error('Wallet not connected');
      }
      const { ata: navWalletUsdc } = (
        await getOrCreateTokenAccountIx(USDC_MINT, NAV_WALLET, wallet.publicKey)
      );
      debugger;
      const iptMint = deriveIptMintPda(poolPda);
      const { ata: userUsdcAccount } = await getOrCreateTokenAccountIx(USDC_MINT, wallet.publicKey, wallet.publicKey);
      const { ata: userIptAccount } = await getOrCreateTokenAccountIx(iptMint, wallet.publicKey, wallet.publicKey);
      const tx = await program.program.methods
        .userDeposit(new BN(netUsdcAmount), new BN(minIptAmount))
        .accounts({
          user: wallet.publicKey,
          pool: poolPda,
          poolAuthority,
          userUsdcAccount,
          userIptAccount,
          navWalletUsdc,
          pendingFeeReserve,
          iptMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      tx.feePayer = wallet.publicKey;
      tx.recentBlockhash = (
        await connection.getLatestBlockhash()
      ).blockhash;

      const signedTx = await buildAndSendTx(tx);
      return signedTx;
    } catch (error: any) {
      throw new Error(`Failed to deposit: ${error.message}`);
    }
  };

  /**
   * User withdraw USDC by burning IPT.
   * Direct flow: if reserve is insufficient, instruction fails (no queue).
   */
  const userWithdraw = async (
    program: any,
    wallet: any,
    connection: Connection,
    poolPda: PublicKey,
    poolAuthority: PublicKey,
    userUsdcAccount: PublicKey,
    userIptAccount: PublicKey,
    usdcReserve: PublicKey,
    iptMint: PublicKey,
    withdrawIptAmount: string,
    minUsdcAmount: string
  ): Promise<string> => {
    try {
      const tx = await program.methods
        .userWithdraw(new BN(withdrawIptAmount), new BN(minUsdcAmount))
        .accounts({
          user: wallet.publicKey,
          pool: poolPda,
          poolAuthority,
          userUsdcAccount,
          userIptAccount,
          poolUsdcReserve: usdcReserve,
          iptMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .transaction();

      tx.feePayer = wallet.publicKey;
      tx.recentBlockhash = (
        await connection.getLatestBlockhash()
      ).blockhash;

      const signedTx = await wallet.signTransaction(tx);
      const sig = await connection.sendRawTransaction(
        signedTx.serialize()
      );

      await connection.confirmTransaction(sig);

      console.log(`✅ Withdraw: ${sig}`);
      return sig;
    } catch (error: any) {
      throw new Error(`Failed to withdraw: ${error.message}`);
    }
  };
  const derivePendingFeeReservePda = (poolPda: PublicKey): PublicKey => {
    const [pendingFeeReserve] = PublicKey.findProgramAddressSync(
      [Buffer.from("pending_fee_reserve"), poolPda.toBuffer()],
      program.program.programId
    );
    return pendingFeeReserve;
  };

  return {
    getPoolState,
    initPool,
    initPoolStep2,
    initWallets,
    poolIdToSeed,
    buildAndSendTx,
    toFixedBytes,
    userDeposit,
    userWithdraw,
    getTokenBalance,
    deriveIptMintPda,
    getOrCreateTokenAccountIx,
  };
};

/* ------------------------------------------------------------------ */
/* IDL helpers */
/* ------------------------------------------------------------------ */

export const loadIDL = () => IDL;
export const setIDL = (idl: any) => {
  IDL = idl;
};
