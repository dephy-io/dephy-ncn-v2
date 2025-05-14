import * as anchor from "@coral-xyz/anchor";
import { Program, web3, BN } from "@coral-xyz/anchor";
import * as spl from "@solana/spl-token";
import { DephyRewards } from "../target/types/dephy_rewards";
import { assert } from "chai";
import { buildRewardsTree } from "./rewards-tree";


describe("dephy-rewards", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider);

  const dephyRewards = anchor.workspace.dephyRewards as Program<DephyRewards>;

  const rewardsMintKeypair = web3.Keypair.generate()
  const rewardsStateKeypair = web3.Keypair.generate()
  const authority = web3.Keypair.generate()
  
  const [rewardsVault, _rewardsVaultBump] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("rewards_vault"), rewardsStateKeypair.publicKey.toBuffer()],
    dephyRewards.programId
  );
  
  const rewardsTokenAccount = spl.getAssociatedTokenAddressSync(
    rewardsMintKeypair.publicKey,
    rewardsVault,
    true
  )
  
  // Test users
  const userCount = 5
  const users = new Array(userCount).fill(0).map(() => web3.Keypair.generate())

  const userRewards = users.map((user, i) => ({
    user: user.publicKey,
    amount: BigInt(i) * 1000000n
  }));
  const rewardsTree = buildRewardsTree(userRewards);

  before(async () => {
    await spl.createMint(
      provider.connection,
      provider.wallet.payer,
      authority.publicKey,
      null,
      6,
      rewardsMintKeypair,
    );
  });

  it("initialize rewards state", async () => {
    const tx = await dephyRewards.methods
      .initializeRewardsState()
      .accounts({
        rewardsState: rewardsStateKeypair.publicKey,
        authority: authority.publicKey,
        rewardsMint: rewardsMintKeypair.publicKey,
        payer: provider.wallet.publicKey,
        rewardsTokenProgram: spl.TOKEN_PROGRAM_ID,
      })
      .signers([rewardsStateKeypair, authority])
      .rpc();

    console.log("Initialize transaction signature", tx);

    const rewardsState = await dephyRewards.account.rewardsState.fetch(rewardsStateKeypair.publicKey);
    assert(rewardsState.authority.equals(authority.publicKey));
    assert(rewardsState.rewardsMint.equals(rewardsMintKeypair.publicKey));
    assert(rewardsState.rewardsTokenAccount.equals(rewardsTokenAccount));
  });


  it("update merkle root", async () => {
    const merkleRoot = Array.from(rewardsTree.getRoot())

    const tx = await dephyRewards.methods
      .updateMerkleRoot({
        merkleRoot: {
          inplace: { hash: merkleRoot }
        }
      })
      .accounts({
        rewardsState: rewardsStateKeypair.publicKey,
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc();
    
    console.log("Update merkle root transaction signature", tx);
    
    const rewardsState = await dephyRewards.account.rewardsState.fetch(rewardsStateKeypair.publicKey);
    assert.deepEqual(Array.from(rewardsState.merkleRoot.inplace.hash), merkleRoot);
  });

  it("mint rewards tokens to rewards account", async () => {
    const totalRewardsAmount = userRewards.reduce((acc, {amount}) => acc + amount, 0n)

    await spl.mintTo(
      provider.connection,
      provider.wallet.payer,
      rewardsMintKeypair.publicKey,
      rewardsTokenAccount,
      authority,
      totalRewardsAmount
    );
    
    const tokenAccountInfo = await spl.getAccount(
      provider.connection,
      rewardsTokenAccount
    );
    
    assert.equal(tokenAccountInfo.amount, totalRewardsAmount);
  });


  const userIndex = 1
  const user = users[userIndex]
  const [claimState] = web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("claim_state"),
      rewardsStateKeypair.publicKey.toBuffer(),
      user.publicKey.toBuffer()
    ],
    dephyRewards.programId
  );

  const proof = rewardsTree.getProof(userIndex).proof.map(b => Array.from(b))
  const rewardsToClaim = userRewards[userIndex].amount
  let userTokenAccount: web3.PublicKey

  it("claim rewards", async () => {
    userTokenAccount = await spl.createAssociatedTokenAccountIdempotent(
      provider.connection,
      provider.wallet.payer,
      rewardsMintKeypair.publicKey,
      user.publicKey,
    )

    const tx = await dephyRewards.methods
      .claimRewards({
        index: userIndex,
        totalRewards: new BN(rewardsToClaim.toString()),
        proof
      })
      .accounts({
        rewardsState: rewardsStateKeypair.publicKey,
        rewardsMint: rewardsMintKeypair.publicKey,
        rewardsTokenAccount: rewardsTokenAccount,
        owner: user.publicKey,
        beneficiaryTokenAccount: userTokenAccount,
        maybeMerkleRootAccount: null,
        payer: provider.wallet.publicKey,
        rewardsTokenProgram: spl.TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();
    
    console.log("Claim rewards transaction signature", tx);
    
    // Verify the claim state
    const claimStateAccount = await dephyRewards.account.claimState.fetch(claimState);
    assert(claimStateAccount.owner.equals(user.publicKey), "Claim state owner is incorrect");
    assert(claimStateAccount.claimedRewards.eqn(Number(rewardsToClaim)));
    
    // Verify the user received the tokens
    const userTokenAccountInfo = await spl.getAccount(
      provider.connection,
      userTokenAccount
    );
    
    assert.equal(rewardsToClaim, userTokenAccountInfo.amount);
  });

  it("cannot claim rewards twice", async () => {
    try {
      await dephyRewards.methods
        .claimRewards({
          index: userIndex,
          totalRewards: new BN(rewardsToClaim.toString()),
          proof
        })
        .accounts({
          rewardsState: rewardsStateKeypair.publicKey,
          rewardsMint: rewardsMintKeypair.publicKey,
          rewardsTokenAccount: rewardsTokenAccount,
          owner: user.publicKey,
          beneficiaryTokenAccount: userTokenAccount,
          maybeMerkleRootAccount: null,
          payer: provider.wallet.publicKey,
          rewardsTokenProgram: spl.TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();
      
      assert.fail("Should not be able to claim rewards twice");
    } catch (error) {
      assert.include(error.message, "AlreadyClaimed", "Expected AlreadyClaimed error");
    }
  });
});
