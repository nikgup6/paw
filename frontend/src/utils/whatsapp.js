// Central WhatsApp click-to-chat helper for the buy / enquiry flows.
// One place to change the business number or the pre-filled message wording.

// PawBuddy enquiry number: +91 73584 44850 (India). wa.me needs the full
// international form with country code and no symbols.
export const WHATSAPP_NUMBER = '917358444850';
export const WHATSAPP_DISPLAY = '+91 73584 44850';

// Builds a wa.me link with a message that names the person (X) and the breed
// (Y), e.g. "Hey, this is Priya and I'm here to enquire about the Beagle."
export const buildWhatsAppEnquiryLink = (name, breedName, intent) => {
  const who = (name && name.trim()) ? name.trim() : 'there';
  const breed = breedName || 'one of your breeds';
  let msg = `Hey, this is ${who} and I'm here to enquire about the ${breed} breed.`;
  if (intent && intent.trim()) msg += ` (${intent.trim()})`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
};
