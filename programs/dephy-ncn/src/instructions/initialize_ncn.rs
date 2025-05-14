use anchor_lang::prelude::*;
use jito_restaking_client::{programs::JITO_RESTAKING_ID, JitoRestaking};

use crate::{
    constants::*,
    state::{BallotBox, Config},
};

#[derive(Accounts)]
pub struct InitializeNcn<'info> {
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
    #[account(mut, seeds = [SEED_NCN_ADMIN, ncn.key().as_ref()], bump)]
    pub ncn_admin: SystemAccount<'info>,
    pub authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub jito_restaking_program: Program<'info, JitoRestaking>,
}

pub fn handle_initialize_ncn(ctx: Context<InitializeNcn>) -> Result<()> {
    // ncn_admin is the payer of initialize_ncn CPI, so we need to pre-fund it
    let rent = Rent::get()?;
    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.ncn_admin.to_account_info(),
            },
        ),
        rent.minimum_balance(8 + jito_restaking_client::accounts::Ncn::LEN),
    )?;

    jito_restaking_client::instructions::InitializeNcnCpi::new(
        &ctx.accounts.jito_restaking_program,
        jito_restaking_client::instructions::InitializeNcnCpiAccounts {
            config: &ctx.accounts.jito_restaking_config.to_account_info(),
            base: &ctx.accounts.base.to_account_info(),
            ncn: &ctx.accounts.ncn.to_account_info(),
            admin: &ctx.accounts.ncn_admin.to_account_info(),
            system_program: &ctx.accounts.system_program.to_account_info(),
        },
    )
    .invoke_signed(&[&[
        SEED_NCN_ADMIN,
        ctx.accounts.ncn.key().as_ref(),
        &[ctx.bumps.ncn_admin],
    ]])?;

    let config = &mut ctx.accounts.config;
    config.ncn = ctx.accounts.ncn.key();
    config.authority = ctx.accounts.authority.key();

    let ballot_box = &mut ctx.accounts.ballot_box;
    ballot_box.config = config.key();

    Ok(())
}
