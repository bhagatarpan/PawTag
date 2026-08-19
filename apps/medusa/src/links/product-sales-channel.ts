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
    serviceName: Modules.SALES_CHANNEL,
    field: "sales_channel_id",
    linkable: "sales_channel_id",
    primaryKey: "id",
    entity: "SalesChannel",
  }
);
