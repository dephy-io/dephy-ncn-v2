use anchor_lang::prelude::*;

// Seeds
#[constant]
pub const SEED_CONFIG: &[u8] = b"config";
#[constant]
pub const SEED_NCN: &[u8] = b"ncn";
#[constant]
pub const SEED_DEPHY_NCN: &[u8] = b"dephy_ncn";
#[constant]
pub const SEED_BALLOT_BOX: &[u8] = b"ballot_box";
#[constant]
pub const SEED_NCN_ADMIN: &[u8] = b"ncn_admin";
#[constant]
pub const SEED_NCN_OPERATOR_STATE: &[u8] = b"ncn_operator_state";
#[constant]
pub const SEED_VOTER_STATE: &[u8] = b"voter_state";
#[constant]
pub const SEED_NCN_VAULT_TICKET: &[u8] = b"ncn_vault_ticket";
#[constant]
pub const SEED_OPERATOR_VAULT_TICKET: &[u8] = b"operator_vault_ticket";
#[constant]
pub const SEED_VAULT_OPERATOR_DELEGATION: &[u8] = b"vault_operator_delegation";
#[constant]
pub const SEED_REWARDS_STATE: &[u8] = b"rewards_state";
#[constant]
pub const SEED_REWARDS_VAULT: &[u8] = b"rewards_vault";
