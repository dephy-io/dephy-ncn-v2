use anchor_lang::prelude::*;
use jito_restaking_client::JitoRestaking;

use crate::{
    constants::*,
    state::{Config, VoterState},
};

#[derive(Accounts)]
pub struct InitializeOperator<'info> {
    #[account()]
    pub config: Account<'info, Config>,
    /// CHECK:
    #[account(mut, address = config.ncn)]
    pub ncn: UncheckedAccount<'info>,
    #[account(seeds = [SEED_NCN_ADMIN, ncn.key().as_ref()], bump)]
    pub ncn_admin: SystemAccount<'info>,
    /// CHECK:
    #[account(mut)]
    pub operator: UncheckedAccount<'info>,
    /// CHECK:
    #[account(seeds = [SEED_CONFIG], bump, seeds::program = jito_restaking_program)]
    pub jito_restaking_config: UncheckedAccount<'info>,
    /// CHECK:
    #[account(mut, seeds = [SEED_NCN_OPERATOR_STATE, ncn.key.as_ref(), operator.key.as_ref()], seeds::program = jito_restaking_program, bump)]
    pub ncn_operator_state: UncheckedAccount<'info>,
    #[account(
        init, payer = payer,
        space = VoterState::DISCRIMINATOR.len() + VoterState::INIT_SPACE,
        seeds = [SEED_VOTER_STATE, config.key().as_ref(), operator.key().as_ref()], bump
    )]
    pub voter_state: Account<'info, VoterState>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub jito_restaking_program: Program<'info, JitoRestaking>,
}

pub fn handle_initialize_operator(ctx: Context<InitializeOperator>) -> Result<()> {
    jito_restaking_client::instructions::InitializeNcnOperatorStateCpi::new(
        &ctx.accounts.jito_restaking_program,
        jito_restaking_client::instructions::InitializeNcnOperatorStateCpiAccounts {
            config: &ctx.accounts.jito_restaking_config.to_account_info(),
            ncn: &ctx.accounts.ncn.to_account_info(),
            operator: &ctx.accounts.operator.to_account_info(),
            ncn_operator_state: &ctx.accounts.ncn_operator_state.to_account_info(),
            admin: &ctx.accounts.ncn_admin.to_account_info(),
            payer: &ctx.accounts.payer.to_account_info(),
            system_program: &ctx.accounts.system_program.to_account_info(),
        },
    )
    .invoke_signed(&[&[
        SEED_NCN_ADMIN,
        ctx.accounts.ncn.key().as_ref(),
        &[ctx.bumps.ncn_admin],
    ]])?;

    let voter_state = &mut ctx.accounts.voter_state;
    voter_state.config = ctx.accounts.config.key();
    voter_state.operator = ctx.accounts.operator.key();
    voter_state.last_voted_epoch = 0;

    Ok(())
}
