import * as anchor from '@coral-xyz/anchor';
import { web3 } from '@coral-xyz/anchor';
import { readFileSync } from 'fs';

export function loadKey(path: string) {
  return web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, 'utf8'))));
}

export function getProvider(rpcUrl: string, keypairPath: string) {
  const wallet = new anchor.Wallet(loadKey(keypairPath));
  const provider = new anchor.AnchorProvider(new web3.Connection(rpcUrl), wallet, {});
  anchor.setProvider(provider);
  return provider;
}
