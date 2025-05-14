
use crate::constants::*;

#[derive(Accounts)]
pub struct InitializeRewards<'info> {
    /// CHECK:
    #[account(mut, seeds = [SEED_CONFIG], bump, seeds::program = JITO_RESTAKING_ID)]
    pub jito_restaking_config: UncheckedAccount<'info>,
    pub base: Signer<'info>,
    #[account(mut, seeds = [SEED_NCN, base.key().as_ref()], bump, seeds::program = JITO_RESTAKING_ID)]
    pub ncn: SystemAccount<'info>,
    #[account(init, payer = payer,
        space = Config::DISCRIMINATOR.len() + Config::INIT_SPACE,
        seeds = [SEED_DEPHY_NCN, ncn.key().as_ref()], bump
    )]
    pub config: Account<'info, Config>,
    #[account(init, payer = payer,
        space = BallotBox::DISCRIMINATOR.len() + BallotBox::INIT_SPACE,
        seeds = [SEED_BALLOT_BOX, config.key().as_ref()], bump
    )]
    pub ballot_box: Account<'info, BallotBox>,
    #[account(mut, seeds = [SEED_REWARDS_STATE, config.key().as_ref()], bump)]
    pub rewards_state: Account<'info, RewardsState>,
    #[account(seeds = [SEED_REWARDS_VAULT, rewards_state.key().as_ref()], bump)]
    pub rewards_vault: SystemAccount<'info>,
    #[account(mint::token_program = rewards_token_program)]
    pub rewards_mint: InterfaceAccount<'info, Mint>,
    /// CHECK: checked in rewards program
    #[account(mut)]
    pub rewards_token_account: UncheckedAccount<'info>,
    #[account(mut, seeds = [SEED_NCN_ADMIN, ncn.key().as_ref()], bump)]
    pub ncn_admin: SystemAccount<'info>,
    pub authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    /// CHECK:
    #[account(address = JITO_RESTAKING_ID)]
    pub jito_restaking_program: UncheckedAccount<'info>,
    pub rewards_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}
