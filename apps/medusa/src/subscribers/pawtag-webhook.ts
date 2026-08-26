import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const PAWTAG_WEBHOOK_URL = process.env.PAWTAG_WEBHOOK_URL || "http://localhost:5000/api/webhooks/medusa"
const PAWTAG_WEBHOOK_SECRET = process.env.PAWTAG_WEBHOOK_SECRET || ""

export default async function pawtagWebhookSubscriber(
  args: SubscriberArgs<{ id: string }>
) {
  const { event, container } = args
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const eventName = (event as any).name || "unknown"

  logger.info(`Forwarding Medusa event ${eventName} (${event.data.id}) to PawTag`)

  try {
    const payload = JSON.stringify({ event: eventName, data: event.data })

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    if (PAWTAG_WEBHOOK_SECRET) {
      const crypto = await import("crypto")
      const signature = crypto.createHmac("sha256", PAWTAG_WEBHOOK_SECRET).update(payload).digest("hex")
      headers["x-medusa-signature"] = signature
    }

    const response = await fetch(PAWTAG_WEBHOOK_URL, {
      method: "POST",
      headers,
      body: payload,
    })

    if (!response.ok) {
      logger.warn(`PawTag webhook returned status ${response.status}`)
    } else {
      logger.info(`PawTag webhook forwarded ${eventName} successfully`)
    }
  } catch (e) {
    logger.error(`Failed to forward event ${eventName} to PawTag: ${e}`)
  }
}

export const config: SubscriberConfig = {
  event: [
    "order.placed",
    "payment.captured",
    "order.canceled",
    "order.fulfillment_created",
    "order.fulfillment_canceled",
    "shipment.created",
  ],
}
