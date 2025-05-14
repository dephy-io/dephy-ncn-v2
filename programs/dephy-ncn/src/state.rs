use anchor_lang::prelude::*;


#[account]
#[derive(InitSpace)]
pub struct Config {
    pub ncn: Pubkey,
    pub authority: Pubkey,
}


// TODO: vote window not bind to epoch
#[account]
#[derive(InitSpace)]
pub struct BallotBox {
    pub config: Pubkey,
    pub epoch: u64,
    pub last_consensus_epoch: u64,
    pub operators_voted: u64,
    pub approved_votes: u64,
    pub total_votes: u64,
    pub rewards_root: [u8; 32],
    pub proposed_rewards_root: [u8; 32],
}


#[account]
#[derive(InitSpace)]
pub struct VoterState {
    pub config: Pubkey,
    pub operator: Pubkey,
    pub operator_vault_ticket: Pubkey,
    pub vault_operator_delegation: Pubkey,
    pub last_voted_epoch: u64,
}
