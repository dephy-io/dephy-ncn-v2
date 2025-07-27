import assert from "assert";
import {
  Address, airdropFactory, createSolanaClient, createTransaction,
  devnet, generateKeyPairSigner, getSignatureFromTransaction, IInstruction,
  isSolanaError, KeyPairSigner, lamports, signTransactionMessageWithSigners,
  SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM,
  SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE,
} from "gill";
import * as splToken from "gill/programs/token";
import * as dephyRewards from '../clients/dephy-rewards/js/src'

const payer = await generateKeyPairSigner()

describe("dephy-rewards with solana kit", () => {
  const { rpc, rpcSubscriptions, sendAndConfirmTransaction } = createSolanaClient({
    urlOrMoniker: devnet('localnet')
  })

  const airdrop = airdropFactory({ rpc, rpcSubscriptions })

  const sendAndConfirmIxs = async (instructions: IInstruction[], config = { showError: true }) => {
    const latestBlockhash = (await rpc.getLatestBlockhash().send()).value

    const transaction = createTransaction({
      feePayer: payer,
      instructions,
      latestBlockhash,
      version: 0
    })

    try {
      const signedTx = await signTransactionMessageWithSigners(transaction)
      await sendAndConfirmTransaction(signedTx, { commitment: 'confirmed' })

      return getSignatureFromTransaction(signedTx)
    } catch (error) {
      if (isSolanaError(error) && config.showError) {
        console.error(error.context)
      }

      throw error
    }
  }

  let rewardsMintKeypair: KeyPairSigner
  let rewardsStateKeypair: KeyPairSigner
  let authority: KeyPairSigner
  let rewardsVault: Address
  let rewardsTokenAccount: Address

  // Test users
  const userCount = 5
  let users: KeyPairSigner[]
  let userRewards: { user: Address; amount: bigint }[]
  let rewardsTree: dephyRewards.MerkleTree

  before(async () => {
    await airdrop({
      recipientAddress: payer.address,
      commitment: "confirmed",
      lamports: lamports(1_000_000_000n)
    })

    users = await Promise.all(new Array(userCount).fill(0).map(() => generateKeyPairSigner()))

    userRewards = users.map((user, i) => ({
      user: user.address,
      amount: BigInt(i) * 1000000n
    }))
    rewardsTree = dephyRewards.buildRewardsTree(userRewards)

    rewardsMintKeypair = await generateKeyPairSigner()
    rewardsStateKeypair = await generateKeyPairSigner()
    authority = await generateKeyPairSigner()

    const rewardsVaultPda = await dephyRewards.findRewardsVaultPda({
      rewardsState: rewardsStateKeypair.address,
    })
    rewardsVault = rewardsVaultPda[0]

    const rewardsTokenPda = await splToken.findAssociatedTokenPda({
      owner: rewardsVault,
      tokenProgram: splToken.TOKEN_2022_PROGRAM_ADDRESS,
      mint: rewardsMintKeypair.address,
    })
    rewardsTokenAccount = rewardsTokenPda[0]

    await sendAndConfirmIxs(
      splToken.getCreateTokenInstructions({
        feePayer: payer,
        mint: rewardsMintKeypair,
        decimals: 6,
        metadata: {
          name: "Rewards Token",
          symbol: "RWT",
          uri: "",
          isMutable: false
        },
        metadataAddress: rewardsMintKeypair.address,
        tokenProgram: splToken.TOKEN_2022_PROGRAM_ADDRESS,
      })
    )
  })


  let admin: KeyPairSigner
  it('initialize global config', async () => {
    admin = await generateKeyPairSigner()
    const globalConfigPda = await dephyRewards.findGlobalConfigPda()

    const tx = await sendAndConfirmIxs([
      await dephyRewards.getInitializeInstructionAsync({
        admin,
        payer,
      })
    ])

    console.log("Initialize global config transaction signature", tx)

    const globalConfig = await dephyRewards.fetchGlobalConfig(rpc, globalConfigPda[0])
    assert.equal(globalConfig.data.admin, admin.address)
  })


  it("initialize rewards state", async () => {
    const tx = await sendAndConfirmIxs([
      await dephyRewards.getInitializeRewardsStateInstructionAsync({
        rewardsState: rewardsStateKeypair,
        authority: authority,
        rewardsMint: rewardsMintKeypair.address,
        payer,
        rewardsTokenProgram: splToken.TOKEN_2022_PROGRAM_ADDRESS
      })
    ])

    const rewardsState = await dephyRewards.fetchRewardsState(rpc, rewardsStateKeypair.address)
    assert.equal(rewardsState.data.authority, authority.address)
    assert.equal(rewardsState.data.rewardsMint, rewardsMintKeypair.address)
    assert.equal(rewardsState.data.rewardsTokenAccount, rewardsTokenAccount)
  })


  it("update merkle root", async () => {
    const merkleRoot = rewardsTree.getRoot()

    const tx = await sendAndConfirmIxs([
      dephyRewards.getUpdateMerkleRootInstruction({
        rewardsState: rewardsStateKeypair.address,
        authority: authority,
        merkleRoot: dephyRewards.merkleRoot("Inplace", { hash: merkleRoot })
      })
    ])

    console.log("Update merkle root transaction signature", tx)

    const rewardsState = await dephyRewards.fetchRewardsState(rpc, rewardsStateKeypair.address)
    assert(rewardsState.data.merkleRoot.__kind == "Inplace")
    assert.deepEqual(rewardsState.data.merkleRoot.hash, merkleRoot)
  })

  it("mint rewards tokens to rewards account", async () => {
    const totalRewardsAmount = userRewards.reduce((acc, { amount }) => acc + amount, 0n)

    await sendAndConfirmIxs(
      splToken.getMintTokensInstructions({
        feePayer: payer,
        mint: rewardsMintKeypair.address,
        mintAuthority: payer,
        destination: rewardsVault,
        ata: rewardsTokenAccount,
        amount: totalRewardsAmount,
        tokenProgram: splToken.TOKEN_2022_PROGRAM_ADDRESS,
      })
    )

    const tokenAccountInfo = await splToken.fetchToken(
      rpc,
      rewardsTokenAccount
    )

    assert.equal(tokenAccountInfo.data.amount, totalRewardsAmount)
  })


  const userIndex = 1
  let user: KeyPairSigner
  let userTokenAccount: Address

  it("claim rewards", async () => {
    user = users[userIndex]
    const proof = rewardsTree.getProof(userIndex).proof
    const rewardsToClaim = userRewards[userIndex].amount
    const userTokenPda = await splToken.findAssociatedTokenPda({
      mint: rewardsMintKeypair.address,
      owner: user.address,
      tokenProgram: splToken.TOKEN_2022_PROGRAM_ADDRESS,
    })
    userTokenAccount = userTokenPda[0]

    const tx = await sendAndConfirmIxs([
      await splToken.getCreateAssociatedTokenIdempotentInstructionAsync({
        payer,
        owner: user.address,
        mint: rewardsMintKeypair.address,
        tokenProgram: splToken.TOKEN_2022_PROGRAM_ADDRESS,
      }),
      await dephyRewards.getClaimRewardsInstructionAsync({
        rewardsState: rewardsStateKeypair.address,
        rewardsMint: rewardsMintKeypair.address,
        rewardsTokenAccount,
        owner: user,
        beneficiaryTokenAccount: userTokenAccount,
        payer,
        rewardsTokenProgram: splToken.TOKEN_2022_PROGRAM_ADDRESS,
        index: userIndex,
        totalRewards: rewardsToClaim,
        proof,
      })
    ])

    console.log("Claim rewards transaction signature", tx)

    const [claimStateAddress] = await dephyRewards.findClaimStatePda({
      rewardsState: rewardsStateKeypair.address,
      user: user.address,
    })

    // Verify the claim state
    const claimStateAccount = await dephyRewards.fetchMaybeClaimState(rpc, claimStateAddress)
    assert(claimStateAccount.exists)
    assert.equal(claimStateAccount.data.owner, user.address, "Claim state owner is incorrect")
    assert.equal(claimStateAccount.data.claimedRewards, rewardsToClaim)

    // Verify the user received the tokens
    const userTokenAccountInfo = await splToken.fetchToken(rpc, userTokenAccount)
    assert.equal(rewardsToClaim, userTokenAccountInfo.data.amount)
  })

  it("cannot claim rewards twice", async () => {
    user = users[userIndex]
    const proof = rewardsTree.getProof(userIndex).proof
    const rewardsToClaim = userRewards[userIndex].amount

    await assert.rejects(async () => {
      await sendAndConfirmIxs([
        await dephyRewards.getClaimRewardsInstructionAsync({
          rewardsState: rewardsStateKeypair.address,
          rewardsMint: rewardsMintKeypair.address,
          rewardsTokenAccount,
          owner: user,
          beneficiaryTokenAccount: userTokenAccount,
          payer,
          rewardsTokenProgram: splToken.TOKEN_2022_PROGRAM_ADDRESS,
          index: userIndex,
          totalRewards: rewardsToClaim,
          proof,
        })
      ], { showError: false })
    }, (err) => {
      assert(isSolanaError(err, SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE))
      assert(isSolanaError(err.cause, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM))
      assert.equal(err.cause.context.code, dephyRewards.DEPHY_REWARDS_ERROR__ALREADY_CLAIMED)
      return true
    })
  })


  it('update authority', async () => {
    const newAuthority = await generateKeyPairSigner()
    const tx = await sendAndConfirmIxs([
      await dephyRewards.getUpdateAuthorityInstructionAsync({
        rewardsState: rewardsStateKeypair.address,
        authority: admin,
        newAuthority: newAuthority.address,
      })
    ])

    console.log("Update authority transaction signature", tx)

    const rewardsState = await dephyRewards.fetchRewardsState(rpc, rewardsStateKeypair.address)
    assert.equal(rewardsState.data.authority, newAuthority.address)
  })

})
