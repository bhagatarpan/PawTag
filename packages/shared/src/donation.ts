/** Shared donation contracts (Phase 15). */

export type DonationFrequency = 'one_time' | 'monthly';

export interface CreateDonationRequest {
  /** Amount in NZD dollars (e.g. 10 for $10). Server converts to cents. */
  amount: number;
  currency?: string;
  frequency?: DonationFrequency;
  email: string;
  name?: string;
  marketingConsent?: boolean;
  idempotencyKey?: string;
}

export interface DonationPublicStatus {
  id: string;
  status: string;
  amountCents: number;
  currency: string;
  frequency: DonationFrequency;
  createdAt: string;
  receiptNumber?: string;
}

export interface DonationCreateResponse {
  donationId: string;
  clientSecret: string;
  paymentIntentId: string;
  amountCents: number;
  currency: string;
  status: string;
}

export interface DonationSettingsPublic {
  currency: string;
  suggestedAmounts: number[];
  minAmountCents: number;
  maxAmountCents: number;
  frequencies: DonationFrequency[];
  missionHeadline: string;
  missionBody: string;
  organisationName: string;
  taxClassification: string;
  receiptStatement: string;
  publicEnabled: boolean;
}

export function dollarsToCents(amount: number): number {
  return Math.round(amount * 100);
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}
