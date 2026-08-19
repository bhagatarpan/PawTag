import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createProductsWorkflow,
  createStockLocationsWorkflow,
  createLocationFulfillmentSetWorkflow,
  createServiceZonesWorkflow,
  createShippingOptionsWorkflow,
  createInventoryLevelsWorkflow,
  createPricePreferencesWorkflow,
  createTaxRegionsWorkflow,
  createProductTypesWorkflow,
  createProductTagsWorkflow,
  createProductCategoriesWorkflow,
  createApiKeysWorkflow,
  createStoresWorkflow,
  createSalesChannelsWorkflow,
} from "@medusajs/medusa/core-flows";
import mongoose from "mongoose";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function slug(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function run<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T | undefined> {
  try {
    const result = await fn();
    console.log(`  ✓ ${name}`);
    return result;
  } catch (err: any) {
    if (err?.message?.includes("already exists")) {
      console.log(`  ⏭  ${name} (already exists)`);
      return undefined;
    }
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Seed script                                                       */
/* ------------------------------------------------------------------ */

export default async function seedPawTag({ container }: ExecArgs) {
  // -------------------------------------------------------------------
  // 1. Connect to MongoDB (source of product truth)
  // -------------------------------------------------------------------
  const mongodbUri =
    process.env.MONGODB_URI ||
    process.env.DB_URL ||
    "mongodb+srv://arpanbhagat:E92nqT9f@cluster0.mongodb.net/pawtag?retryWrites=true&w=majority";

  console.log("\n🔗  Connecting to MongoDB…");
  await mongoose.connect(mongodbUri);
  const mongoProductCol = mongoose.connection.db!.collection("products");
  const mongoProducts = (await mongoProductCol.find({}).toArray()) as any[];
  console.log(`   Found ${mongoProducts.length} products in MongoDB.\n`);

  // -------------------------------------------------------------------
  // Resolve services
  // -------------------------------------------------------------------
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  // -------------------------------------------------------------------
  // 2. Store + default sales channel
  // -------------------------------------------------------------------
  console.log("📦  Store & sales channel…");
  await run("Create default store", async () => {
    const { result: stores } = await createStoresWorkflow(container).run({
      input: {
        stores: [
          {
            name: "PawTag Store",
            supported_currencies: [
              { currency_code: "nzd", is_default: true },
            ],
          },
        ],
      },
    });
    return stores[0];
  });

  const defaultSalesChannel = (
    await run("Get default sales channel", async () => {
      const scService = container.resolve(Modules.SALES_CHANNEL);
      const channels = await scService.listSalesChannels({
        name: "Default Sales Channel",
      });
      return channels[0];
    })
  ) as any;

  if (!defaultSalesChannel) {
    // Create if missing
    const scService = container.resolve(Modules.SALES_CHANNEL);
    const created = await scService.createSalesChannels({
      name: "Default Sales Channel",
    });
    Object.assign(defaultSalesChannel, created);
  }

  // -------------------------------------------------------------------
  // 3. Region — New Zealand
  // -------------------------------------------------------------------
  console.log("\n🌏  Region…");
  let nzRegion: any;
  await run("Create NZ region", async () => {
    const regionModuleService = container.resolve(Modules.REGION);
    const existing = await regionModuleService.listRegions({
      name: "New Zealand",
    });
    if (existing.length > 0) {
      nzRegion = existing[0];
      console.log("  ⏭  NZ region (already exists)");
      return undefined;
    }

    const providers: string[] = [];
    if (process.env.STRIPE_API_KEY) {
      providers.push("pp_stripe_stripe");
    } else {
      providers.push("pp_system_default");
    }

    nzRegion = await regionModuleService.createRegions({
      name: "New Zealand",
      currency_code: "nzd",
      countries: ["nz"],
      automatic_taxes: true,
      payment_providers: providers,
    });
    console.log("  ✓ NZ region created");
    return nzRegion;
  });

  // Re-resolve if it was skipped
  if (!nzRegion) {
    const regionModuleService = container.resolve(Modules.REGION);
    const regions = await regionModuleService.listRegions({
      name: "New Zealand",
    });
    nzRegion = regions[0];
  }

  // -------------------------------------------------------------------
  // 4. Tax region — 15% GST (tax-inclusive)
  // -------------------------------------------------------------------
  console.log("\n💰  Tax…");
  await run("Create NZ tax region", async () => {
    const taxModuleService = container.resolve(Modules.TAX);
    const existing = await taxModuleService.listTaxRegions({
      country_code: "nz",
    });
    if (existing.length > 0) {
      console.log("  ⏭  NZ tax region (already exists)");
      return undefined;
    }

    const taxRegion = await taxModuleService.createTaxRegions({
      country_code: "nz",
      provider_id: "tp_system",
    });

    await taxModuleService.createTaxRates({
      tax_region_id: taxRegion.id,
      name: "GST",
      rate: 15,
      code: "GST",
    });
    console.log("  ✓ NZ tax region + 15% GST rate created");
    return taxRegion;
  });

  // Price preference: tax-inclusive for the NZ region
  await run("Create tax-inclusive price preference", async () => {
    const pricingModuleService = container.resolve(Modules.PRICING);
    const existing = await pricingModuleService.listPricePreferences({
      attribute: "region_id",
      value: nzRegion.id,
    });
    if (existing.length > 0) {
      console.log("  ⏭  Price preference (already exists)");
      return undefined;
    }
    return createPricePreferencesWorkflow(container).run({
      input: [
        {
          attribute: "region_id",
          value: nzRegion.id,
          is_tax_inclusive: true,
        },
      ],
    });
  });

  // -------------------------------------------------------------------
  // 5. Stock location + fulfillment
  // -------------------------------------------------------------------
  console.log("\n🏭  Stock location & fulfillment…");

  let stockLocation: any;
  await run("Create PawTag Warehouse", async () => {
    const slModule = container.resolve(Modules.STOCK_LOCATION);
    const existing = await slModule.listStockLocations({
      name: "PawTag Warehouse",
    });
    if (existing.length > 0) {
      stockLocation = existing[0];
      console.log("  ⏭  PawTag Warehouse (already exists)");
      return undefined;
    }
    const { result } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: "PawTag Warehouse",
            address: {
              address_1: "PawTag HQ",
              city: "Auckland",
              country_code: "nz",
              postal_code: "1010",
            },
          },
        ],
      },
    });
    stockLocation = result[0];
    return stockLocation;
  });

  // Resolve stock location if it was skipped
  if (!stockLocation) {
    const slModule = container.resolve(Modules.STOCK_LOCATION);
    const locations = await slModule.listStockLocations({
      name: "PawTag Warehouse",
    });
    stockLocation = locations[0];
  }

  // Fulfillment set + link
  let fulfillmentSet: any;
  await run("Create PawTag Shipping fulfillment set", async () => {
    const fsModule = container.resolve(Modules.FULFILLMENT);
    const existing = await fsModule.listFulfillmentSets({
      name: "PawTag Shipping",
    });
    if (existing.length > 0) {
      fulfillmentSet = existing[0];
      console.log("  ⏭  Fulfillment set (already exists)");
      return undefined;
    }
    fulfillmentSet = await fsModule.createFulfillmentSets({
      name: "PawTag Shipping",
      type: "shipping",
    });
    return fulfillmentSet;
  });

  if (!fulfillmentSet) {
    const fsModule = container.resolve(Modules.FULFILLMENT);
    const sets = await fsModule.listFulfillmentSets({
      name: "PawTag Shipping",
    });
    fulfillmentSet = sets[0];
  }

  // Link stock location ↔ fulfillment set
  await run("Link stock location ↔ fulfillment set", async () => {
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    });
  });

  // Link sales channel ↔ stock location (required for inventory)
  await run("Link sales channel ↔ stock location", async () => {
    await link.create({
      [Modules.SALES_CHANNEL]: { sales_channel_id: defaultSalesChannel.id },
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    });
  });

  // Service zone
  await run("Create New Zealand service zone", async () => {
    const fsModule = container.resolve(Modules.FULFILLMENT);
    const existing = await fsModule.listServiceZones({
      name: "New Zealand",
    });
    if (existing.length > 0) {
      console.log("  ⏭  Service zone (already exists)");
      return undefined;
    }
    return createServiceZonesWorkflow(container).run({
      input: {
        data: [
          {
            name: "New Zealand",
            fulfillment_set_id: fulfillmentSet.id,
            geo_zones: [{ country_code: "nz", type: "country" }],
          },
        ],
      },
    });
  });

  // Resolve service zone
  const fsModule = container.resolve(Modules.FULFILLMENT);
  const serviceZones = await fsModule.listServiceZones({
    name: "New Zealand",
  });
  const nzServiceZone = serviceZones[0];

  // Default shipping profile
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles();
  const defaultShippingProfile =
    shippingProfiles.find((p: any) => p.type === "default") ||
    shippingProfiles[0];

  // Free shipping option — create via module service (bypasses workflow validation
  // which requires provider ↔ stock_location link that isn't needed at runtime)
  let shippingOption: any;
  await run("Create Standard Shipping (Free) option", async () => {
    const existing = await fulfillmentModuleService.listShippingOptions({
      name: "Standard Shipping (Free)",
    });
    if (existing.length > 0) {
      shippingOption = existing[0];
      console.log("  ⏭  Shipping option (already exists)");
      return undefined;
    }

    // Create the option type
    const optionType = await fulfillmentModuleService.createShippingOptionTypes({
      label: "Standard",
      description: "Free NZ-wide shipping (3–5 working days)",
      code: "standard-free",
    });

    // Create the shipping option
    shippingOption = await fulfillmentModuleService.createShippingOptions({
      name: "Standard Shipping (Free)",
      price_type: "flat",
      service_zone_id: nzServiceZone.id,
      shipping_profile_id: defaultShippingProfile.id,
      provider_id: "manual_manual",
      type: optionType,
    });

    // Create price set and link to shipping option
    const pricingModuleService = container.resolve(Modules.PRICING);
    const priceSet = await pricingModuleService.createPriceSets({
      prices: [
        { currency_code: "nzd", amount: 0 },
        { currency_code: "nzd", amount: 0, rules: { region_id: nzRegion.id } },
      ],
    });
    await link.create({
      [Modules.FULFILLMENT]: { shipping_option_id: shippingOption.id },
      [Modules.PRICING]: { price_set_id: priceSet.id },
    });

    return shippingOption;
  });

  // -------------------------------------------------------------------
  // 6. Publishable API key
  // -------------------------------------------------------------------
  console.log("\n🔑  API key…");
  let publishableApiKey: any;
  await run("Create publishable API key", async () => {
    const apiKeyService = container.resolve(Modules.API_KEY);
    const existing = await apiKeyService.listApiKeys({
      title: "PawTag Storefront",
    });
    if (existing.length > 0) {
      publishableApiKey = existing[0];
      console.log("  ⏭  API key (already exists)");
      console.log(`  📋  Publishable key token: ${publishableApiKey.token}`);
      return undefined;
    }
    const { result: keys } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          {
            title: "PawTag Storefront",
            type: "publishable",
            created_by: "seed-script",
          },
        ],
      },
    });
    publishableApiKey = keys[0];
    console.log(`  📋  Publishable key token: ${publishableApiKey.token}`);
    return publishableApiKey;
  });

  // Link API key ↔ sales channel using the dedicated workflow
  await run("Link API key ↔ default sales channel", async () => {
    const { linkSalesChannelsToApiKeyWorkflow } = await import(
      "@medusajs/medusa/core-flows"
    );
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: {
        id: publishableApiKey.id,
        add: [defaultSalesChannel.id],
        remove: [],
      },
    });
  });

  // -------------------------------------------------------------------
  // 7. Product types, tags, categories
  // -------------------------------------------------------------------
  console.log("\n🏷️  Product types & tags…");
  await run("Create product types", async () => {
    const types = ["Tag", "Accessory", "Subscription"];
    const typeService = container.resolve(Modules.PRODUCT);
    const existing = await typeService.listProductTypes({});
    const existingValues = new Set(existing.map((t: any) => t.value));
    const toCreate = types
      .filter((t) => !existingValues.has(t))
      .map((t) => ({ value: t }));
    if (toCreate.length === 0) {
      console.log("  ⏭  All types already exist");
      return undefined;
    }
    return createProductTypesWorkflow(container).run({
      input: { product_types: toCreate },
    });
  });

  await run("Create product tags", async () => {
    const tagValues = [
      "qr",
      "nfc",
      "plastic",
      "metal",
      "premium",
      "epoxy",
      "essential",
      "popular",
      "subscription",
    ];
    const tagService = container.resolve(Modules.PRODUCT);
    const existing = await tagService.listProductTags({});
    const existingVals = new Set(existing.map((t: any) => t.value));
    const toCreate = tagValues
      .filter((v) => !existingVals.has(v))
      .map((v) => ({ value: v }));
    if (toCreate.length === 0) {
      console.log("  ⏭  All tags already exist");
      return undefined;
    }
    return createProductTagsWorkflow(container).run({
      input: { product_tags: toCreate },
    });
  });

  // Resolve product type/tag IDs
  const productModuleService = container.resolve(Modules.PRODUCT);
  const productTypes = await productModuleService.listProductTypes({});
  const productTags = await productModuleService.listProductTags({});

  const typeMap = new Map(productTypes.map((t: any) => [t.value, t.id]));
  const tagMap = new Map(productTags.map((t: any) => [t.value, t.id]));

  // Category
  await run("Create PawTag category", async () => {
    const existing = await productModuleService.listProductCategories({
      name: "PawTag",
    });
    if (existing.length > 0) {
      console.log("  ⏭  Category already exists");
      return undefined;
    }
    return createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: [{ name: "PawTag", handle: "pawtag" }],
      },
    });
  });

  const categoryResult = await productModuleService.listProductCategories({
    name: "PawTag",
  });
  const pawtagCategoryId = categoryResult[0]?.id;

  // -------------------------------------------------------------------
  // 8. Products (from MongoDB → Medusa)
  // -------------------------------------------------------------------
  console.log("\n🛒  Products…");
  const existingProductList = await productModuleService.listProducts({});
  const existingHandles = new Set(
    existingProductList.map((p: any) => p.handle)
  );

  const newProducts: any[] = [];

  for (const mongo of mongoProducts) {
    const handle = slug(mongo.sku || mongo.name);
    if (existingHandles.has(handle)) {
      console.log(`  ⏭  ${mongo.name} (handle: ${handle}) — already exists`);
      continue;
    }

    newProducts.push({
      title: mongo.name,
      handle,
      description: mongo.description,
      subtitle: mongo.shortDescription || null,
      status: ProductStatus.PUBLISHED,
      is_giftcard: false,
      discountable: true,
      thumbnail: mongo.images?.[0] || null,
      images: (mongo.images || []).map((url: string) => ({ url })),
      type_id: typeMap.get("Tag") || null,
      tag_ids: (mongo.tags || [])
        .map((v: string) => tagMap.get(v))
        .filter(Boolean) as string[],
      category_ids: pawtagCategoryId ? [pawtagCategoryId] : [],
      metadata: {
        isSubscription: !!mongo.isSubscription,
        isTagProduct: !!mongo.isTagProduct,
        subscriptionConfig: mongo.subscriptionConfig || null,
        warrantyMonths: mongo.warrantyMonths ?? 12,
        mongoId: mongo._id.toString(),
        // Affiliate fields (for future use)
        affiliateSource: null,  // 'amazon', 'partner', etc.
        affiliateId: null,      // External product ID
        affiliateUrl: null,     // Affiliate product URL
        affiliateCommission: null, // Commission percentage
      },
      options: [{ title: "Default", values: ["Default"] }],
      shipping_profile_id: defaultShippingProfile.id,
      sales_channels: [{ id: defaultSalesChannel.id }],
      variants: [
        {
          title: "Default",
          sku: mongo.sku,
          manage_inventory: !!mongo.stock,
          prices: [{ currency_code: "nzd", amount: mongo.price }],
          // Note: Medusa v2 stores prices in major units (dollars), not cents
          // mongo.price is already in dollars (e.g., 19.99)
          options: { Default: "Default" },
        },
      ],
    });
  }

  if (newProducts.length === 0) {
    console.log("  ⏭  All products already seeded");
  } else {
    const { result: createdProducts } = await createProductsWorkflow(
      container
    ).run({
      input: { products: newProducts },
    });
    console.log(`  ✓ Created ${createdProducts.length} products:`);
    for (const p of createdProducts) {
      console.log(`    - ${p.title} (handle: ${p.handle})`);
    }

    // Explicitly create price sets for each variant via pricing module
    console.log("\n💰  Creating price sets...");
    const pricingModuleService = container.resolve(Modules.PRICING) as any;
    for (const p of createdProducts) {
      for (const v of p.variants || []) {
        const mongoProduct = mongoProducts.find(
          (mp: any) => slug(mp.sku || mp.name) === p.handle
        );
        const priceAmount = mongoProduct?.price || 0;
        if (priceAmount > 0) {
          const priceSet = await pricingModuleService.createPriceSets({
            prices: [{ currency_code: "nzd", amount: priceAmount }],
          });
          // Link price set to variant
          await link.create({
            [Modules.PRODUCT]: { variant_id: v.id },
            [Modules.PRICING]: { price_set_id: priceSet.id },
          });
          console.log(
            `    ✓ ${p.title}: $${(priceAmount / 100).toFixed(2)} NZD linked to variant`
          );
        }
      }
    }
  }

  // -------------------------------------------------------------------
  // 9. Ensure prices are set for ALL products (idempotent)
  // -------------------------------------------------------------------
  console.log("\n💰  Ensuring prices are set...");
  const pricingModuleService = container.resolve(Modules.PRICING) as any;
  console.log("  Pricing module:", typeof pricingModuleService);
  console.log("  Pricing methods:", pricingModuleService ? Object.getOwnPropertyNames(Object.getPrototypeOf(pricingModuleService)).filter((m: string) => m.includes("price") || m.includes("create")).slice(0, 10) : "none");
  const allProductsForPrices = await productModuleService.listProducts({}, { relations: ["variants"] });
  console.log(`  Found ${allProductsForPrices.length} products in Medusa`);
  console.log(`  Found ${mongoProducts.length} products in MongoDB`);
  for (const p of allProductsForPrices) {
    console.log(`  Processing: ${p.title} (handle: ${p.handle}, variants: ${p.variants?.length || 0})`);
    if (!p.variants || p.variants.length === 0) {
      console.log(`    ⚠  No variants found for ${p.title}`);
    }
    for (const v of p.variants || []) {
      // Find the price from MongoDB
      const mongoProduct = mongoProducts.find(
        (mp: any) => slug(mp.sku || mp.name) === p.handle
      );
      const priceAmount = mongoProduct?.price || 0;
      console.log(`    Variant ${v.sku}: mongo price = ${mongoProduct?.price}, priceAmount = ${priceAmount}`);
      if (priceAmount > 0) {
        try {
          console.log(`    Creating price set for ${p.title} (${v.sku}): ${priceAmount} cents`);
          const priceSet = await pricingModuleService.createPriceSets({
            prices: [{ currency_code: "nzd", amount: priceAmount }],
          });
          console.log(`    Price set created: ${priceSet?.id || "no id"}`);
          await link.create({
            [Modules.PRODUCT]: { variant_id: v.id },
            [Modules.PRICING]: { price_set_id: priceSet.id },
          });
          console.log(
            `    ✓ ${p.title}: $${(priceAmount / 100).toFixed(2)} NZD`
          );
        } catch (e: any) {
          console.log(`    ⚠  ${p.title}: ${e.message || e}`);
        }
      }
    }
  }

  // -------------------------------------------------------------------
  // 10. Inventory levels (stock for each variant)
  // -------------------------------------------------------------------
  console.log("\n📦  Inventory…");

  // Re-read products (now includes newly created ones)
  const allProducts = await productModuleService.listProducts({});
  const stockLocationId = stockLocation.id;

  await run("Seed inventory levels", async () => {
    const inventoryModuleService = container.resolve(Modules.INVENTORY) as any;
    const existingLevels =
      await inventoryModuleService.listInventoryLevels({});
    const existingItemIds = new Set(
      existingLevels.map((l: any) => l.inventory_item_id)
    );

    // Get all inventory items directly
    const allInventoryItems = await inventoryModuleService.listInventoryItems({});
    console.log(`  Found ${allInventoryItems.length} inventory items`);

    const newLevels: any[] = [];

    for (const invItem of allInventoryItems) {
      if (existingItemIds.has(invItem.id)) continue;

      // Find the product that owns this inventory item via SKU
      const mongo = mongoProducts.find(
        (m: any) => m.sku === invItem.sku
      );
      const stockedQty = mongo?.stock ?? 0;

      newLevels.push({
        inventory_item_id: invItem.id,
        location_id: stockLocationId,
        stocked_quantity: stockedQty,
      });
    }

    if (newLevels.length === 0) {
      console.log("  ⏭  Inventory levels already set");
      return undefined;
    }

    console.log(`  Creating ${newLevels.length} inventory levels`);
    return createInventoryLevelsWorkflow(container).run({
      input: { inventory_levels: newLevels },
    });
  });

  // -------------------------------------------------------------------
  // Done
  // -------------------------------------------------------------------
  console.log("\n✅  PawTag seed complete!\n");

  // Print publishable key for reference
  if (publishableApiKey?.token) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋  Publishable API Key (for storefront):");
    console.log(`    ${publishableApiKey.token}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  }

  // Disconnect MongoDB (Medusa's PG connection stays open)
  await mongoose.disconnect();
}
