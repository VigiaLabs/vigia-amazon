use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::constants::*;
use crate::error::VigiaError;
use crate::state::NodeStake;

/// Authority stakes on behalf of a node (for browser-generated keypairs that can't sign).
#[derive(Accounts)]
pub struct AdminStakeNode<'info> {
    #[account(
        init,
        payer = authority,
        space = NODE_STAKE_SIZE,
        seeds = [b"stake", node.key().as_ref()],
        bump
    )]
    pub node_stake: Account<'info, NodeStake>,

    /// CHECK: the node being staked for.
    pub node: UncheckedAccount<'info>,

    /// CHECK: vault PDA receives the staked SOL.
    #[account(mut, seeds = [b"vault"], bump)]
    pub vault: UncheckedAccount<'info>,

    /// Authority pays for the stake.
    #[account(
        mut,
        constraint = authority.key().to_string() == VIGIA_AUTHORITY @ VigiaError::Unauthorized
    )]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<AdminStakeNode>, amount: u64) -> Result<()> {
    require!(amount >= MIN_STAKE_LAMPORTS, VigiaError::InsufficientStake);

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.authority.to_account_info(),
                to:   ctx.accounts.vault.to_account_info(),
            },
        ),
        amount,
    )?;

    let stake = &mut ctx.accounts.node_stake;
    stake.node             = ctx.accounts.node.key();
    stake.staked_lamports  = amount;
    stake.stake_ts         = Clock::get()?.unix_timestamp;
    stake.blacklisted      = false;
    stake.bump             = ctx.bumps.node_stake;

    msg!("VIGIA: AdminStakeNode node={} lamports={}", ctx.accounts.node.key(), amount);
    Ok(())
}
