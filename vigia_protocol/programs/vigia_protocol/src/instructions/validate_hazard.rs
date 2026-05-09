use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, MintTo};
use solana_program::{instruction::{Instruction, AccountMeta}, program::invoke};

use crate::constants::*;
use crate::error::VigiaError;
use crate::state::{HazardRegistry, NodeStake, ValidationLeaf, status};

/// The global concurrent Merkle tree pubkey — pre-initialized by admin.
pub const GLOBAL_VALIDATION_TREE: &str = "HUWg7PsuqKtDxUe411mXNssfE2BSpq4ajao4GUab13LZ";

#[derive(Accounts)]
#[instruction(h3_index: u64, epoch_day: u32)]
pub struct ValidateHazard<'info> {
    #[account(
        mut,
        seeds = [b"hazard", &h3_index.to_le_bytes() as &[u8], &epoch_day.to_le_bytes() as &[u8]],
        bump = hazard_registry.bump,
        constraint = hazard_registry.status == status::VERIFIED @ VigiaError::HazardNotVerified,
    )]
    pub hazard_registry: Account<'info, HazardRegistry>,

    /// The validator's stake account — must be staked and not blacklisted.
    #[account(
        seeds = [b"stake", validator.key().as_ref()],
        bump = node_stake.bump,
        constraint = node_stake.staked_lamports >= MIN_STAKE_LAMPORTS @ VigiaError::InsufficientStake,
        constraint = !node_stake.blacklisted @ VigiaError::NodeBlacklisted,
    )]
    pub node_stake: Account<'info, NodeStake>,

    /// CHECK: Ed25519 pubkey of the validating edge node.
    pub validator: UncheckedAccount<'info>,

    /// The validator's $VIGIA Associated Token Account (receives minted tokens).
    /// CHECK: validated by token::mint_to CPI.
    #[account(mut)]
    pub validator_ata: UncheckedAccount<'info>,

    /// The $VIGIA SPL Token mint.
    /// CHECK: validated by token::mint_to CPI.
    #[account(mut)]
    pub vigia_mint: UncheckedAccount<'info>,

    /// The mint authority PDA — program-controlled signer for mint_to.
    /// CHECK: derived from seeds [MINT_AUTHORITY_SEED].
    #[account(seeds = [MINT_AUTHORITY_SEED], bump)]
    pub mint_authority: UncheckedAccount<'info>,

    /// The global concurrent Merkle tree.
    /// CHECK: validated by key constraint.
    #[account(
        mut,
        constraint = global_tree.key().to_string() == GLOBAL_VALIDATION_TREE @ VigiaError::InvalidMerkleTree
    )]
    pub global_tree: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = authority.key().to_string() == VIGIA_AUTHORITY @ VigiaError::Unauthorized
    )]
    pub authority: Signer<'info>,

    /// CHECK: SPL Account Compression program.
    pub compression_program: UncheckedAccount<'info>,

    /// CHECK: SPL Noop program for Merkle tree logging.
    pub noop_program: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<ValidateHazard>,
    h3_index: u64,
    epoch_day: u32,
    onnx_confidence: u8,
    signature_hash: [u8; 32],
) -> Result<()> {
    // ── Clock drift guard ────────────────────────────────────────────────────
    let current_epoch_day = (Clock::get()?.unix_timestamp / 86400) as u32;
    require!(epoch_day == current_epoch_day, VigiaError::InvalidEpoch);

    // ── Increment validation counter ─────────────────────────────────────────
    let registry = &mut ctx.accounts.hazard_registry;
    registry.validation_count = registry
        .validation_count
        .checked_add(1)
        .ok_or(VigiaError::Overflow)?;

    // ── Append compressed leaf to global Merkle tree ─────────────────────────
    let leaf = ValidationLeaf {
        h3_index,
        epoch_day,
        validator:      ctx.accounts.validator.key().to_bytes(),
        timestamp:      Clock::get()?.unix_timestamp,
        onnx_conf:      onnx_confidence,
        signature_hash,
    };
    let leaf_data = leaf.try_to_vec()?;
    let leaf_hash = anchor_lang::solana_program::keccak::hashv(&[&leaf_data]).0;

    // Raw invocation for Merkle tree append (bypasses CPI Id trait conflict)
    // Discriminator for "global:append" + leaf_node(32 bytes)
    let append_disc = anchor_lang::solana_program::hash::hash(b"global:append").to_bytes();
    let mut append_data = Vec::with_capacity(8 + 32);
    append_data.extend_from_slice(&append_disc[..8]);
    append_data.extend_from_slice(&leaf_hash);

    let append_ix = Instruction {
        program_id: ctx.accounts.compression_program.key(),
        accounts: vec![
            AccountMeta::new(ctx.accounts.global_tree.key(), false),
            AccountMeta::new_readonly(ctx.accounts.authority.key(), true),
            AccountMeta::new_readonly(ctx.accounts.noop_program.key(), false),
        ],
        data: append_data,
    };
    invoke(
        &append_ix,
        &[
            ctx.accounts.compression_program.to_account_info(),
            ctx.accounts.global_tree.to_account_info(),
            ctx.accounts.authority.to_account_info(),
            ctx.accounts.noop_program.to_account_info(),
        ],
    )?;

    // ── Mint Validation Bounty ($VIGIA tokens) ───────────────────────────────
    let mint_authority_bump = ctx.bumps.mint_authority;
    let signer_seeds: &[&[u8]] = &[MINT_AUTHORITY_SEED, &[mint_authority_bump]];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint:      ctx.accounts.vigia_mint.to_account_info(),
                to:        ctx.accounts.validator_ata.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            },
            &[signer_seeds],
        ),
        VALIDATION_BOUNTY_TOKENS,
    )?;

    emit!(HazardValidated {
        h3_index,
        epoch_day,
        validator:        ctx.accounts.validator.key(),
        validation_count: registry.validation_count,
        bounty_tokens:    VALIDATION_BOUNTY_TOKENS,
    });

    msg!(
        "VIGIA: HazardValidated h3={} day={} count={} validator={} bounty={} $VIGIA",
        h3_index, epoch_day, registry.validation_count,
        ctx.accounts.validator.key(), VALIDATION_BOUNTY_TOKENS
    );
    Ok(())
}

#[event]
pub struct HazardValidated {
    pub h3_index:         u64,
    pub epoch_day:        u32,
    pub validator:        Pubkey,
    pub validation_count: u32,
    pub bounty_tokens:    u64,
}
