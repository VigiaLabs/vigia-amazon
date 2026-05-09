pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use error::*;
pub use instructions::*;
pub use state::*;

declare_id!("BKaxbk73bCY8xRuphpkTESWjaJofdnBpuc2T193f3nkW");

#[program]
pub mod vigia_protocol {
    use super::*;

    /// Discovery: first report at H3 cell today. Mints $VIGIA Discovery Bounty.
    pub fn initialize_hazard(
        ctx: Context<InitializeHazard>,
        h3_index: u64,
        epoch_day: u32,
        vlm_confidence: u8,
        onnx_confidence: u8,
    ) -> Result<()> {
        initialize_hazard::handler(ctx, h3_index, epoch_day, vlm_confidence, onnx_confidence)
    }

    /// Validation: subsequent report at same H3 cell today. Mints $VIGIA Validation Bounty.
    pub fn validate_hazard(
        ctx: Context<ValidateHazard>,
        h3_index: u64,
        epoch_day: u32,
        onnx_confidence: u8,
        signature_hash: [u8; 32],
    ) -> Result<()> {
        validate_hazard::handler(ctx, h3_index, epoch_day, onnx_confidence, signature_hash)
    }

    /// Slash: fraud detected. Closes stake PDA, burns SOL.
    pub fn slash_node(
        ctx: Context<SlashNode>,
        hazard_id: [u8; 32],
        reason: String,
    ) -> Result<()> {
        slash_node::handler(ctx, hazard_id, reason)
    }

    /// Stake: edge nodes stake SOL to become eligible for bounties.
    pub fn stake_node(ctx: Context<StakeNode>, amount: u64) -> Result<()> {
        stake_node::handler(ctx, amount)
    }

    /// Admin stake: authority stakes on behalf of a node (for browser-generated keypairs).
    pub fn admin_stake_node(ctx: Context<AdminStakeNode>, amount: u64) -> Result<()> {
        admin_stake_node::handler(ctx, amount)
    }
}
