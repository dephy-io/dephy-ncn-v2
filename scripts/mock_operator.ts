import { vote } from './actions';
import { Command } from '@commander-js/extra-typings';
import * as anchor from '@coral-xyz/anchor';
import { web3 } from '@coral-xyz/anchor';
import { keccak_256 } from 'js-sha3';
import { Program } from '@coral-xyz/anchor';
import { DephyNcn } from '../target/types/dephy_ncn';
import { getProvider } from './common';

const cli = new Command();
let dephyNcn: Program<DephyNcn>

async function fetchBallotBox(configPubkey: web3.PublicKey, programId: web3.PublicKey) {
  const [ballotBoxPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from('ballot_box'), configPubkey.toBuffer()],
    programId
  );
  return await dephyNcn.account.ballotBox.fetch(ballotBoxPda);
}

function calcMockedRoot(epoch: number) {
  return Buffer.from(keccak_256.digest(`MOCKED_ROOT:${epoch}`));
}

cli
  .name('mock-operator')
  .description('Operator CLI for voting')
  .requiredOption('-k, --keypair <path>', 'Operator admin keypair JSON file path')
  .requiredOption('-r, --rpc <url>', 'Solana RPC URL')
  .requiredOption('--config <pubkey>', 'Config public key')
  .requiredOption('--operator <pubkey>', 'Operator public key')
  .requiredOption('--vault <pubkey>', 'Vault account pubkey')
  .option('-p, --program-id <programId>', 'DephyNCN Program ID')
  .option('--interval <seconds>', 'Polling interval in seconds', '600')
  .action(async (opts) => {
    const provider = getProvider(opts.rpc, opts.keypair);
    anchor.setProvider(provider);
    dephyNcn = anchor.workspace.DephyNcn as Program<DephyNcn>;
    const programId = opts.programId ? new web3.PublicKey(opts.programId) : dephyNcn.programId;
    const configPubkey = new web3.PublicKey(opts.config);
    const operatorPubkey = new web3.PublicKey(opts.operator);
    const vaultPubkey = new web3.PublicKey(opts.vault);

    // TODO:
    // operator admin should match
    // vault operator ticket should match
    // ncn operator state should match

    const [voterStateAddress] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('voter_state'), configPubkey.toBuffer(), operatorPubkey.toBuffer()],
      programId
    );

    const voterState = await dephyNcn.account.voterState.fetch(voterStateAddress);
    let lastVotedEpoch = voterState.lastVotedEpoch.toNumber();
    console.log(`Last voted at epoch ${lastVotedEpoch}`);

    while (true) {
      const { epoch } = await provider.connection.getEpochInfo();
      if (epoch > lastVotedEpoch) {
        try {
          console.log(`Detected new epoch: ${epoch}, voting...`);
          const mockedRoot = calcMockedRoot(epoch)
          const ballotBox = await fetchBallotBox(configPubkey, programId);

          const currentRewardsRoot = Buffer.from(ballotBox.proposedRewardsRoot)
          if (!currentRewardsRoot.equals(mockedRoot)) {
            console.error('RewardsRoot not match', currentRewardsRoot, mockedRoot)
          }

          const rewardsRoot = mockedRoot.toString('hex')
          await vote(provider, {
            config: opts.config,
            operator: opts.operator,
            vault: opts.vault,
            rewardsRoot,
          });
          lastVotedEpoch = epoch;
          console.log(`Voted for epoch ${epoch} ${rewardsRoot}`);

        } catch (e) {
          console.error(`Vote failed:`, e);
        }
      }
      await new Promise(r => setTimeout(r, Number(opts.interval) * 1000));
    }
  });

cli.parseAsync(process.argv).catch(console.error);
