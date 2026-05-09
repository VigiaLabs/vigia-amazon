use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::constants::{MIN_STAKE_LAMPORTS, NODE_STAKE_SIZE};
use crate::error::VigiaError;
use crate::state::NodeStake;

#[derive(Accounts)]
pub struct StakeNode<'info> {
    #[account(
        init,
        payer = node,
        space = NODE_STAKE_SIZE,
        seeds = [b"stake", node.key().as_ref()],
        bump
    )]
    pub node_stake: Account<'info, NodeStake>,

    #[account(mut)]
    pub node: Signer<'info>,

    /// CHECK: vault PDA receives the staked SOL.
    #[account(mut, seeds = [b"vault"], bump)]
    pub vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<StakeNode>, amount: u64) -> Result<()> {
    require!(amount >= MIN_STAKE_LAMPORTS, VigiaError::InsufficientStake);

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.node.to_account_info(),
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

    msg!("VIGIA: NodeStaked node={} lamports={}", ctx.accounts.node.key(), amount);
    Ok(())
}
