// Single source of truth for the support contact shown in customer-facing email.
// Set SUPPORT_EMAIL_ADDRESS / SUPPORT_PHONE_NUMBER in .env — never hardcode a
// personal or agency address into a template.

export const SUPPORT_EMAIL = () =>
  process.env.SUPPORT_EMAIL_ADDRESS || 'support@ekovibe.com.ng';

export const SUPPORT_PHONE = () => process.env.SUPPORT_PHONE_NUMBER || '';
