import {
  pgTable,
  text,
  serial,
  timestamp,
  index,
  bigint,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const addressesTable = pgTable(
  "addresses",
  {
    id: serial("id").primaryKey(),
    country_code: text("country_code").notNull(),
    postcode: text("postcode").notNull(),
    city: text("city"),
    street: text("street"),
    house_number: text("house_number"),
    source_dataset: text("source_dataset").notNull(),
  },
  (table) => [
    index("addresses_country_postcode_idx").on(
      table.country_code,
      table.postcode,
    ),
    index("addresses_country_postcode_city_idx").on(
      table.country_code,
      table.postcode,
      table.city,
    ),
  ],
);

export const datasetIngestionsTable = pgTable("dataset_ingestions", {
  id: serial("id").primaryKey(),
  country_code: text("country_code").notNull().unique(),
  source_url: text("source_url").notNull(),
  checksum: text("checksum").notNull(),
  record_count: bigint("record_count", { mode: "number" }),
  loaded_at: timestamp("loaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAddressSchema = createInsertSchema(addressesTable).omit({
  id: true,
});
export type InsertAddress = z.infer<typeof insertAddressSchema>;
export type Address = typeof addressesTable.$inferSelect;

export const insertDatasetIngestionSchema = createInsertSchema(
  datasetIngestionsTable,
).omit({ id: true });
export type InsertDatasetIngestion = z.infer<
  typeof insertDatasetIngestionSchema
>;
export type DatasetIngestion = typeof datasetIngestionsTable.$inferSelect;
