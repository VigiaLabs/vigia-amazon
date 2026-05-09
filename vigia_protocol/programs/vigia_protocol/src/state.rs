use anchor_lang::prelude::*;

/// On-chain record for a hazard discovered at a specific H3 cell on a specific day.
/// PDA seeds: [b"hazard", h3_index.to_le_bytes(), epoch_day.to_le_bytes()]
///
/// epoch_day resets daily — the same pothole can be re-discovered the next day.
/// The program verifies epoch_day matches Clock::get() on every write.
#[account]
pub struct HazardRegistry {
    /// H3 resolution-9 cell index (~12m cells). 8 bytes.
    pub h3_index: u64,
    /// floor(unix_timestamp / 86400). Verified against on-chain clock. 4 bytes.
    pub epoch_day: u32,
    /// Ed25519 pubkey of the first reporter. 32 bytes.
    pub discoverer: Pubkey,
    /// Unix timestamp of first report. 8 bytes.
    pub discovery_ts: i64,
    /// Number of subsequent validations at this cell today. 4 bytes.
    pub validation_count: u32,
    /// VLM confidence 0-100 from Bedrock Nova Lite. 1 byte.
    pub vlm_confidence: u8,
    /// 0=PENDING, 1=VERIFIED, 2=REJECTED, 3=SLASHED. 1 byte.
    pub status: u8,
    /// PDA bump. 1 byte.
    pub bump: u8,
    // NOTE: no merkle_tree field — all validations go to the global Merkle tree.
}

/// Stake account for an edge node.
/// PDA seeds: [b"stake", node_pubkey]
#[account]
pub struct NodeStake {
    /// The staking node's Ed25519 pubkey. 32 bytes.
    pub node: Pubkey,
    /// SOL staked in lamports. 8 bytes.
    pub staked_lamports: u64,
    /// Unix timestamp of stake. 8 bytes.
    pub stake_ts: i64,
    /// Set to true by slash_node — prevents further bounty claims. 1 byte.
    pub blacklisted: bool,
    /// PDA bump. 1 byte.
    pub bump: u8,
}

/// Leaf appended to the global concurrent Merkle tree for every validation event.
/// NOT stored as an account — serialized and hashed before appending.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ValidationLeaf {
    /// H3 cell index — enables off-chain filtering by location.
    pub h3_index: u64,
    /// Epoch day — enables off-chain filtering by date.
    pub epoch_day: u32,
    /// Validator's Ed25519 pubkey.
    pub validator: [u8; 32],
    /// Unix timestamp of this validation.
    pub timestamp: i64,
    /// ONNX edge confidence 0-100.
    pub onnx_conf: u8,
    /// SHA-256 of the edge payload signature — tamper-evident audit trail.
    pub signature_hash: [u8; 32],
}

/// Status constants for HazardRegistry.status
pub mod status {
    pub const PENDING:  u8 = 0;
    pub const VERIFIED: u8 = 1;
    pub const REJECTED: u8 = 2;
    pub const SLASHED:  u8 = 3;
}
