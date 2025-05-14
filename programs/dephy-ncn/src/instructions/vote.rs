use anchor_lang::prelude::*;
use jito_restaking_client::{
    accounts::{Operator, OperatorVaultTicket},
    programs::JITO_RESTAKING_ID,
};
use jito_vault_client::{
    accounts::{Vault, VaultOperatorDelegation},
    programs::JITO_VAULT_ID,
};

use crate::{
    constants::*,
    error::DephyNcnError,
    state::{BallotBox, Config, VoterState},
};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct VoteArgs {
    pub proposed_rewards_root: [u8; 32],
}

#[derive(Accounts)]
pub struct Vote<'info> {
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [SEED_BALLOT_BOX, config.key().as_ref()], bump)]
    pub ballot_box: Account<'info, BallotBox>,
    #[account(mut, seeds = [SEED_VOTER_STATE, config.key().as_ref(), operator.key().as_ref()], bump)]
    pub voter_state: Account<'info, VoterState>,
    pub operator_admin: Signer<'info>,
    /// CHECK:
    #[account()]
    pub vault: UncheckedAccount<'info>,
    /// CHECK:
    #[account(address = voter_state.operator)]
    pub operator: UncheckedAccount<'info>,
    /// CHECK:
    #[account(seeds = [SEED_OPERATOR_VAULT_TICKET, operator.key().as_ref(), vault.key().as_ref()], bump, seeds::program = JITO_RESTAKING_ID)]
    pub operator_vault_ticket: UncheckedAccount<'info>,
    /// CHECK:
    #[account(seeds = [SEED_VAULT_OPERATOR_DELEGATION, vault.key().as_ref(), operator.key().as_ref()], bump, seeds::program = JITO_VAULT_ID)]
    pub vault_operator_delegation: UncheckedAccount<'info>,
}

pub fn handle_vote(ctx: Context<Vote>, args: VoteArgs) -> Result<()> {
    let ballot_box = &mut ctx.accounts.ballot_box;
    let voter_state = &mut ctx.accounts.voter_state;

    let clock = Clock::get()?;
    require!(
        clock.epoch > voter_state.last_voted_epoch,
        DephyNcnError::InvalidEpoch
    );

    // TODO: check more
    // Vault-Operator
    {
        let operator = Operator::from_bytes(&ctx.accounts.operator.try_borrow_data()?[8..])?;
        require_keys_eq!(
            operator.admin,
            ctx.accounts.operator_admin.key(),
            DephyNcnError::InvalidOperator
        );
    }

    {
        let operator_vault_ticket = OperatorVaultTicket::from_bytes(
            &ctx.accounts.operator_vault_ticket.try_borrow_data()?[8..],
        )?;
        require_keys_eq!(
            operator_vault_ticket.operator,
            ctx.accounts.operator.key(),
            DephyNcnError::InvalidOperatorVaultTicket
        );
    }

    let vault_operator_delegation = VaultOperatorDelegation::from_bytes(
        &ctx.accounts.vault_operator_delegation.try_borrow_data()?[8..],
    )?;
    require!(
        vault_operator_delegation.delegation_state.staked_amount > 0,
        DephyNcnError::NoDelegation
    );

    // first voter for this epoch
    // TODO: slash if consensus not reached?
    if clock.epoch > ballot_box.epoch {
        ballot_box.epoch = clock.epoch;
        ballot_box.approved_votes = 0;
        ballot_box.total_votes = 0;
        ballot_box.operators_voted = 0;
        ballot_box.proposed_rewards_root = args.proposed_rewards_root;
    }

    require_eq!(clock.epoch, ballot_box.epoch, DephyNcnError::InvalidEpoch);

    let proposed_rewards_root = ballot_box.proposed_rewards_root;
    ballot_box.operators_voted += 1;
    if args.proposed_rewards_root == proposed_rewards_root {
        ballot_box.approved_votes += vault_operator_delegation.delegation_state.staked_amount;
    }
    ballot_box.total_votes += vault_operator_delegation.delegation_state.staked_amount;

    voter_state.last_voted_epoch = clock.epoch;

    // when consensus first reached
    if ballot_box.epoch > ballot_box.last_consensus_epoch {
        let vault = Vault::from_bytes(&ctx.accounts.vault.try_borrow_data()?[8..])?;
        let consensus_reached = ballot_box.approved_votes >= vault.vrt_supply * 2 / 3;
        if consensus_reached {
            msg!("Consensus reached");

            ballot_box.last_consensus_epoch = ballot_box.epoch;
            ballot_box.rewards_root = proposed_rewards_root;
        }
    }

    Ok(())
}
