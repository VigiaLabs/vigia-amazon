use anchor_lang::prelude::*;
use anchor_lang::system_program;

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
    )]
    pub node_stake: Account<'info, NodeStake>,

    /// CHECK: The node being slashed.
    pub node: UncheckedAccount<'info>,

    /// CHECK: vault PDA holds the staked SOL.
    #[account(mut, seeds = [b"vault"], bump)]
    pub vault: UncheckedAccount<'info>,

    /// CHECK: Rent from the closed PDA goes here.
    /// Using the system program address as a burn sink — SOL is unrecoverable.
    #[account(address = anchor_lang::solana_program::system_program::ID)]
    pub burn_sink: UncheckedAccount<'info>,

    /// AWS Lambda keypair — the sole authorized caller.
    #[account(
        mut,
        constraint = authority.key() == VIGIA_AUTHORITY @ VigiaError::Unauthorized
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
    let slashed_lamports = ctx.accounts.node_stake.staked_lamports;

    if slashed_lamports > 0 {
        let vault_bump = ctx.bumps.vault;
        let signer_seeds: &[&[u8]] = &[b"vault", &[vault_bump]];

        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to:   ctx.accounts.burn_sink.to_account_info(),
                },
                &[signer_seeds],
            ),
            slashed_lamports,
        )?;

        ctx.accounts.node_stake.staked_lamports = 0;
    }

    emit!(NodeSlashed {
        node:             ctx.accounts.node.key(),
        hazard_id,
        reason:           reason.clone(),
        slashed_lamports,
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
