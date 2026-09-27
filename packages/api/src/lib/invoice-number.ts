import { Setting } from '@pawtag/db';

/**
 * Generate a sequential credit note number (CN-XXXXXX).
 * Uses the same counter pattern as invoice numbers.
 */
export async function generateCreditNoteNumber(): Promise<string> {
  const counter = await Setting.findOneAndUpdate(
    { _id: 'creditNoteNumber' as any },
    { $inc: { value: { seq: 1 } } },
    { new: true, upsert: true, setDefaultsOnInsert: true } as any,
  ).lean();

  return `CN-${String((counter as any)?.value?.seq || 1).padStart(6, '0')}`;
}

/**
 * Generate a sequential invoice number (INV-XXXXXX).
 */
export async function generateInvoiceNumber(): Promise<string> {
  const counter = await Setting.findOneAndUpdate(
    { _id: 'invoiceNumber' as any },
    { $inc: { value: { seq: 1 } } },
    { new: true, upsert: true, setDefaultsOnInsert: true } as any,
  ).lean();

  return `INV-${String((counter as any)?.value?.seq || 1).padStart(6, '0')}`;
}
