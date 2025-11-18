// Map userStatus values to user-friendly labels
export function getUserStatusLabel(userStatus: string | null): string {
  const statusMap: Record<string, string> = {
    // User-facing simplified statuses
    'processing': 'Processing',
    'completed': 'Completed',
    'failed': 'Failed',
    
    // Backend detailed statuses (for backward compatibility)
    'pending': 'Processing',
    'redeeming_shares': 'Redeeming Shares',
    'redeemed_fxrp': 'Redeemed FXRP',
    'redeeming_fxrp': 'Redeeming FXRP',
    'awaiting_proof': 'Awaiting Proof',
    'xrpl_payout': 'Sending XRP',
    'xrpl_received': 'Completed',
    'awaiting_liquidity': 'Awaiting Liquidity',
    'cancelled': 'Cancelled',
    
    // Legacy withdrawal statuses (if any still exist)
    'awaiting_payment': 'Awaiting Payment',
    'payment_sent': 'Payment Sent',
    'xrp_escrow_created': 'Escrow Created',
  };
  
  return statusMap[userStatus || ''] || 'Unknown';
}

// Get icon for status
export function getUserStatusIcon(userStatus: string | null): string {
  const iconMap: Record<string, string> = {
    // User-facing simplified statuses
    'processing': 'loader',
    'completed': 'check-circle',
    'failed': 'x-circle',
    
    // Backend detailed statuses (for backward compatibility)
    'pending': 'clock',
    'redeeming_shares': 'loader',
    'redeemed_fxrp': 'check',
    'redeeming_fxrp': 'loader',
    'awaiting_proof': 'clock',
    'xrpl_payout': 'send',
    'xrpl_received': 'check-circle',
    'awaiting_liquidity': 'clock',
    'cancelled': 'x-circle',
    
    // Legacy withdrawal statuses
    'awaiting_payment': 'clock',
    'payment_sent': 'send',
    'xrp_escrow_created': 'lock',
  };
  
  return iconMap[userStatus || ''] || 'help-circle';
}
