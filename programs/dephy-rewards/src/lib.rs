#![allow(unexpected_cfgs)]

use anchor_lang::{prelude::*, solana_program::keccak};
use anchor_spl::{associated_token::AssociatedToken, token_interface::{Mint, TokenAccount, TokenInterface}};

declare_id!("BEQB5zna1N4eXTGPLdAVG9HJ1bL8rXSMrR7FdycJ6Zd9");

#[program]
pub mod dephy_rewards {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let global_config = &mut ctx.accounts.global_config;
        global_config.admin = ctx.accounts.admin.key();

        Ok(())
    }

    pub fn initialize_rewards_state(ctx: Context<InitializeRewardsState>) -> Result<()> {
        let rewards_state = &mut ctx.accounts.rewards_state;
        rewards_state.authority = ctx.accounts.authority.key();
        rewards_state.rewards_mint = ctx.accounts.rewards_mint.key();
        rewards_state.rewards_token_account = ctx.accounts.rewards_token_account.key();

        Ok(())
    }

    pub fn update_merkle_root(ctx: Context<UpdateMerkleRoot>, args: UpdateMerkleRootArgs) -> Result<()> {
        let rewards_state = &mut ctx.accounts.rewards_state;
        rewards_state.merkle_root = args.merkle_root;

        Ok(())
    }

    pub fn update_authority(ctx: Context<UpdateAuthority>) -> Result<()> {
        let rewards_state = &mut ctx.accounts.rewards_state;
        let global_config = &ctx.accounts.global_config;
        if global_config.admin != ctx.accounts.authority.key() {
            if rewards_state.authority != ctx.accounts.authority.key() {
                return Err(DephyRewardsError::InvalidAuthority.into());
            }
        }

        rewards_state.authority = ctx.accounts.new_authority.key();

        Ok(())
    }

    pub fn claim_rewards(ctx: Context<ClaimRewards>, args: ClaimRewardsArgs) -> Result<()> {
        let leaf = keccak::hashv(&[
            ctx.accounts.owner.key().as_ref(),
            &args.total_rewards.to_le_bytes(),
        ]);
        let computed_root = recompute_root(leaf.to_bytes(), &args.proof, args.index);

        match ctx.accounts.rewards_state.merkle_root {
            MerkleRoot::Inplace { hash: merkle_root } => {
                require!(computed_root == merkle_root, DephyRewardsError::InvalidProof);
            },
            MerkleRoot::External { pubkey, offset } => {
                let merkle_root_account = ctx.accounts.maybe_merkle_root_account.as_deref().unwrap();
                require_keys_eq!(pubkey, merkle_root_account.key(), DephyRewardsError::InvalidProof);

                let start = offset as usize;
                if let Some(merkle_root_slice) = merkle_root_account.data.borrow().get(start..start+32) {
                    let merkle_root: [u8; 32] = merkle_root_slice.try_into().unwrap();
                    require!(computed_root == merkle_root, DephyRewardsError::InvalidProof);
                } else {
                    return Err(DephyRewardsError::InvalidProof.into());
                }
            },
        }

        let claim_state = &mut ctx.accounts.claim_state;

        // transfer unclaimed rewards tokens
        let unclaimed_rewards = args.total_rewards - claim_state.claimed_rewards;
        require!(unclaimed_rewards > 0, DephyRewardsError::AlreadyClaimed);

        anchor_spl::token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.rewards_token_program.to_account_info(),
                anchor_spl::token_interface::TransferChecked {
                    mint: ctx.accounts.rewards_mint.to_account_info(),
                    from: ctx.accounts.rewards_token_account.to_account_info(),
                    to: ctx.accounts.beneficiary_token_account.to_account_info(),
                    authority: ctx.accounts.rewards_vault.to_account_info(),
                },
                &[&[
                    b"rewards_vault",
                    ctx.accounts.rewards_state.key().as_ref(),
                    &[ctx.bumps.rewards_vault],
                ]],
            ),
            unclaimed_rewards,
            ctx.accounts.rewards_mint.decimals,
        )?;

        claim_state.owner = ctx.accounts.owner.key();
        claim_state.claimed_rewards = args.total_rewards;

        Ok(())
    }
}


#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init, payer = payer, space = GlobalConfig::DISCRIMINATOR.len() + GlobalConfig::INIT_SPACE,
        seeds = [b"global_config"], bump
    )]
    pub global_config: Account<'info, GlobalConfig>,
    pub admin: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct InitializeRewardsState<'info> {
    #[account(init, payer = payer, space = RewardsState::DISCRIMINATOR.len() + RewardsState::INIT_SPACE)]
    pub rewards_state: Account<'info, RewardsState>,
    #[account()]
    pub authority: Signer<'info>,
    #[account(seeds = [b"rewards_vault", rewards_state.key().as_ref()], bump)]
    pub rewards_vault: SystemAccount<'info>,
    #[account(mint::token_program = rewards_token_program)]
    pub rewards_mint: InterfaceAccount<'info, Mint>,
    #[account(
        init, payer = payer,
        associated_token::mint = rewards_mint,
        associated_token::authority = rewards_vault,
        associated_token::token_program = rewards_token_program
    )]
    pub rewards_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub rewards_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateMerkleRoot<'info> {
    #[account(mut)]
    pub rewards_state: Account<'info, RewardsState>,
    #[account(address = rewards_state.authority @ DephyRewardsError::InvalidAuthority)]
    pub authority: Signer<'info>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UpdateMerkleRootArgs {
    merkle_root: MerkleRoot,
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
    #[account(seeds = [b"global_config"], bump)]
    pub global_config: Account<'info, GlobalConfig>,
    pub authority: Signer<'info>,
    #[account(mut)]
    pub rewards_state: Account<'info, RewardsState>,
    /// CHECK: new authority
    pub new_authority: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account()]
    pub rewards_state: Account<'info, RewardsState>,
    #[account(seeds = [b"rewards_vault", rewards_state.key().as_ref()], bump)]
    pub rewards_vault: SystemAccount<'info>,
    #[account(mint::token_program = rewards_token_program)]
    pub rewards_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, address = rewards_state.rewards_token_account)]
    pub rewards_token_account: InterfaceAccount<'info, TokenAccount>,
    pub owner: Signer<'info>,
    #[account(
        init_if_needed, payer = payer,
        space = RewardsState::DISCRIMINATOR.len() + RewardsState::INIT_SPACE,
        seeds = [b"claim_state", rewards_state.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub claim_state: Account<'info, ClaimState>,
    #[account(mut, token::mint = rewards_mint.key(), token::token_program = rewards_token_program)]
    pub beneficiary_token_account: InterfaceAccount<'info, TokenAccount>,
    /// CHECK:
    pub maybe_merkle_root_account: Option<UncheckedAccount<'info>>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub rewards_token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ClaimRewardsArgs {
    pub index: u32,
    pub total_rewards: u64,
    pub proof: Vec<[u8; 32]>,
}


#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub enum MerkleRoot {
    Inplace {
        hash: [u8; 32]
    },
    External {
        pubkey: Pubkey,
        offset: u64,
    }
}

#[account]
#[derive(InitSpace)]
pub struct GlobalConfig {
    pub admin: Pubkey,
}

#[account]
#[derive(InitSpace)]
pub struct RewardsState {
    pub authority: Pubkey,
    pub rewards_mint: Pubkey,
    pub rewards_token_account: Pubkey,
    pub merkle_root: MerkleRoot,
}

#[account]
#[derive(InitSpace)]
pub struct ClaimState {
    pub owner: Pubkey,
    pub claimed_rewards: u64,
}

#[error_code]
pub enum DephyRewardsError {
    #[msg("Invalid authority")]
    InvalidAuthority,
    #[msg("Invalid proof")]
    InvalidProof,
    #[msg("Already claimed")]
    AlreadyClaimed,
}


// from spl-merkle-tree-reference
type Node = [u8; 32];

pub fn recompute_root(mut leaf: Node, proof: &[Node], index: u32) -> Node {
    for (i, s) in proof.iter().enumerate() {
        if index >> i & 1 == 0 {
            let res = keccak::hashv(&[&leaf, s.as_ref()]);
            leaf.copy_from_slice(res.as_ref());
        } else {
            let res = keccak::hashv(&[s.as_ref(), &leaf]);
            leaf.copy_from_slice(res.as_ref());
        }
    }
    leaf
}
