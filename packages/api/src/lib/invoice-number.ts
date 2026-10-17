/**
 * Sequential document number generation — ONE atomic counter source.
 *
 * All numbers come from the `counters` collection via findOneAndUpdate
 * (atomic $inc), the same mechanism the live checkout/admin flows have
 * always used. Webhook paths previously used `Invoice.countDocuments() + 1`,
 * which races under concurrency and collides with the unique invoiceNumber
 * index — every number MUST come from here.
 *
 * Numbering schemes are unchanged: INV- (invoices), INVM- (membership),
 * CN- (credit notes). Numbers are unique and never recycled.
 */
import { Invoice } from '@pawtag/db';

async function nextCounter(counterId: string): Promise<number> {
  const counter = await Invoice.db!.collection('counters').findOneAndUpdate(
    { _id: counterId as any },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  return (counter as any)?.value?.seq ?? (counter as any)?.seq ?? 1;
}

/** Sequential invoice number (INV-XXXXXX). */
export async function generateInvoiceNumber(): Promise<string> {
  const seq = await nextCounter('invoiceNumber');
  return `INV-${String(seq).padStart(6, '0')}`;
}

/** Sequential membership invoice number (INVM-XXXXXX). */
export async function generateMembershipInvoiceNumber(): Promise<string> {
  const seq = await nextCounter('membershipInvoiceNumber');
  return `INVM-${String(seq).padStart(6, '0')}`;
}

/** Sequential credit note number (CN-XXXXXX). */
export async function generateCreditNoteNumber(): Promise<string> {
  const seq = await nextCounter('creditNoteNumber');
  return `CN-${String(seq).padStart(6, '0')}`;
}
