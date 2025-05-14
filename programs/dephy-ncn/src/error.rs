use anchor_lang::prelude::*;

#[error_code]
pub enum DephyNcnError {
    #[msg("Config mismatch")]
    ConfigMismatch,
    #[msg("Invalid authority")]
    InvalidAuthority,
    #[msg("Invalid vault")]
    InvalidVault,
    #[msg("Invalid operator")]
    InvalidOperator,
    #[msg("Invalid operator vault ticket")]
    InvalidOperatorVaultTicket,
    #[msg("Invalid vault operator delegation")]
    InvalidVaultOperatorDelegation,
    #[msg("Invalid epoch")]
    InvalidEpoch,
    #[msg("Proposed rewards root already exists")]
    NonEmptyProposedRoot,
    #[msg("No proposed rewards root")]
    EmptyProposedRoot,
    #[msg("No delegation")]
    NoDelegation,
}
