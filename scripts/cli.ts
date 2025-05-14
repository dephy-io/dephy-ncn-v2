import { Command } from '@commander-js/extra-typings';
import {
  initializeNcn,
  initializeOperator,
  initializeVault,
  vote,
  warmupOperator,
  warmupVault,
} from './actions';
import { AnchorProvider, web3 } from '@coral-xyz/anchor';
import anchor from "@coral-xyz/anchor";
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

const cli = new Command();

let provider: AnchorProvider;

cli
  .name('dephy-ncn-cli')
  .description('Dephy NCN CLI')
  .version('0.1.0')
  .requiredOption('-k, --keypair <path>', 'Authority keypair JSON file path')
  .requiredOption('-r, --rpc <url>', 'Solana RPC URL', 'http://127.0.0.1:8899')
  .hook('preAction', (thisCmd) => {
    const { rpc, keypair } = thisCmd.opts();
    if (rpc && keypair) {
      provider = getProvider(rpc, keypair);
    }
  });

cli.command('initialize-ncn')
  .description('Initialize NCN')
  .action(async (opts) => {
    const signature = await initializeNcn(provider, opts);
    console.log('initialize-ncn:', signature)
  });

cli.command('initialize-vault')
  .description('Initialize vault connection')
  .requiredOption('-c, --config <pubkey>', 'Dephy NCN Config account pubkey')
  .requiredOption('-v, --vault <pubkey>', 'Vault account pubkey')
  .action(async (opts) => {
    const signature = await initializeVault(provider, opts);
    console.log('initialize-vault:', signature)
  });

cli.command('warmup-vault')
  .description('Warmup vault connection')
  .requiredOption('-c, --config <pubkey>', 'Dephy NCN Config account pubkey')
  .requiredOption('-v, --vault <pubkey>', 'Vault account pubkey')
  .action(async (opts) => {
    const signature = await warmupVault(provider, opts);
    console.log('warmup-vault:', signature)
  });

cli.command('initialize-operator')
  .description('Initialize operator connection')
  .requiredOption('-c, --config <pubkey>', 'Dephy NCN Config account pubkey')
  .requiredOption('-o, --operator <pubkey>', 'Operator account pubkey')
  .action(async (opts) => {
    const signature = await initializeOperator(provider, opts);
    console.log('initialize-operator:', signature)
  });

cli.command('warmup-operator')
  .description('Warmup operator connection')
  .requiredOption('-c, --config <pubkey>', 'Dephy NCN Config account pubkey')
  .requiredOption('-o, --operator <pubkey>', 'Operator account pubkey')
  .action(async (opts) => {
    const signature = await warmupOperator(provider, opts);
    console.log('warmup-operator:', signature)
  });

cli.command('vote')
  .description('Submit vote for rewards distribution')
  .requiredOption('-c, --config <pubkey>', 'Dephy NCN Config account pubkey')
  .requiredOption('-o, --operator <pubkey>', 'Operator account pubkey')
  .requiredOption('-v, --vault <pubkey>', 'Vault account pubkey')
  .requiredOption('--rewards-root <hash>', 'Rewards root hash in hex string')
  .action(async (opts) => {
    const signature = await vote(provider, opts);
    console.log('vote:', signature)
  });

cli.parseAsync(process.argv).catch(console.error);
