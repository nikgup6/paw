import LegalPage, { ContactLines } from './LegalPage';
import { BUSINESS_NAME } from '../../constants/contact';

/* TODO: replace with the real policies before taking live payments.
   These placeholders state only how the site actually works. They promise
   nothing that has not been decided, and are not legal advice. The facts about
   personal data come from docs/SECURITY.md, section 2. */

const UPDATED = '22 October 2026';

export function Terms() {
  return (
    <LegalPage title="Terms of use" updated={UPDATED}>
      <p>{BUSINESS_NAME} suggests dog breeds that may suit your home and lifestyle, based on the answers you give.</p>
      <h2>What the match is</h2>
      <p>
        Your match comes from a fixed set of rules applied to your answers and our breed information. It is guidance
        to help you decide, not a guarantee about any individual dog. Please also speak to a vet and meet the dog
        before you bring one home.
      </p>
      <h2>Paid full match</h2>
      <p>
        The first part of the quiz is free. A one-time payment unlocks full matches for your account for the number
        of days shown before you pay. See the <a href="/refunds">refund policy</a>.
      </p>
      <h2>Contact</h2>
      <ContactLines />
    </LegalPage>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Privacy" updated={UPDATED}>
      <h2>What we collect</h2>
      <ul>
        <li>
          Your name and mobile number, and your email and age range if you choose to give them, when you continue
          to the quiz. We do not check that the number is yours; we use it only to share your results and breeder
          updates.
        </li>
        <li>Your quiz answers, such as your city, home, who lives with you, your budget and schedule.</li>
        <li>If you use the dog tools: your dog's details, photos and health documents you upload.</li>
        <li>How you use the site (for example, which screen you reached) and how you arrived, such as a campaign link.</li>
      </ul>
      <h2>Payments</h2>
      <p>
        Payments are handled by Razorpay. Your card or UPI details go to Razorpay, not to us. We keep a record of the
        order and whether it was paid.
      </p>
      <h2>Your requests</h2>
      <p>To ask what we hold about you, or to have it deleted, contact us:</p>
      <ContactLines />
    </LegalPage>
  );
}

export function Refunds() {
  return (
    <LegalPage title="Refund policy" updated={UPDATED}>
      <p>
        If you paid and your full results did not load, we will refund you. Send your request to the email or WhatsApp
        number below, with the mobile number you gave us and, if you have it, the payment ID from your Razorpay
        receipt.
      </p>
      <p>
        Your unlock belongs to the phone and browser you paid on. If you change phone or browser, message us the same
        details and we will restore it.
      </p>
      <p>Approved refunds are processed in 5 to 7 working days.</p>
      <ContactLines />
    </LegalPage>
  );
}

export function Contact() {
  return (
    <LegalPage title="Contact us" updated={UPDATED}>
      <p>Questions, help with a payment, or a request about your data: we are happy to help.</p>
      <ContactLines />
    </LegalPage>
  );
}
