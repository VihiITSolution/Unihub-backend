const PHONE_REGEX = /^\+?[0-9\s\-()]{7,15}$/;

const isValidPhone = (value) => PHONE_REGEX.test(String(value).trim());

/** Rejects numeric-only input (e.g. "11111") - requires at least one letter. */
const hasLetters = (value) => /[a-zA-Z]/.test(String(value));

/** Person/shop name: letters, spaces, hyphens, apostrophes, periods; 2-50 chars. */
const isNameLike = (value) => /^[a-zA-Z\s'.-]{2,50}$/.test(String(value).trim());

module.exports = { PHONE_REGEX, isValidPhone, hasLetters, isNameLike };
