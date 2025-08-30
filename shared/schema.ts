import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, json, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const uploadedFiles = pgTable("uploaded_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  size: integer("size").notNull(),
  mimeType: text("mime_type").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  data: json("data"), // Raw parsed data from CSV/Excel
  columnMapping: json("column_mapping"),
  processedData: json("processed_data"),
  summary: json("summary")
});

export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  orderAccount: text("order_account"),
  gstin: text("gstin"),
  tradeName: text("trade_name"),
  address: text("address"), // Bill to address
  shipToAddress: text("ship_to_address"), 
  placeOfSupply: text("place_of_supply"),
  createdAt: timestamp("created_at").defaultNow()
});

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  supplierId: varchar("supplier_id").references(() => suppliers.id),
  createdAt: timestamp("created_at").defaultNow()
});

export const priceEntries = pgTable("price_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  supplierId: varchar("supplier_id").references(() => suppliers.id),
  productName: text("product_name").notNull(),
  currency: text("currency").notNull().default("INR"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(), // Final price (after GST)
  priceBeforeGst: decimal("price_before_gst", { precision: 10, scale: 2 }).notNull(),
  gstRate: decimal("gst_rate", { precision: 5, scale: 2 }).notNull().default("18.00"), // GST percentage
  hsn: text("hsn").notNull(),
  effectiveFrom: timestamp("effective_from").notNull(),
  effectiveTo: timestamp("effective_to"),
  createdAt: timestamp("created_at").defaultNow()
});

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  awbNo: text("awb_no").notNull(),
  supplierId: varchar("supplier_id").references(() => suppliers.id),
  productName: text("product_name").notNull(),
  courier: text("courier"),
  qty: integer("qty").notNull().default(1),
  currency: text("currency").default("INR"),
  status: text("status").notNull(),
  orderAccount: text("order_account"),
  channelOrderDate: timestamp("channel_order_date"),
  orderDate: timestamp("order_date"),
  deliveredDate: timestamp("delivered_date"),
  rtsDate: timestamp("rts_date"),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  lineAmount: decimal("line_amount", { precision: 10, scale: 2 }),
  hsn: text("hsn"),
  fileId: varchar("file_id").references(() => uploadedFiles.id),
  createdAt: timestamp("created_at").defaultNow(),
  previousStatus: text("previous_status")
});

export const reconciliationLog = pgTable("reconciliation_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  awbNo: text("awb_no").notNull(),
  orderId: varchar("order_id").references(() => orders.id),
  previousStatus: text("previous_status"),
  newStatus: text("new_status").notNull(),
  impact: decimal("impact", { precision: 10, scale: 2 }).notNull(),
  note: text("note"),
  timestamp: timestamp("timestamp").defaultNow()
});

// Insert schemas
export const insertUploadedFileSchema = createInsertSchema(uploadedFiles).omit({
  id: true,
  uploadedAt: true
});

export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true
});

export const insertPriceEntrySchema = createInsertSchema(priceEntries).omit({
  id: true,
  createdAt: true
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true
});

export const insertReconciliationLogSchema = createInsertSchema(reconciliationLog).omit({
  id: true,
  timestamp: true
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertUploadedFile = z.infer<typeof insertUploadedFileSchema>;
export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;
export type InsertPriceEntry = z.infer<typeof insertPriceEntrySchema>;
export type PriceEntry = typeof priceEntries.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertReconciliationLog = z.infer<typeof insertReconciliationLogSchema>;
export type ReconciliationLog = typeof reconciliationLog.$inferSelect;

// Additional schemas for API requests
export const columnMappingSchema = z.object({
  supplierName: z.string(),
  awbNo: z.string(),
  productName: z.string(),
  status: z.string(),
  courier: z.string().optional(),
  qty: z.string().optional(),
  currency: z.string().optional(),
  channelOrderDate: z.string().optional(),
  orderDate: z.string().optional(),
  deliveredDate: z.string().optional(),
  rtsDate: z.string().optional()
});

export const reportFiltersSchema = z.object({
  periodFrom: z.string().optional(),
  periodTo: z.string().optional(),
  currency: z.string().optional(),
  minAmount: z.number().optional(),
  supplier: z.string().optional()
});

export type ColumnMapping = z.infer<typeof columnMappingSchema>;
export type ReportFilters = z.infer<typeof reportFiltersSchema>;
