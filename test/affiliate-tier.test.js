const test = require("node:test");
const assert = require("node:assert/strict");
const { CAMPAIGN_TIERS, isEligible } = require("../src/services/affiliate.service");

function reward(sequence) {
  return CAMPAIGN_TIERS.find((tier) => tier.through === null || sequence <= tier.through).amount;
}

test("affiliate tier schedule keeps the approved referral amount snapshot rules", () => {
  assert.equal(reward(1), 20);
  assert.equal(reward(20), 20);
  assert.equal(reward(21), 30);
  assert.equal(reward(100), 30);
  assert.equal(reward(101), 40);
  assert.equal(reward(201), 40);
});

test("affiliate eligibility accepts legacy SMS verification while requiring an active, complete student profile", () => {
  const legacyVerifiedStudent = {
    isActive: true,
    roles: ["student", "tutor"],
    phoneNumber: "+94771234567",
    verifiedPhoneNumber: null,
    phoneVerifiedAt: new Date(),
    isStudentProfileComplete: true,
  };

  assert.equal(isEligible(legacyVerifiedStudent), true);
  assert.equal(isEligible({ ...legacyVerifiedStudent, phoneNumber: null }), false);
  assert.equal(isEligible({ ...legacyVerifiedStudent, isStudentProfileComplete: false }), false);
});
