#![allow(clippy::all)]
#![allow(clippy::nursery)]
#![allow(clippy::integer_division)]
#![allow(clippy::arithmetic_side_effects)]
#![allow(clippy::style)]
#![allow(clippy::perf)]
mod generated;

use generated::*;

pub mod accounts {
    pub use super::generated::accounts::*;
}

pub mod instructions {
    pub use super::generated::instructions::*;
}

pub mod errors {
    pub use super::generated::errors::*;
}

pub mod types {
    pub use super::generated::types::*;
}

pub mod programs {
    pub use super::generated::programs::*;
}

#[cfg(feature = "anchor")]
#[derive(Debug, Clone)]
pub struct JitoVault;

#[cfg(feature = "anchor")]
impl anchor_lang::Id for JitoVault {
    fn id() -> anchor_lang::prelude::Pubkey {
        JITO_VAULT_ID
    }
}
