use anchor_lang::prelude::*;
use jito_restaking_client::JitoRestaking;

use crate::state::Config;

#[derive(Accounts)]
pub struct WarmupOperator<'info> {
    #[account()]
    pub config: Account<'info, Config>,
    /// CHECK:
    #[account(mut, address = config.ncn)]
    pub ncn: UncheckedAccount<'info>,
    #[account(seeds = [b"ncn_admin", ncn.key().as_ref()], bump)]
    pub ncn_admin: SystemAccount<'info>,
    /// CHECK:
    #[account(mut)]
    pub operator: UncheckedAccount<'info>,
    /// CHECK:
    #[account(seeds = [b"config"], bump, seeds::program = jito_restaking_program)]
    pub jito_restaking_config: UncheckedAccount<'info>,
    /// CHECK:
    #[account(mut, seeds = [b"ncn_operator_state", ncn.key.as_ref(), operator.key.as_ref()], seeds::program = jito_restaking_program, bump)]
    pub ncn_operator_state: UncheckedAccount<'info>,
    pub jito_restaking_program: Program<'info, JitoRestaking>,
}

pub fn handle_warmup_operator(ctx: Context<WarmupOperator>) -> Result<()> {
    jito_restaking_client::instructions::NcnWarmupOperatorCpi::new(
        &ctx.accounts.jito_restaking_program,
        jito_restaking_client::instructions::NcnWarmupOperatorCpiAccounts {
            config: &ctx.accounts.jito_restaking_config.to_account_info(),
            ncn: &ctx.accounts.ncn.to_account_info(),
            operator: &ctx.accounts.operator.to_account_info(),
            ncn_operator_state: &ctx.accounts.ncn_operator_state.to_account_info(),
            admin: &ctx.accounts.ncn_admin.to_account_info(),
        },
    )
    .invoke_signed(&[&[
        b"ncn_admin",
        ctx.accounts.ncn.key().as_ref(),
        &[ctx.bumps.ncn_admin],
    ]])?;

    Ok(())
}
