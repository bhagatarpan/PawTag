import { defineLink, Modules } from "@medusajs/framework/utils";

export default defineLink(
  {
    serviceName: Modules.FULFILLMENT,
    field: "shipping_option_id",
    linkable: "shipping_option_id",
    primaryKey: "id",
    entity: "ShippingOption",
  },
  {
    serviceName: Modules.PRICING,
    field: "price_set_id",
    linkable: "price_set_id",
    primaryKey: "id",
    entity: "PriceSet",
  }
);
