import { User } from '@pawtag/db';
import Medusa from '@medusajs/js-sdk';

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000';
const MEDUSA_ADMIN_TOKEN = process.env.MEDUSA_ADMIN_TOKEN || '';

let sdkInstance: Medusa | null = null;

function getSdk(): Medusa {
  if (!sdkInstance) {
    sdkInstance = new Medusa({
      baseUrl: MEDUSA_BACKEND_URL,
    });
  }
  return sdkInstance;
}

/**
 * Split a fullName into first_name and last_name for Medusa.
 * "Arpan Bhagat" → { firstName: "Arpan", lastName: "Bhagat" }
 * "Cher" → { firstName: "Cher", lastName: "" }
 */
function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
  };
}

/**
 * Create a Medusa customer from PawTag user data and link them.
 * Returns the Medusa customer ID.
 */
export async function syncUserToMedusa(userId: string): Promise<string | null> {
  const user = await User.findById(userId);
  if (!user) {
    console.error('[medusa-sync] User not found:', userId);
    return null;
  }

  // Already synced
  if (user.medusaCustomerId) {
    return user.medusaCustomerId;
  }

  // Skip if Medusa is not configured
  if (!MEDUSA_ADMIN_TOKEN) {
    console.warn('[medusa-sync] MEDUSA_ADMIN_TOKEN not configured — skipping sync');
    return null;
  }

  try {
    const sdk = getSdk();
    const { firstName, lastName } = splitFullName(user.fullName);

    // Use admin token for auth if available
    if (MEDUSA_ADMIN_TOKEN) {
      sdk.client.setToken(MEDUSA_ADMIN_TOKEN);
    }

    // Create customer via admin API
    const response = await sdk.client.fetch('/admin/customers', {
      method: 'POST',
      headers: MEDUSA_ADMIN_TOKEN ? { Authorization: `Bearer ${MEDUSA_ADMIN_TOKEN}` } : {},
      body: {
        email: user.email,
        first_name: firstName,
        last_name: lastName,
        phone: user.phoneNumber || undefined,
        metadata: {
          pawtagUserId: userId,
          pawtagSyncedAt: new Date().toISOString(),
        },
      },
    });

    const customer = (response as any).customer;
    if (!customer?.id) {
      console.error('[medusa-sync] Failed to create Medusa customer:', response);
      return null;
    }

    // Save Medusa customer ID to PawTag user
    user.medusaCustomerId = customer.id;
    await user.save();

    console.log(`[medusa-sync] Created Medusa customer ${customer.id} for PawTag user ${userId}`);
    return customer.id;
  } catch (error: any) {
    console.error('[medusa-sync] Error syncing user to Medusa:', error.message);
    return null;
  }
}

/**
 * Ensure a Medusa customer exists for the given user, creating one if needed.
 * Also associates the customer with the given Medusa cart.
 */
export async function ensureMedusaCustomerForCart(
  userId: string,
  cartId: string
): Promise<string | null> {
  const customerId = await syncUserToMedusa(userId);
  if (!customerId) return null;

  try {
    const sdk = getSdk();

    // Associate customer with cart
    await sdk.store.cart.update(cartId, {
      customer_id: customerId,
    } as any);

    return customerId;
  } catch (error: any) {
    console.error('[medusa-sync] Error associating customer with cart:', error.message);
    return null;
  }
}

/**
 * Get or create a Medusa customer for a user.
 * Used during checkout to ensure the customer exists before order placement.
 */
export async function getOrCreateMedusaCustomer(userId: string): Promise<string | null> {
  return syncUserToMedusa(userId);
}
