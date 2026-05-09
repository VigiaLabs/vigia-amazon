use anchor_lang::prelude::*;
use anchor_spl::{associated_token::get_associated_token_address, token::{self, Token, MintTo}};

use crate::constants::*;
use crate::error::VigiaError;
use crate::state::{HazardRegistry, NodeStake, status};

#[derive(Accounts)]
#[instruction(h3_index: u64, epoch_day: u32)]
pub struct InitializeHazard<'info> {
    #[account(
        init,
        payer = authority,
        space = HAZARD_REGISTRY_SIZE,
        seeds = [b"hazard", &h3_index.to_le_bytes() as &[u8], &epoch_day.to_le_bytes() as &[u8]],
        bump
    )]
    pub hazard_registry: Account<'info, HazardRegistry>,

    /// The discoverer's stake account — must be staked and not blacklisted.
    #[account(
        seeds = [b"stake", discoverer.key().as_ref()],
        bump = node_stake.bump,
        constraint = node_stake.staked_lamports >= MIN_STAKE_LAMPORTS @ VigiaError::InsufficientStake,
        constraint = !node_stake.blacklisted @ VigiaError::NodeBlacklisted,
    )]
    pub node_stake: Account<'info, NodeStake>,

    /// CHECK: Ed25519 pubkey of the edge node that first reported this hazard.
    pub discoverer: UncheckedAccount<'info>,

    /// The discoverer's $VIGIA Associated Token Account (receives minted tokens).
    /// CHECK: validated by token::mint_to CPI.
    #[account(
        mut,
        constraint = discoverer_ata.key() == get_associated_token_address(
            &discoverer.key(),
            &vigia_mint.key(),
        ) @ VigiaError::InvalidAssociatedTokenAccount
    )]
    pub discoverer_ata: UncheckedAccount<'info>,

    /// The $VIGIA SPL Token mint.
    /// CHECK: validated by token::mint_to CPI.
    #[account(mut)]
    pub vigia_mint: UncheckedAccount<'info>,

    /// The mint authority PDA — program-controlled signer for mint_to.
    /// CHECK: derived from seeds [MINT_AUTHORITY_SEED].
    #[account(seeds = [MINT_AUTHORITY_SEED], bump)]
    pub mint_authority: UncheckedAccount<'info>,

    /// AWS Lambda keypair — the sole authorized caller.
    #[account(
        mut,
        constraint = authority.key() == VIGIA_AUTHORITY @ VigiaError::Unauthorized
    )]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeHazard>,
    h3_index: u64,
    epoch_day: u32,
    vlm_confidence: u8,
    _onnx_confidence: u8,
) -> Result<()> {
    // ── Clock drift guard ────────────────────────────────────────────────────
    let current_epoch_day = (Clock::get()?.unix_timestamp / 86400) as u32;
    require!(epoch_day == current_epoch_day, VigiaError::InvalidEpoch);

    // ── Populate HazardRegistry ──────────────────────────────────────────────
    let registry = &mut ctx.accounts.hazard_registry;
    registry.h3_index        = h3_index;
    registry.epoch_day       = epoch_day;
    registry.discoverer      = ctx.accounts.discoverer.key();
    registry.discovery_ts    = Clock::get()?.unix_timestamp;
    registry.validation_count = 0;
    registry.vlm_confidence  = vlm_confidence;
    registry.status          = status::VERIFIED;
    registry.bump            = ctx.bumps.hazard_registry;

    // ── Mint Discovery Bounty ($VIGIA tokens) ────────────────────────────────
    let mint_authority_bump = ctx.bumps.mint_authority;
    let signer_seeds: &[&[u8]] = &[MINT_AUTHORITY_SEED, &[mint_authority_bump]];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint:      ctx.accounts.vigia_mint.to_account_info(),
                to:        ctx.accounts.discoverer_ata.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            },
            &[signer_seeds],
        ),
        DISCOVERY_BOUNTY_TOKENS,
    )?;

    emit!(HazardDiscovered {
        h3_index,
        epoch_day,
        discoverer: ctx.accounts.discoverer.key(),
        vlm_confidence,
        bounty_tokens: DISCOVERY_BOUNTY_TOKENS,
    });

    msg!(
        "VIGIA: HazardDiscovered h3={} day={} discoverer={} bounty={} $VIGIA",
        h3_index, epoch_day, ctx.accounts.discoverer.key(), DISCOVERY_BOUNTY_TOKENS
    );
    Ok(())
}

#[event]
pub struct HazardDiscovered {
    pub h3_index:       u64,
    pub epoch_day:      u32,
    pub discoverer:     Pubkey,
    pub vlm_confidence: u8,
    pub bounty_tokens:  u64,
}
