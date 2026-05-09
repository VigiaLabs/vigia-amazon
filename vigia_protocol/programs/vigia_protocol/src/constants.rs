use anchor_lang::prelude::*;

/// AWS Lambda authority — the only pubkey allowed to call initialize_hazard,
/// validate_hazard, and slash_node. Hardcoded so no runtime config can override it.
pub const VIGIA_AUTHORITY: Pubkey = pubkey!("7PTUbMJMWRwAixmkez2yBpsjovyAECtcXQHVYzAi8jf1");

/// Mint authority PDA seed — this PDA is set as the $VIGIA SPL token's mint authority.
pub const MINT_AUTHORITY_SEED: &[u8] = b"mint_authority";

/// Discovery Bounty: 10 $VIGIA (6 decimals) — paid to the first reporter of a new H3 cell today.
pub const DISCOVERY_BOUNTY_TOKENS: u64 = 10_000_000;

/// Validation Bounty: 0.1 $VIGIA (6 decimals) — paid to subsequent reporters confirming the hazard.
pub const VALIDATION_BOUNTY_TOKENS: u64 = 100_000;

/// Minimum stake required to earn bounties (0.1 SOL).
pub const MIN_STAKE_LAMPORTS: u64 = 100_000_000;

/// HazardRegistry account size: 8 discriminator + 67 data bytes.
pub const HAZARD_REGISTRY_SIZE: usize = 8 + 8 + 4 + 32 + 8 + 4 + 1 + 1 + 1;

/// NodeStake account size: 8 discriminator + 58 data bytes.
pub const NODE_STAKE_SIZE: usize = 8 + 32 + 8 + 8 + 1 + 1;
