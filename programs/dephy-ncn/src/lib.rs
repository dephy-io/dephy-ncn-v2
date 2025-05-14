#![allow(unexpected_cfgs)]

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use instructions::*;

declare_id!("3AGd4bShjwtx7vNJHJowU6UmRdrjqrchL1Zu8smph5pk");

#[program]
pub mod dephy_ncn {
    use super::*;

    pub fn initialize_ncn(ctx: Context<InitializeNcn>) -> Result<()> {
        handle_initialize_ncn(ctx)
    }

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        handle_initialize_vault(ctx)
    }

    pub fn warmup_vault(ctx: Context<WarmupVault>) -> Result<()> {
        handle_warmup_vault(ctx)
    }

    pub fn initialize_operator(ctx: Context<InitializeOperator>) -> Result<()> {
        handle_initialize_operator(ctx)
    }

    pub fn warmup_operator(ctx: Context<WarmupOperator>) -> Result<()> {
        handle_warmup_operator(ctx)
    }

    pub fn vote(ctx: Context<Vote>, args: VoteArgs) -> Result<()> {
        handle_vote(ctx, args)
    }
}
