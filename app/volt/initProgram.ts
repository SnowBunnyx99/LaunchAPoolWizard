import * as anchor from '@project-serum/anchor';
import { useAnchorWallet } from 'solana-wallets-vue';
import { PublicKey } from '@solana/web3.js';
import { REFI_POOL_PROGRAM_ID } from './refi-pool-sdk';
import idl from '~/lib/res/side_vault_v3.json'; // TODO: Replace with actual idl
import idlDevNet from '~/lib/res/ipt.json';
import { Environments } from '~/lib/values/general.values';

export function initProgramVolt() {
  try {
    console.log('initProgramVolt start');
    const connection = initSolanaConnection();
    const wallet = useAnchorWallet();
    const config = useRuntimeConfig();
    const options = anchor.AnchorProvider.defaultOptions();
    const provider = new anchor.AnchorProvider(connection, wallet.value!, options);
    anchor.setProvider(provider);
    const idlProgram =
      config.public.ENV === Environments.prod || config.public.ENV === Environments.stg
        ? idl
        : idlDevNet;
    console.log('initProgramVolt end');
    return new anchor.Program(
      idlProgram as anchor.Idl,
      new PublicKey(REFI_POOL_PROGRAM_ID),
      provider
    );
  } catch (error) {
    console.log('initProgramVolt error', error);
    throw error;
  }
}
