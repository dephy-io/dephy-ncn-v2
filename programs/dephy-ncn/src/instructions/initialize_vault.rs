use anchor_lang::prelude::*;
use jito_restaking_client::JitoRestaking;

use crate::{constants::*, state::Config};

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account()]
    pub config: Account<'info, Config>,
    /// CHECK:
    #[account(mut, address = config.ncn)]
    pub ncn: UncheckedAccount<'info>,
    /// CHECK:
    pub vault: UncheckedAccount<'info>,
    /// CHECK:
    #[account(
        mut,
        seeds = [SEED_NCN_VAULT_TICKET, ncn.key().as_ref(), vault.key().as_ref()],
        seeds::program = jito_restaking_program, bump
    )]
    pub ncn_vault_ticket: UncheckedAccount<'info>,
    /// CHECK:
    #[account(seeds = [SEED_CONFIG], bump, seeds::program = jito_restaking_program)]
    pub jito_restaking_config: UncheckedAccount<'info>,
    #[account(seeds = [SEED_NCN_ADMIN, ncn.key().as_ref()], bump)]
    pub ncn_admin: SystemAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub jito_restaking_program: Program<'info, JitoRestaking>,
}

pub fn handle_initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
    jito_restaking_client::instructions::InitializeNcnVaultTicketCpi::new(
        &ctx.accounts.jito_restaking_program,
        jito_restaking_client::instructions::InitializeNcnVaultTicketCpiAccounts {
            config: &ctx.accounts.jito_restaking_config.to_account_info(),
            ncn: &ctx.accounts.ncn.to_account_info(),
            vault: &ctx.accounts.vault.to_account_info(),
            ncn_vault_ticket: &ctx.accounts.ncn_vault_ticket.to_account_info(),
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

    Ok(())
}
