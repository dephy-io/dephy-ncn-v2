//! This code was AUTOGENERATED using the codama library.
//! Please DO NOT EDIT THIS FILE, instead use visitors
//! to add features, then rerun codama to update it.
//!
//! <https://github.com/codama-idl/codama>
//!

use crate::generated::types::SlotToggle;
use borsh::BorshDeserialize;
use borsh::BorshSerialize;
use solana_program::pubkey::Pubkey;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, Eq, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct NcnOperatorState {
    #[cfg_attr(
        feature = "serde",
        serde(with = "serde_with::As::<serde_with::DisplayFromStr>")
    )]
    pub ncn: Pubkey,
    #[cfg_attr(
        feature = "serde",
        serde(with = "serde_with::As::<serde_with::DisplayFromStr>")
    )]
    pub operator: Pubkey,
    pub index: u64,
    pub ncn_opt_in_state: SlotToggle,
    pub operator_opt_in_state: SlotToggle,
    pub bump: u8,
    #[cfg_attr(feature = "serde", serde(with = "serde_with::As::<serde_with::Bytes>"))]
    pub reserved: [u8; 263],
}

impl NcnOperatorState {
    pub const LEN: usize = 432;

    #[inline(always)]
    pub fn from_bytes(data: &[u8]) -> Result<Self, std::io::Error> {
        let mut data = data;
        Self::deserialize(&mut data)
    }
}

impl<'a> TryFrom<&solana_program::account_info::AccountInfo<'a>> for NcnOperatorState {
    type Error = std::io::Error;

    fn try_from(
        account_info: &solana_program::account_info::AccountInfo<'a>,
    ) -> Result<Self, Self::Error> {
        let mut data: &[u8] = &(*account_info.data).borrow();
        Self::deserialize(&mut data)
    }
}

#[cfg(feature = "fetch")]
pub fn fetch_ncn_operator_state(
    rpc: &solana_client::rpc_client::RpcClient,
    address: &solana_program::pubkey::Pubkey,
) -> Result<crate::shared::DecodedAccount<NcnOperatorState>, std::io::Error> {
    let accounts = fetch_all_ncn_operator_state(rpc, &[*address])?;
    Ok(accounts[0].clone())
}

#[cfg(feature = "fetch")]
pub fn fetch_all_ncn_operator_state(
    rpc: &solana_client::rpc_client::RpcClient,
    addresses: &[solana_program::pubkey::Pubkey],
) -> Result<Vec<crate::shared::DecodedAccount<NcnOperatorState>>, std::io::Error> {
    let accounts = rpc
        .get_multiple_accounts(addresses)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;
    let mut decoded_accounts: Vec<crate::shared::DecodedAccount<NcnOperatorState>> = Vec::new();
    for i in 0..addresses.len() {
        let address = addresses[i];
        let account = accounts[i].as_ref().ok_or(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Account not found: {}", address),
        ))?;
        let data = NcnOperatorState::from_bytes(&account.data)?;
        decoded_accounts.push(crate::shared::DecodedAccount {
            address,
            account: account.clone(),
            data,
        });
    }
    Ok(decoded_accounts)
}

#[cfg(feature = "fetch")]
pub fn fetch_maybe_ncn_operator_state(
    rpc: &solana_client::rpc_client::RpcClient,
    address: &solana_program::pubkey::Pubkey,
) -> Result<crate::shared::MaybeAccount<NcnOperatorState>, std::io::Error> {
    let accounts = fetch_all_maybe_ncn_operator_state(rpc, &[*address])?;
    Ok(accounts[0].clone())
}

#[cfg(feature = "fetch")]
pub fn fetch_all_maybe_ncn_operator_state(
    rpc: &solana_client::rpc_client::RpcClient,
    addresses: &[solana_program::pubkey::Pubkey],
) -> Result<Vec<crate::shared::MaybeAccount<NcnOperatorState>>, std::io::Error> {
    let accounts = rpc
        .get_multiple_accounts(addresses)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;
    let mut decoded_accounts: Vec<crate::shared::MaybeAccount<NcnOperatorState>> = Vec::new();
    for i in 0..addresses.len() {
        let address = addresses[i];
        if let Some(account) = accounts[i].as_ref() {
            let data = NcnOperatorState::from_bytes(&account.data)?;
            decoded_accounts.push(crate::shared::MaybeAccount::Exists(
                crate::shared::DecodedAccount {
                    address,
                    account: account.clone(),
                    data,
                },
            ));
        } else {
            decoded_accounts.push(crate::shared::MaybeAccount::NotFound(address));
        }
    }
    Ok(decoded_accounts)
}

#[cfg(feature = "anchor")]
impl anchor_lang::AccountDeserialize for NcnOperatorState {
    fn try_deserialize_unchecked(buf: &mut &[u8]) -> anchor_lang::Result<Self> {
        Ok(Self::deserialize(buf)?)
    }
}

#[cfg(feature = "anchor")]
impl anchor_lang::AccountSerialize for NcnOperatorState {}

#[cfg(feature = "anchor")]
impl anchor_lang::Owner for NcnOperatorState {
    fn owner() -> Pubkey {
        crate::JITO_RESTAKING_ID
    }
}

#[cfg(feature = "anchor-idl-build")]
impl anchor_lang::IdlBuild for NcnOperatorState {}

#[cfg(feature = "anchor-idl-build")]
impl anchor_lang::Discriminator for NcnOperatorState {
    const DISCRIMINATOR: [u8; 8] = [0; 8];
}
