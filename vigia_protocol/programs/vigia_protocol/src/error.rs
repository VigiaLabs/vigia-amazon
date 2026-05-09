use anchor_lang::prelude::*;

#[error_code]
pub enum VigiaError {
    #[msg("Caller is not the VIGIA authority")]
    Unauthorized,
    #[msg("epoch_day does not match current on-chain clock — clock drift attack rejected")]
    InvalidEpoch,
    #[msg("Node stake is below the minimum required")]
    InsufficientStake,
    #[msg("Node is blacklisted and cannot earn bounties")]
    NodeBlacklisted,
    #[msg("Hazard is not in VERIFIED status")]
    HazardNotVerified,
    #[msg("Invalid global Merkle tree account")]
    InvalidMerkleTree,
    #[msg("Arithmetic overflow")]
    Overflow,
}
