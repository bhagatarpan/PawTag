import { defineLink, Modules } from "@medusajs/framework/utils";

export default defineLink(
  {
    serviceName: Modules.PRODUCT,
    field: "product_id",
    linkable: "product_id",
    primaryKey: "id",
    entity: "Product",
  },
  {
    serviceName: Modules.FULFILLMENT,
    field: "shipping_profile_id",
    linkable: "shipping_profile_id",
    primaryKey: "id",
    entity: "ShippingProfile",
  }
);
