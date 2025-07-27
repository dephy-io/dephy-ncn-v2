import { Command } from '@commander-js/extra-typings';
import * as anchor from '@coral-xyz/anchor';
import { AnchorProvider, Program, BN, web3 } from '@coral-xyz/anchor';
import * as spl from '@solana/spl-token';
import { DephyRewards } from '../target/types/dephy_rewards';
import { readFileSync } from 'fs';
import { buildRewardsTree } from "../tests/rewards-tree";
import path from "path";
import os from "os";
import { getProvider } from './common';
import { getClaimRewardsInstructionDataDecoder, hashNode, MerkleTree } from '../clients/dephy-rewards/js/src';
import * as gill from 'gill'


const cli = new Command();

let provider: AnchorProvider;
let dephyRewards: Program<DephyRewards>;

const logRewardsState = (rewardsState: Awaited<ReturnType<typeof dephyRewards.account.rewardsState.all>>[number]) => {
  console.log('Rewards State:', rewardsState.publicKey.toString())
  console.log('Authority:', rewardsState.account.authority.toString())
  console.log('Rewards Mint:', rewardsState.account.rewardsMint.toString())
  console.log('Rewards Token Account:', rewardsState.account.rewardsTokenAccount.toString())
  console.log('Merkle Root:', rewardsState.account.merkleRoot)
}


cli
  .name('dephy-rewards-cli')
  .description('Dephy Rewards CLI')
  .version('0.1.0')
  .requiredOption('-k, --keypair <path>', 'Authority keypair JSON file path', path.join(os.homedir(), '.config', 'solana', 'id.json'))
  .requiredOption('-r, --rpc <url>', 'Solana RPC URL', 'http://127.0.0.1:8899')
  .hook('preAction', (thisCmd) => {
    const { rpc, keypair } = thisCmd.opts();
    if (rpc && keypair) {
      provider = getProvider(rpc, keypair);
      dephyRewards = anchor.workspace.DephyRewards;
    }
  });

cli.command('initialize-rewards-state')
  .description('Initialize the rewards state')
  .requiredOption('-m, --mint <pubkey>', 'Rewards mint account pubkey')
  .option('-a, --authority <pubkey>', 'Authority account pubkey')
  .action(async (opts) => {
    try {
      const mintPubkey = new web3.PublicKey(opts.mint);
      const stateKeypair = web3.Keypair.generate();
      const mintAccount = await provider.connection.getAccountInfo(mintPubkey);
      const authorityPubkey = opts.authority ? new web3.PublicKey(opts.authority) : provider.publicKey;

      const tx = await dephyRewards.methods
        .initializeRewardsState()
        .accounts({
          rewardsState: stateKeypair.publicKey,
          authority: authorityPubkey,
          rewardsMint: mintPubkey,
          payer: provider.publicKey,
          rewardsTokenProgram: mintAccount.owner,
        })
        .signers([stateKeypair])
        .rpc();

      console.log('Rewards state initialized:', stateKeypair.publicKey.toString());
      console.log('Transaction signature:', tx);
    } catch (err) {
      console.error('Failed to initialize rewards state:', err);
    }
  });

cli.command('all-rewards-states')
  .description('Get all rewards states')
  .action(async () => {
    try {
      const rewardsStates = await dephyRewards.account.rewardsState.all();
      rewardsStates.forEach((rewardsState) => {
        logRewardsState(rewardsState)
      })
    } catch (err) {
      console.error('Failed to get rewards states:', err);
    }
  });

cli.command('get-rewards-state')
  .description('Get the rewards state')
  .requiredOption('-s, --state <pubkey>', 'Rewards state account pubkey')
  .action(async (opts) => {
    try {
      const statePubkey = new web3.PublicKey(opts.state);
      const rewardsState = await dephyRewards.account.rewardsState.fetch(statePubkey);
      logRewardsState({ publicKey: statePubkey, account: rewardsState })
    } catch (err) {
      console.error('Failed to get rewards state:', err);
    }
  });

cli.command('update-authority')
  .description('Update the authority for rewards distribution')
  .requiredOption('-s, --state <pubkey>', 'Rewards state account pubkey')
  .requiredOption('-n, --new-authority <pubkey>', 'New authority account pubkey')
  .action(async (opts) => {
    try {
      const statePubkey = new web3.PublicKey(opts.state);
      const newAuthorityPubkey = new web3.PublicKey(opts.newAuthority);

      const tx = await dephyRewards.methods
        .updateAuthority()
        .accounts({
          rewardsState: statePubkey,
          authority: provider.publicKey,
          newAuthority: newAuthorityPubkey,
        })
        .signers([provider.wallet.payer])
        .rpc();

      console.log('Authority updated');
      console.log('Transaction signature:', tx);
    } catch (err) {
      console.error('Failed to update authority:', err);
    }
  });


cli.command('update-merkle-root')
  .description('Update the merkle root for rewards distribution')
  .requiredOption('-s, --state <pubkey>', 'Rewards state account pubkey')
  .requiredOption('--root <hash>', 'Merkle root hash as a hex string')
  .action(async (opts) => {
    try {
      const statePubkey = new web3.PublicKey(opts.state);
      const merkleRoot = Uint8Array.from(Buffer.from(opts.root, 'hex'))
      if (merkleRoot.length !== 32) {
        throw new Error('Merkle root must be 32 bytes (64 hex chars)')
      }

      const tx = await dephyRewards.methods
        .updateMerkleRoot({
          merkleRoot: {
            inplace: {
              hash: Array.from(merkleRoot)
            }
          }
        })
        .accounts({
          rewardsState: statePubkey,
          authority: provider.publicKey,
        })
        .rpc();

      console.log('Merkle root updated');
      console.log('Transaction signature:', tx);
    } catch (err) {
      console.error('Failed to update merkle root:', err);
    }
  });

cli.command('update-merkle-root-external')
  .description('Update the merkle root for rewards distribution')
  .requiredOption('-s, --state <pubkey>', 'Rewards state account pubkey')
  .requiredOption('--address <pubkey>', 'External merkle root pubkey')
  .requiredOption('--offset <offset>', 'External merkle root offset')
  .action(async (opts) => {
    try {
      const statePubkey = new web3.PublicKey(opts.state);
      const externalPubkey = new web3.PublicKey(opts.address);
      const externalOffset = new BN(opts.offset);

      const tx = await dephyRewards.methods
        .updateMerkleRoot({
          merkleRoot: {
            external: {
              pubkey: externalPubkey,
              offset: externalOffset,
            }
          }
        })
        .accounts({
          rewardsState: statePubkey,
          authority: provider.publicKey,
        })
        .rpc();

      console.log('Merkle root updated');
      console.log('Transaction signature:', tx);
    } catch (err) {
      console.error('Failed to update merkle root:', err);
    }
  });


cli.command('fund-rewards')
  .description('Fund rewards')
  .requiredOption('-s, --state <pubkey>', 'Rewards state account pubkey')
  .requiredOption('-a, --amount <amount>', 'Amount to fund')
  .action(async (opts) => {
    try {
      const rewardsStatePubkey = new web3.PublicKey(opts.state);
      const amount = new BN(opts.amount);
      const rewardsState = await dephyRewards.account.rewardsState.fetch(rewardsStatePubkey);
      const rewardsMintAccount = await provider.connection.getAccountInfo(rewardsState.rewardsMint)
      const rewardsMint = await spl.getMint(
        provider.connection,
        rewardsState.rewardsMint,
        undefined,
        rewardsMintAccount.owner,
      )
      const sourceAccount = spl.getAssociatedTokenAddressSync(
        rewardsState.rewardsMint,
        provider.publicKey,
        true,
        rewardsMintAccount.owner,
      )

      const tx = await spl.transferChecked(
        provider.connection,
        provider.wallet.payer,
        sourceAccount,
        rewardsState.rewardsMint,
        rewardsState.rewardsTokenAccount,
        provider.publicKey,
        amount.toNumber(),
        rewardsMint.decimals,
        undefined,
        undefined,
        rewardsMintAccount.owner,
      )

      console.log('Rewards funded');
      console.log('Transaction signature:', tx);
    } catch (err) {
      console.error('Failed to fund rewards:', err);
    }
  });


cli.command('claim-rewards')
  .description('Claim rewards for a user')
  .requiredOption('-s, --state <pubkey>', 'Rewards state account pubkey')
  .requiredOption('--rewards <path>', 'Path to rewards file')
  .option('-b, --beneficiary <pubkey>', 'Beneficiary account pubkey')
  .action(async (opts) => {
    try {
      const rewardsStatePubkey = new web3.PublicKey(opts.state);
      const beneficiary = opts.beneficiary ? new web3.PublicKey(opts.beneficiary) : provider.publicKey;
      const rewards = JSON.parse(readFileSync(opts.rewards, 'utf8'));
      const rewardsNodes: Parameters<typeof buildRewardsTree>[0] = rewards.map(({ user, amount }) => ({
        user: new web3.PublicKey(user),
        amount: BigInt(amount)
      }));
      if (rewardsNodes.length == 0) {
        console.error('No rewards found');
        process.exit(1)
      }

      const rewardsTree = buildRewardsTree(rewardsNodes);
      const index = rewardsNodes.findIndex(({ user }) => user.equals(provider.publicKey));
      const proof = rewardsTree.getProof(index).proof.map(b => Array.from(b));
      const { user, amount } = rewardsNodes[index]
      console.log('rewards', user.toString(), amount)
      const totalRewards = new BN(amount.toString())

      const rewardsState = await dephyRewards.account.rewardsState.fetch(rewardsStatePubkey);
      const maybeMerkleRootAccount = rewardsState.merkleRoot.external ? rewardsState.merkleRoot.external.pubkey : null;

      const rewardsMint = await provider.connection.getAccountInfo(rewardsState.rewardsMint)
      const rewardsTokenAccount = await spl.getAccount(
        provider.connection,
        rewardsState.rewardsTokenAccount,
        undefined,
        rewardsMint.owner,
      )
      console.log('rewardsTokenAccount', rewardsTokenAccount.address.toString(), rewardsTokenAccount.amount)

      const beneficiaryTokenAccountPubkey = spl.getAssociatedTokenAddressSync(
        rewardsState.rewardsMint,
        beneficiary,
        true,
        rewardsMint.owner,
      )

      const beneficiaryTokenAccount = await provider.connection.getAccountInfo(beneficiaryTokenAccountPubkey)
      console.log('beneficiaryTokenAccount', beneficiaryTokenAccountPubkey.toString())
      if (!beneficiaryTokenAccount) {
        await spl.createAssociatedTokenAccountIdempotent(
          provider.connection,
          provider.wallet.payer,
          rewardsState.rewardsMint,
          beneficiary,
          undefined,
          rewardsMint.owner
        )
      }

      const tx = await dephyRewards.methods
        .claimRewards({
          index,
          totalRewards,
          proof
        })
        .accounts({
          rewardsState: rewardsStatePubkey,
          rewardsMint: rewardsState.rewardsMint,
          rewardsTokenAccount: rewardsState.rewardsTokenAccount,
          owner: user,
          beneficiaryTokenAccount: beneficiaryTokenAccountPubkey,
          maybeMerkleRootAccount,
          payer: provider.publicKey,
          rewardsTokenProgram: rewardsMint.owner,
        })
        .rpc();

      console.log('Rewards claimed successfully');
      console.log('Transaction signature:', tx);
    } catch (err) {
      console.error('Failed to claim rewards:', err);
    }
  });

cli.command('calc-rewards-root')
  .description('Calculate the rewards root hash')
  .requiredOption('--rewards <path>', 'Path to rewards file')
  .action(async (opts) => {
    try {
      const rewards = JSON.parse(readFileSync(opts.rewards, 'utf8'));
      const rewardsNodes = rewards.map(({ user, amount }) => ({
        user: new web3.PublicKey(user),
        amount: BigInt(amount)
      }));
      if (rewardsNodes.length == 0) {
        console.error('No rewards found');
        process.exit(1)
      }

      const rewardsTree = buildRewardsTree(rewardsNodes);
      const rewardsRoot = rewardsTree.getRoot();
      console.log('Rewards root:', rewardsRoot.toHex());
    } catch (err) {
      console.error('Failed to calculate rewards root:', err);
    }
  });


cli.command('check-proof-data')
  .description('Check the merkle root for rewards distribution')
  .requiredOption('--owner <owner>', 'Owner account pubkey')
  .requiredOption('--data <data>', 'Tx Data to check')
  .action(async (opts) => {
    try {
      const ownerPubkey = gill.address(opts.owner);
      const data = Buffer.from(opts.data, 'hex');
      const decodedData = getClaimRewardsInstructionDataDecoder().decode(data);

      console.dir(decodedData, { depth: null })

      const leaf = hashNode({
        user: ownerPubkey,
        amount: decodedData.totalRewards,
      })

      const computedRoot = MerkleTree.hashProof({
        leaf,
        leafIndex: decodedData.index,
        proof: decodedData.proof.map(p => Buffer.from(p)),
        root: null
      })

      console.log('computedRoot', computedRoot.toHex())
    } catch (err) {
      console.error('Failed to check merkle root:', err);
    }
  });

cli.parseAsync(process.argv).catch(console.error);
