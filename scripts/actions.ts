import { AnchorProvider, Program, web3, workspace } from '@coral-xyz/anchor';
import { DephyNcn } from '../target/types/dephy_ncn';

const JITO_RESTAKING_ID = new web3.PublicKey("RestkWeAVL8fRGgzhfeoqFhsqKRchg6aa1XrcH96z4Q");
const JITO_VAULT_ID = new web3.PublicKey("Vau1t6sLNxnzB7ZDsef8TLbPLfyZMYXH8WTNqUdm9g8");


export function getDephyNcnProgram() {
  return workspace.DephyNcn as Program<DephyNcn>;
}

export function debugPubkeys(pubkeys: Record<string, any>) {
  for (const name in pubkeys) {
    console.log(name, pubkeys[name].toString());
  }
}


export interface InitializeNcnOpts {
}
export async function initializeNcn(provider: AnchorProvider, opts: InitializeNcnOpts) {
  const dephyNcn = getDephyNcnProgram();
  const base = web3.Keypair.generate();

  const { signature, pubkeys } = await dephyNcn.methods
    .initializeNcn()
    .accounts({
      base: base.publicKey,
      authority: provider.publicKey,
    })
    .signers([base])
    .rpcAndKeys()

  debugPubkeys(pubkeys);

  return signature
}


export interface InitializeVaultOpts {
  config: string;
  vault: string;
}
export async function initializeVault(provider: AnchorProvider, opts: InitializeVaultOpts) {
  const dephyNcn = getDephyNcnProgram();
  const configPubkey = new web3.PublicKey(opts['config']);
  const vaultPubkey = new web3.PublicKey(opts['vault'])

  const configAccount = await dephyNcn.account.config.fetch(configPubkey)

  const { signature, pubkeys } = await dephyNcn.methods
    .initializeVault()
    .accounts({
      config: configPubkey,
      ncn: configAccount.ncn,
      vault: vaultPubkey,
    })
    .rpcAndKeys()

  debugPubkeys(pubkeys);

  return signature
}

export interface WarmupVaultOpts {
  config: string;
  vault: string;
}
export async function warmupVault(provider: AnchorProvider, opts: WarmupVaultOpts) {
  const dephyNcn = getDephyNcnProgram();
  const configPubkey = new web3.PublicKey(opts['config']);
  const vaultPubkey = new web3.PublicKey(opts['vault'])

  const configAccount = await dephyNcn.account.config.fetch(configPubkey)

  const { signature, pubkeys } = await dephyNcn.methods
    .warmupVault()
    .accounts({
      config: configPubkey,
      ncn: configAccount.ncn,
      vault: vaultPubkey,
    })
    .rpcAndKeys()

  debugPubkeys(pubkeys);

  return signature
}


export interface InitializeOperatorOpts {
  config: string;
  operator: string;
}
export async function initializeOperator(provider: AnchorProvider, opts: InitializeOperatorOpts) {
  const dephyNcn = getDephyNcnProgram();
  const configPubkey = new web3.PublicKey(opts['config']);
  const operatorPubkey = new web3.PublicKey(opts['operator']);

  const configAccount = await dephyNcn.account.config.fetch(configPubkey)

  const { signature, pubkeys } = await dephyNcn.methods
    .initializeOperator()
    .accounts({
      config: configPubkey,
      ncn: configAccount.ncn,
      operator: operatorPubkey,
    })
    .rpcAndKeys()

  debugPubkeys(pubkeys);

  return signature
}


export interface WarmupOperatorOpts {
  config: string;
  operator: string;
}
export async function warmupOperator(provider: AnchorProvider, opts: WarmupOperatorOpts) {
  const dephyNcn = getDephyNcnProgram();
  const configPubkey = new web3.PublicKey(opts['config']);
  const operatorPubkey = new web3.PublicKey(opts['operator']);

  const configAccount = await dephyNcn.account.config.fetch(configPubkey)

  const { signature, pubkeys } = await dephyNcn.methods
    .warmupOperator()
    .accounts({
      config: configPubkey,
      ncn: configAccount.ncn,
      operator: operatorPubkey,
    })
    .rpcAndKeys()

  debugPubkeys(pubkeys);

  return signature
}


export interface VoteOpts {
  config: string;
  operator: string;
  vault: string;
  rewardsRoot: string;
}
export async function vote(provider: AnchorProvider, opts: VoteOpts) {
  const dephyNcn = getDephyNcnProgram();
  const configPubkey = new web3.PublicKey(opts['config']);
  const operatorPubkey = new web3.PublicKey(opts['operator']);
  const vaultPubkey = new web3.PublicKey(opts['vault']);
  const rewardsRoot = Buffer.from(opts['rewardsRoot'], 'hex')

  console.assert(rewardsRoot.length == 32, 'MerkleRoot shoule be 32 bytes')

  const { signature, pubkeys } = await dephyNcn.methods
    .vote({
      proposedRewardsRoot: Array.from(rewardsRoot)
    })
    .accounts({
      config: configPubkey,
      operatorAdmin: provider.publicKey,
      operator: operatorPubkey,
      vault: vaultPubkey,
    })
    .rpcAndKeys()

  debugPubkeys(pubkeys);

  return signature
}

