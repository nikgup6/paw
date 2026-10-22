/* Public contact details, in one place. Shown in the footer and on the Contact,
   Refund, Terms and Privacy pages. Razorpay checks that a site shows these
   before it approves the payment gateway, so keep them current.

   Note: the site's "Chat on WhatsApp" / breeder enquiry buttons use a separate
   number, WHATSAPP_NUMBER in utils/whatsapp.js. */

export const SUPPORT_EMAIL = 'pawbuddy.br@gmail.com';

/* Digits only, with the country code, for wa.me links. */
export const SUPPORT_WHATSAPP = '917358444850';
/* How the number is shown to people. */
export const SUPPORT_PHONE_DISPLAY = '+91 73584 44850';

export const BUSINESS_NAME = 'PAW BUDDY';

/* The policy pages, in footer order. */
export const LEGAL_LINKS = [
  ['/terms', 'Terms'],
  ['/privacy', 'Privacy'],
  ['/refunds', 'Refund policy'],
  ['/contact', 'Contact'],
];
