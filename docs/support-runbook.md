# Support Request Runbook

How the founder/admin should triage incoming support requests from the PawTag admin panel.

## Accessing Support Requests

1. Log in to the **Admin Portal** (`/admin`)
2. Navigate to **Support Requests** in the sidebar (under Admin Tools)
3. You'll see a list of all incoming support requests, sorted by newest first

## Triage Workflow

### Step 1: Review New Requests

- Click the **Pending** filter to see unresolved requests
- Each request shows the customer's **name**, **email**, **message preview**, and **submission date**
- Click **View** to open the full request details

### Step 2: Respond to the Customer

- Read the customer's message carefully
- Respond directly via email to the address shown (e.g., `customer@example.com`)
- Use the customer's name for a personal touch

### Step 3: Resolve the Request

- Once you've responded, click **Mark as Resolved** in the admin panel
- Optionally add **Resolution Notes** for your internal records (e.g., "Replied via email, issue resolved")
- Resolved requests move out of the Pending queue

## Filter Options

| Filter | Description |
|--------|-------------|
| **All** | Shows all requests regardless of status |
| **Pending** | Only unresolved requests (default view for triage) |
| **Resolved** | Only resolved requests (for audit/history) |

## Request Lifecycle

```
Customer submits form → Request created (Pending) → Admin reviews → Admin responds → Mark as Resolved
```

## Low Stock Alerts

Low stock alerts are automated and appear in two places:

1. **Admin Notifications** — A high-priority notification appears in the admin panel
2. **Email** — An email is sent to `ADMIN_ALERT_EMAIL` (if configured)

The threshold is configurable via **Settings > Inventory > lowStockThreshold** (default: 10 units).

To adjust the threshold:
1. Go to **Settings** in the admin panel
2. Find or create the `lowStockThreshold` setting
3. Set the desired value (e.g., `5` for low-volume items)

## Subscription Dunning (Failed Payments)

When a subscription payment fails via Stripe:

1. The customer receives an **in-app notification** and **email** asking them to update their payment method
2. An **admin notification** is created so you're aware of the failed payment
3. A failed **Invoice** record is created in the system
4. The subscription's grace period logic (handled by the subscription service) takes over automatically

### What to do when a dunning alert appears:

1. Check the customer's subscription status in **Subscriptions**
2. If the customer hasn't updated their payment after a few days, consider reaching out personally
3. The subscription will enter a **grace period** (default: 4 weeks) before the tag is deactivated

## Support Request Data Model

| Field | Description |
|-------|-------------|
| `name` | Customer's name |
| `email` | Customer's email address |
| `message` | The support message content |
| `resolved` | Whether the request has been handled |
| `resolvedAt` | Timestamp when resolved |
| `resolvedBy` | Admin user who resolved it |
| `notes` | Internal resolution notes |
| `createdAt` | When the request was submitted |

## Tips

- **Respond within 24 hours** — even if just to acknowledge receipt
- Use the resolution notes to track what actions you took
- If a request requires technical investigation, note that in the resolution and follow up
- The contact form has rate limiting (5 requests per hour per IP) to prevent abuse
