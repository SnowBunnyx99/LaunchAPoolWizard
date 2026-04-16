import { useMemo } from 'react';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { createRefiPoolSDK } from '../sdk';

type WalletLike = {
  publicKey: PublicKey | null;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
};

export function useInitProgramSdk(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  program: any,
  wallet: WalletLike
) {
  const connection = useMemo(() => {
    return new Connection('https://api.devnet.solana.com');
  }, []);

  const sdk = useMemo(() => {
    if (!program || !wallet.publicKey || !wallet.signTransaction ) {
      return null;
    }

    return createRefiPoolSDK({
      program,
      connection,
      wallet: {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
      },
    });
  }, [program, wallet.publicKey, wallet.signTransaction, connection]);

  return sdk;
}