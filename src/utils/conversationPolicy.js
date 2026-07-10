// Data-driven policy describing which role pairs may start a conversation.
// "*" matches any role. Pairs are unordered (checked in both directions).
// Note: tutor<->tutor is intentionally excluded - only the pairings below
// were requested. Add a pair here to allow a new combination.
const ALLOWED_ROLE_PAIRS = [
  ["student", "tutor"],
  ["student", "student"],
  ["*", "vendor"],
  ["vendor", "vendor"],
  ["*", "admin"],
];

const rolesMatch = (roles, role) => role === "*" || roles.includes(role);

/**
 * Checks whether a user with `rolesA` may start a conversation with a user
 * with `rolesB`, based on ALLOWED_ROLE_PAIRS. Only used at conversation
 * creation time - sending a message into an existing conversation only
 * needs a participant-membership check, not a re-run of this policy.
 */
const canUsersConverse = (rolesA, rolesB) => {
  const a = Array.isArray(rolesA) ? rolesA : [];
  const b = Array.isArray(rolesB) ? rolesB : [];

  return ALLOWED_ROLE_PAIRS.some(([r1, r2]) => {
    const forward = rolesMatch(a, r1) && rolesMatch(b, r2);
    const backward = rolesMatch(a, r2) && rolesMatch(b, r1);
    return forward || backward;
  });
};

module.exports = { canUsersConverse, ALLOWED_ROLE_PAIRS };
