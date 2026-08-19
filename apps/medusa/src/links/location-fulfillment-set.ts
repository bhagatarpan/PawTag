import { defineLink, Modules } from "@medusajs/framework/utils";

export default defineLink(
  {
    serviceName: Modules.STOCK_LOCATION,
    field: "stock_location_id",
    linkable: "stock_location_id",
    primaryKey: "id",
    entity: "StockLocation",
  },
  {
    serviceName: Modules.FULFILLMENT,
    field: "fulfillment_set_id",
    linkable: "fulfillment_set_id",
    primaryKey: "id",
    entity: "FulfillmentSet",
  }
);
