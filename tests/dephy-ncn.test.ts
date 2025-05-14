import * as anchor from '@coral-xyz/anchor';
import { Program, web3 } from '@coral-xyz/anchor';
import { DephyNcn } from '../target/types/dephy_ncn';
import { DephyRewards } from '../target/types/dephy_rewards';
import * as spl from '@solana/spl-token';
import { assert } from 'chai';
import { readFileSync } from 'fs';
import { $ } from 'bun';


const debugPubkeys = (pubkeys) => {
  for (const name in pubkeys) {
    console.log(name, pubkeys[name].toString());
  }
};

const loadKey = (path: string) => {
  return web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, 'utf8'))));
}

const getInitializedAddress = (prompt: String, output: $.ShellOutput) => {
  const addressMatcher = new RegExp(`(?<=${prompt}: ).*$`, 'm')
  return new web3.PublicKey(output.stderr.toString().match(addressMatcher)[0])
}

const JITO_RESTAKING_ID = new web3.PublicKey("RestkWeAVL8fRGgzhfeoqFhsqKRchg6aa1XrcH96z4Q");
const JITO_VAULT_ID = new web3.PublicKey("Vau1t6sLNxnzB7ZDsef8TLbPLfyZMYXH8WTNqUdm9g8");

const jitoAdminKeypair = loadKey('./tests/fixtures/keys/jito-admin.json');
const vaultAdminKeypair = loadKey('./tests/fixtures/keys/vault-admin.json');
const op0AdminKeypair = loadKey('./tests/fixtures/keys/op0-admin.json');
const op1AdminKeypair = loadKey('./tests/fixtures/keys/op1-admin.json');
const userKeypair = loadKey('./tests/fixtures/keys/user.json');
const authority = web3.Keypair.generate();

const jitoCli = ['jito-restaking-cli', '--rpc-url', 'http://127.0.0.1:8899']
const jitoCliAdmin = [...jitoCli, '--keypair', './tests/fixtures/keys/jito-admin.json']
const jitoCliVaultAdmin = [...jitoCli, '--keypair', './tests/fixtures/keys/vault-admin.json']
const jitoCliOp0 = [...jitoCli, '--keypair', './tests/fixtures/keys/op0-admin.json']
const jitoCliOp1 = [...jitoCli, '--keypair', './tests/fixtures/keys/op1-admin.json']
const jitoCliUser = [...jitoCli, '--keypair', './tests/fixtures/keys/user.json']

describe("dephy-ncn", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider);

  const nextEpoch = async () => {
    const epochInfo = await provider.connection.getEpochInfo();
    const lastSlot = epochInfo.absoluteSlot - epochInfo.slotIndex + epochInfo.slotsInEpoch;
    console.log('current slot', epochInfo.absoluteSlot, 'waiting for slot', lastSlot);

    return new Promise<void>((resolve) => {
      let subscriptionId: number;
      subscriptionId = provider.connection.onSlotChange(({ slot }) => {
        if (slot > lastSlot) {
          provider.connection.removeSlotChangeListener(subscriptionId);
          resolve();
        }
      })
    })
  }

  const dephyNcn = anchor.workspace.dephyNcn as Program<DephyNcn>;
  const dephyRewards = anchor.workspace.dephyRewards as Program<DephyRewards>;

  let ncnPubkey: web3.PublicKey
  let configPubkey: web3.PublicKey
  let ballotBoxPubkey: web3.PublicKey

  const authority = web3.Keypair.generate()
  const rewardsMintKeypair = web3.Keypair.generate()
  const rewardsStateKeypair = web3.Keypair.generate()

  let vaultPubkey: web3.PublicKey
  const vaultMintKeypair = web3.Keypair.generate()

  const [rewardsVault, _rewardsVaultBump] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("rewards_vault"), rewardsStateKeypair.publicKey.toBuffer()],
    dephyRewards.programId
  );
  
  const rewardsTokenAccount = spl.getAssociatedTokenAddressSync(
    rewardsMintKeypair.publicKey,
    rewardsVault,
    true
  )

  before(async () => {
    provider.connection.requestAirdrop(jitoAdminKeypair.publicKey, web3.LAMPORTS_PER_SOL * 10)
    provider.connection.requestAirdrop(vaultAdminKeypair.publicKey, web3.LAMPORTS_PER_SOL * 10)
    provider.connection.requestAirdrop(op0AdminKeypair.publicKey, web3.LAMPORTS_PER_SOL * 10)
    provider.connection.requestAirdrop(op1AdminKeypair.publicKey, web3.LAMPORTS_PER_SOL * 10)
    provider.connection.requestAirdrop(userKeypair.publicKey, web3.LAMPORTS_PER_SOL * 10)
    await Bun.sleep(400);

    // prepare rewards mint
    await spl.createMint(
      provider.connection,
      provider.wallet.payer,
      authority.publicKey,
      null,
      6,
      rewardsMintKeypair,
    );

    // prepare vault mint
    await spl.createMint(
      provider.connection,
      provider.wallet.payer,
      vaultAdminKeypair.publicKey,
      null,
      6,
      vaultMintKeypair,
    );

    const vaultAdminTokenAccount = await spl.createAssociatedTokenAccountIdempotent(
      provider.connection,
      provider.wallet.payer,
      vaultMintKeypair.publicKey,
      vaultAdminKeypair.publicKey
    )

    await spl.mintTo(
      provider.connection,
      provider.wallet.payer,
      vaultMintKeypair.publicKey,
      vaultAdminTokenAccount,
      vaultAdminKeypair,
      1000000000n,
    )

    // those configs are initialized by jito
    await $`${jitoCliAdmin} restaking config initialize`
    await $`${jitoCliAdmin} vault config initialize 10 ${jitoAdminKeypair.publicKey}`

    // <TOKEN_MINT> <DEPOSIT_FEE_BPS> <WITHDRAWAL_FEE_BPS> <REWARD_FEE_BPS> <DECIMALS> <INITIALIZE_TOKEN_AMOUNT>
    const initVaultOutput = await $`${jitoCliVaultAdmin} vault vault initialize ${vaultMintKeypair.publicKey} 0 0 0 6 1000000`
    vaultPubkey = getInitializedAddress('Vault address', initVaultOutput);
  });


  it("initialize ncn", async () => {
    const base = web3.Keypair.generate();
    const tx = dephyNcn.methods
      .initializeNcn()
      .accounts({
        base: base.publicKey,
        authority: authority.publicKey,
      })
      .signers([authority, base])

    const pubkeys = await tx.pubkeys();
    debugPubkeys(pubkeys);

    ncnPubkey = pubkeys.ncn;

    await tx.rpc();

    configPubkey = pubkeys.config;

    const config = await dephyNcn.account.config.fetch(configPubkey);
    assert(config.authority.equals(authority.publicKey));

    const ncnAdmin = await provider.connection.getAccountInfo(pubkeys.ncnAdmin);
    assert.isNull(ncnAdmin)

    ballotBoxPubkey = pubkeys.ballotBox;

    const ballotBox = await dephyNcn.account.ballotBox.fetch(ballotBoxPubkey);
    assert(ballotBox.config.equals(configPubkey));
  })


  it("connect vault", async () => {
    const tx = dephyNcn.methods
      .initializeVault()
      .accounts({
        config: configPubkey,
        ncn: ncnPubkey,
        vault: vaultPubkey,
      })

    const pubkeys = await tx.pubkeys();
    debugPubkeys(pubkeys);

    await tx.rpc()

    const ncnVaultTicketAccount = await provider.connection.getAccountInfo(pubkeys.ncnVaultTicket)
    assert(ncnVaultTicketAccount.owner.equals(JITO_RESTAKING_ID))

    // warmup need another slot
    await Bun.sleep(400)

    await dephyNcn.methods
      .warmupVault()
      .accounts({
        config: configPubkey,
        ncn: ncnPubkey,
        vault: vaultPubkey,
      })
      .rpc()
  })


  it("connect from vault side", async () => {
    // init VaultNcnTicket
    await $`${jitoCliVaultAdmin} vault vault initialize-vault-ncn-ticket ${vaultPubkey} ${ncnPubkey}`
    
    // warmup need another slot
    await Bun.sleep(400)
    await $`${jitoCliVaultAdmin} vault vault warmup-vault-ncn-ticket ${vaultPubkey} ${ncnPubkey}`
  })

  let op0Pubkey: web3.PublicKey;
  let op1Pubkey: web3.PublicKey;
  it("initialize operators", async () => {
    // initialize operators
    const op0Output = await $`${jitoCliOp0} restaking operator initialize 1000`
    op0Pubkey = getInitializedAddress('Operator initialized at address', op0Output);

    const op1Output = await $`${jitoCliOp1} restaking operator initialize 2000`
    op1Pubkey = getInitializedAddress('Operator initialized at address', op1Output);

    // operators connect to vault
    await $`${jitoCliOp0} restaking operator initialize-operator-vault-ticket ${op0Pubkey} ${vaultPubkey}`
    await $`${jitoCliOp1} restaking operator initialize-operator-vault-ticket ${op1Pubkey} ${vaultPubkey}`

    await $`${jitoCliVaultAdmin} vault vault initialize-operator-delegation ${vaultPubkey} ${op0Pubkey}`
    await $`${jitoCliVaultAdmin} vault vault initialize-operator-delegation ${vaultPubkey} ${op1Pubkey}`

    await $`${jitoCliOp0} restaking operator warmup-operator-vault-ticket ${op0Pubkey} ${vaultPubkey}`
    await $`${jitoCliOp1} restaking operator warmup-operator-vault-ticket ${op1Pubkey} ${vaultPubkey}`
  })

  it("connect operator 0", async () => {
    const tx = dephyNcn.methods
      .initializeOperator()
      .accounts({
        config: configPubkey,
        ncn: ncnPubkey,
        operator: op0Pubkey,
      })
    
    const pubkeys = await tx.pubkeys()
    debugPubkeys(pubkeys)

    await tx.rpc()

    const ncnOperatorStateAccount = await provider.connection.getAccountInfo(pubkeys.ncnOperatorState)
    assert(ncnOperatorStateAccount.owner.equals(JITO_RESTAKING_ID))

    // wait a slot
    await Bun.sleep(400)

    await dephyNcn.methods
      .warmupOperator()
      .accounts({
        config: configPubkey,
        ncn: ncnPubkey,
        operator: op0Pubkey,
      })
      .rpc()

    // operator warmup
    await $`${jitoCliOp0} restaking operator operator-warmup-ncn ${op0Pubkey} ${ncnPubkey}`
  })

  it("connect operator 1", async () => {
    const tx = dephyNcn.methods
      .initializeOperator()
      .accounts({
        config: configPubkey,
        ncn: ncnPubkey,
        operator: op1Pubkey,
      })
    
    const pubkeys = await tx.pubkeys()
    debugPubkeys(pubkeys)

    await tx.rpc()

    const ncnOperatorStateAccount = await provider.connection.getAccountInfo(pubkeys.ncnOperatorState)
    assert(ncnOperatorStateAccount.owner.equals(JITO_RESTAKING_ID))

    // wait a slot
    await Bun.sleep(400)

    await dephyNcn.methods
      .warmupOperator()
      .accounts({
        config: configPubkey,
        ncn: ncnPubkey,
        operator: op1Pubkey,
      })
      .rpc()

    // operator warmup
    await $`${jitoCliOp1} restaking operator operator-warmup-ncn ${op1Pubkey} ${ncnPubkey}`
  })



  it("stake and delegate tokens", async () => {
    const userStTokenAccount = await spl.createAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      vaultMintKeypair.publicKey,
      userKeypair.publicKey,
    )

    await spl.mintTo(
      provider.connection,
      provider.wallet.payer,
      vaultMintKeypair.publicKey,
      userStTokenAccount,
      vaultAdminKeypair,
      web3.LAMPORTS_PER_SOL * 100,
    )

    const userStTokenAccountInfo = await spl.getAccount(provider.connection, userStTokenAccount);
    assert.equal(userStTokenAccountInfo.amount, BigInt(web3.LAMPORTS_PER_SOL * 100));

    // this step is user converting st to vrt
    await $`${jitoCliUser} vault vault mint-vrt ${vaultPubkey} 1234567890 1234567890`

    await $`${jitoCliVaultAdmin} vault vault delegate-to-operator ${vaultPubkey} ${op0Pubkey} 234567890`
    await $`${jitoCliVaultAdmin} vault vault delegate-to-operator ${vaultPubkey} ${op1Pubkey} 1000000000`
  })

  const proposedRewardsRoot = new Uint8Array(32)
  crypto.getRandomValues(proposedRewardsRoot)

  it("op0 vote", async () => {
    await nextEpoch();

    const tx = dephyNcn.methods
      .vote({
        proposedRewardsRoot: Array.from(proposedRewardsRoot),
      })
      .accounts({
        config: configPubkey,
        operatorAdmin: op0AdminKeypair.publicKey,
        operator: op0Pubkey,
        vault: vaultPubkey,
      })
      .signers([op0AdminKeypair])

    debugPubkeys(await tx.pubkeys());

    await tx.rpc();

    const ballotBox = await dephyNcn.account.ballotBox.fetch(ballotBoxPubkey);
    assert.equal(ballotBox.operatorsVoted.toNumber(), 1);
    assert.equal(ballotBox.approvedVotes.toNumber(), 234567890);
    assert.deepEqual(ballotBox.rewardsRoot, new Array(32).fill(0));
    assert.deepEqual(ballotBox.proposedRewardsRoot, Array.from(proposedRewardsRoot));
  })

  it("op1 vote", async () => {
    const tx = dephyNcn.methods
      .vote({
        proposedRewardsRoot: Array.from(proposedRewardsRoot),
      })
      .accounts({
        config: configPubkey,
        operatorAdmin: op1AdminKeypair.publicKey,
        operator: op1Pubkey,
        vault: vaultPubkey,
      })
      .signers([op1AdminKeypair])

    debugPubkeys(await tx.pubkeys());

    await tx.rpc();

    const ballotBox = await dephyNcn.account.ballotBox.fetch(ballotBoxPubkey);
    assert.equal(ballotBox.operatorsVoted.toNumber(), 2);
    assert.equal(ballotBox.approvedVotes.toNumber(), 1234567890);
    assert(ballotBox.lastConsensusEpoch.eq(ballotBox.epoch));
    assert.deepEqual(ballotBox.rewardsRoot, Array.from(proposedRewardsRoot));
  })
});
