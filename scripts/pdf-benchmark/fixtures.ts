/**
 * Deterministic InvoiceDocumentModel fixtures for the PDF renderer
 * benchmark (scripts/pdf-benchmark) and renderer tests.
 *
 * These mirror the documents verified against the dev DB during the
 * invoice-parity work (WO-000507-class invoices): engraving line split,
 * card badges, discounts, NZ GST, credit-note refund destination, donation
 * tax notes, macron-heavy NZ addresses, and a many-line-item case that
 * paginates to two A4 pages.
 */
import type { InvoiceDocumentModel } from '../../packages/api/src/services/finance/invoice-document';

const company = {
  name: 'PawTag Limited',
  address: '12 Queen Street, Auckland 1010\nAotearoa New Zealand',
  phone: '+64 9 555 0100',
  email: 'hello@pawtag.co.nz',
  gst: 'GST 123-456-789',
  website: 'pawtag.co.nz',
};

/** Shop invoice — engraving split, visa card, discount + GST (customer channel). */
export const shopInvoiceCustomer: InvoiceDocumentModel = {
  kind: 'invoice',
  number: 'INV-000042',
  title: 'INVOICE',
  status: 'paid',
  issuedAt: '2026-10-14',
  paidAt: '2026-10-14',
  amount: 44.1,
  currency: 'NZD',
  company,
  customer: {
    name: 'Aroha Ngata',
    email: 'aroha.ngata@example.com',
    phone: '+64 21 555 321',
    addressLines: ['47 Rimu Road', 'Mount Eden', 'Auckland 1024'],
  },
  shippingAddressLines: ['47 Rimu Road', 'Mount Eden', 'Auckland 1024'],
  orderNumber: 'WO-000507',
  items: [
    { name: 'PawTag NFC Pet Tag', subtitles: ['Silver · Round · Large'], quantity: 1, lineTotal: 29 },
    { name: 'Engraving — Pet name: Miro', subtitles: ['Line 1: Miro', 'Line 2: 021 555 321'], quantity: 1, lineTotal: 10 },
  ],
  totals: { subtotal: 39, discount: 5, discountReason: 'PawRewards', shipping: 0, tax: 5.1, taxLabel: 'GST (15%)' },
  payment: { method: 'Card', cardBrand: 'visa', cardLast4: '4242' },
  notes: [],
  channel: 'customer',
};

/** Admin channel — includes Stripe provider IDs for CSR troubleshooting. */
export const shopInvoiceAdmin: InvoiceDocumentModel = {
  ...shopInvoiceCustomer,
  number: 'INV-000042',
  channel: 'admin',
  payment: {
    method: 'Card',
    cardBrand: 'mastercard',
    cardLast4: '4444',
    stripePaymentIntentId: 'pi_3PkQr2AbCdEfGhIjKlMnOp',
    stripeInvoiceId: 'in_1PkQr2AbCdEfGhIjKlMnOp',
  },
};

/** Credit note — refund destination + original invoice reference. */
export const creditNote: InvoiceDocumentModel = {
  kind: 'credit_note',
  number: 'CN-000007',
  title: 'CREDIT NOTE',
  status: 'issued',
  issuedAt: '2026-10-16',
  amount: 39,
  currency: 'NZD',
  company,
  customer: {
    name: 'Tui Walker',
    email: 'tui.walker@example.com',
    addressLines: ['8 Kauri Street', 'Ōtāuhou', 'Auckland 1061'],
  },
  orderNumber: 'WO-000488',
  originalInvoiceNumber: 'INV-000040',
  items: [{ name: 'PawTag NFC Pet Tag', subtitles: ['Returned — full refund'], quantity: 1, lineTotal: 39 }],
  totals: { subtotal: 39, shipping: 0, tax: 5.09, taxLabel: 'GST (15%)' },
  payment: {
    method: 'Card',
    cardBrand: 'visa',
    cardLast4: '4242',
    refundDestination: 'Visa ••••4242 (original payment method)',
  },
  notes: ['This credit note reverses INV-000040 in full. The refund was issued to the original payment method.'],
  channel: 'customer',
};

/** Donation receipt — tax-document wording, flat item, no totals breakdown. */
export const donationReceipt: InvoiceDocumentModel = {
  kind: 'donation_receipt',
  number: 'PTD-000004',
  title: 'DONATION RECEIPT',
  status: 'issued',
  issuedAt: '2026-10-12',
  amount: 50,
  currency: 'NZD',
  company,
  customer: { name: 'Supporter', email: 'giver@example.com', addressLines: ['27 Totara Avenue', 'Tāmaki Makaurau', 'Auckland'] },
  items: [{ name: 'Donation — one-time', subtitles: ['Thank you for helping reunite pets with their families'], quantity: 1, lineTotal: 50 }],
  payment: { method: 'Card', cardBrand: 'amex', cardLast4: '1005' },
  notes: [
    'This receipt acknowledges a donation received by PawTag Limited. Keep it for your records.',
    'No goods or services were provided in exchange for this donation.',
  ],
  channel: 'customer',
};

/** Many-line-item case — exercises A4 pagination and totals placement. */
export const multiPageInvoice: InvoiceDocumentModel = {
  kind: 'invoice',
  number: 'INV-000099',
  title: 'INVOICE',
  status: 'paid',
  issuedAt: '2026-10-18',
  paidAt: '2026-10-18',
  amount: 812.5,
  currency: 'NZD',
  company,
  customer: {
    name: 'Whānau Foster Care Trust',
    email: 'accounts@fostercare.example.org',
    addressLines: ['102 Great North Road', 'Grey Lynn', 'Auckland 1021'],
  },
  shippingAddressLines: ['102 Great North Road', 'Grey Lynn', 'Auckland 1021'],
  orderNumber: 'WO-000612',
  items: Array.from({ length: 18 }, (_, i) => ({
    name: `PawTag NFC Pet Tag — bulk unit ${i + 1}`,
    subtitles: [`Engraving: Foster ${i + 1}`, i % 3 === 0 ? 'Silver · Round' : 'Black · Bone'],
    quantity: 2,
    lineTotal: 39.5,
  })),
  totals: { subtotal: 711, discount: 38.5, discountReason: 'Bulk order', shipping: 0, tax: 100, taxLabel: 'GST (15%)' },
  payment: { method: 'Bank transfer', cardBrand: 'discover', cardLast4: '6011' },
  notes: [],
  channel: 'customer',
};

/** Macron-heavy addresses — Ō, ā, ē, ū must survive every engine. */
export const macronHeavyInvoice: InvoiceDocumentModel = {
  kind: 'invoice',
  number: 'INV-000103',
  title: 'INVOICE',
  status: 'pending',
  issuedAt: '2026-10-18',
  dueDate: '2026-11-01',
  amount: 29,
  currency: 'NZD',
  company: { ...company, name: 'PawTag Aotearoa', address: '16 Hōhere Kōwhai Street, Ōtāuhou' },
  customer: {
    name: 'Hine Tūhāuru',
    email: 'hine@example.nz',
    addressLines: ['5 Ngāti Rua Lane', 'Tāmaki Makaurau', 'Auckland 1071'],
  },
  orderNumber: 'WO-000613',
  items: [{ name: 'PawTag NFC Pet Tag', subtitles: ['Engraving: Kōwhai', 'Ōtāuhou branch collection'], quantity: 1, lineTotal: 29 }],
  totals: { subtotal: 29, shipping: 0, tax: 3.78, taxLabel: 'GST (15%)' },
  payment: { method: 'Card', cardBrand: 'visa', cardLast4: '9876' },
  notes: [],
  channel: 'customer',
};

export const benchmarkFixtures: Array<{ name: string; model: InvoiceDocumentModel }> = [
  { name: '01-shop-invoice-customer', model: shopInvoiceCustomer },
  { name: '02-shop-invoice-admin', model: shopInvoiceAdmin },
  { name: '03-credit-note', model: creditNote },
  { name: '04-donation-receipt', model: donationReceipt },
  { name: '05-multi-page', model: multiPageInvoice },
  { name: '06-macron-heavy', model: macronHeavyInvoice },
];
