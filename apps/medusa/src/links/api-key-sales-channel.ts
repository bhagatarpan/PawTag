import { defineLink, Modules } from "@medusajs/framework/utils";

export default defineLink(
  {
    serviceName: Modules.API_KEY,
    field: "api_key_id",
    linkable: "api_key_id",
    primaryKey: "id",
    entity: "ApiKey",
  },
  {
    serviceName: Modules.SALES_CHANNEL,
    field: "sales_channel_id",
    linkable: "sales_channel_id",
    primaryKey: "id",
    entity: "SalesChannel",
  }
);
