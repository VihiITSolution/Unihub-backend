const APPROVAL_EVENTS = [
  "course", "tutor", "marketplace", "boarding", "bank_transfer", "affiliate_referral", "affiliate_payout",
];

function wantsApprovalEmail(user, event) {
  const settings = user.notificationPrefs?.adminApprovals;
  return settings?.emailEnabled !== false && settings?.events?.[event] !== false;
}

module.exports = { APPROVAL_EVENTS, wantsApprovalEmail };
