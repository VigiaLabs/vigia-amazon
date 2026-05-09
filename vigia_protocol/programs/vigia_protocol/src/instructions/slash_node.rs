use anchor_lang::prelude::*;

use crate::constants::VIGIA_AUTHORITY;
use crate::error::VigiaError;
use crate::state::NodeStake;

#[derive(Accounts)]
pub struct SlashNode<'info> {
    /// The node's stake PDA — closed by this instruction (rent sent to burn sink).
    #[account(
        mut,
        seeds = [b"stake", node.key().as_ref()],
        bump = node_stake.bump,
        close = burn_sink,
    )]
    pub node_stake: Account<'info, NodeStake>,

    /// CHECK: The node being slashed.
    pub node: UncheckedAccount<'info>,

    /// CHECK: Rent from the closed PDA goes here.
    /// Using the system program address as a burn sink — SOL is unrecoverable.
    #[account(address = anchor_lang::solana_program::system_program::ID)]
    pub burn_sink: UncheckedAccount<'info>,

    /// AWS Lambda keypair — the sole authorized caller.
    #[account(
        mut,
        constraint = authority.key().to_string() == VIGIA_AUTHORITY @ VigiaError::Unauthorized
    )]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<SlashNode>,
    hazard_id: [u8; 32],
    reason: String,
) -> Result<()> {
    // Spec: "Set node_stake.blacklisted = true before close (written to event log)"
    // Must be set before `close` deallocates the account at end of instruction.
    ctx.accounts.node_stake.blacklisted = true;

    emit!(NodeSlashed {
        node:             ctx.accounts.node.key(),
        hazard_id,
        reason:           reason.clone(),
        slashed_lamports: ctx.accounts.node_stake.staked_lamports,
    });

    msg!(
        "VIGIA: NodeSlashed node={} hazard={:?} reason={}",
        ctx.accounts.node.key(),
        hazard_id,
        reason
    );
    Ok(())
}

#[event]
pub struct NodeSlashed {
    pub node:             Pubkey,
    pub hazard_id:        [u8; 32],
    pub reason:           String,
    pub slashed_lamports: u64,
}
