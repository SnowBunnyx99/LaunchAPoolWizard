import * as anchor from '@project-serum/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';

import idlDevNet from '@/app/volt/idl.json';
import { REFI_POOL_PROGRAM_ID } from '../sdk';

export function useInitProgramVolt() {
  const wallet = useWallet();

  const initProgram = () => {
    if (!process.env.NEXT_PUBLIC_RPC_URL) {
      throw new Error('RPC_URL not set');
    }
    if (!wallet.sendTransaction) {
      throw new Error('Wallet does not support sendTransaction');
    }

    const connection = new Connection(
      process.env.NEXT_PUBLIC_RPC_URL,
      'confirmed'
    );

    // ✅ IMPORTANT: wallet adapter itself, not publicKey
    const provider = new anchor.AnchorProvider(
      connection,
      wallet as unknown as anchor.Wallet, 
      anchor.AnchorProvider.defaultOptions()
    );

    const program = new anchor.Program(
      idlDevNet as anchor.Idl,
      new PublicKey(REFI_POOL_PROGRAM_ID),
      provider
    );

    return {
      program,
      connection,
      wallet,
    };
  };

  return { initProgram };
}