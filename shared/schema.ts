import { sql } from "drizzle-orm";
import { mysqlTable, varchar, decimal, datetime, json, int, text } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  username: varchar("username", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
});

export const uploadedFiles = mysqlTable("uploaded_files", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  filename: varchar("filename", { length: 255 }).notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  size: int("size").notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  uploadedAt: datetime("uploaded_at").default(sql`CURRENT_TIMESTAMP`),
  data: json("data"), // Raw parsed data from CSV/Excel
  columnMapping: json("column_mapping"),
  processedData: json("processed_data"),
  summary: json("summary")
});

export const suppliers = mysqlTable("suppliers", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  name: varchar("name", { length: 255 }).notNull().unique(),
  orderAccount: varchar("order_account", { length: 255 }),
  gstin: varchar("gstin", { length: 15 }),
  tradeName: varchar("trade_name", { length: 255 }),
  address: text("address"), // Bill to address
  shipToAddress: text("ship_to_address"), 
  placeOfSupply: varchar("place_of_supply", { length: 100 }),
  createdAt: datetime("created_at").default(sql`CURRENT_TIMESTAMP`)
});

export const products = mysqlTable("products", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  name: varchar("name", { length: 255 }).notNull(),
  supplierId: varchar("supplier_id", { length: 36 }).references(() => suppliers.id),
  createdAt: datetime("created_at").default(sql`CURRENT_TIMESTAMP`)
});

export const priceEntries = mysqlTable("price_entries", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  supplierId: varchar("supplier_id", { length: 36 }).references(() => suppliers.id),
  productName: varchar("product_name", { length: 255 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("INR"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(), // Final price (after GST)
  priceBeforeGst: decimal("price_before_gst", { precision: 10, scale: 2 }).notNull(),
  gstRate: decimal("gst_rate", { precision: 5, scale: 2 }).notNull().default("18.00"), // GST percentage
  hsn: varchar("hsn", { length: 50 }).notNull(),
  effectiveFrom: datetime("effective_from").notNull(),
  effectiveTo: datetime("effective_to"),
  createdAt: datetime("created_at").default(sql`CURRENT_TIMESTAMP`)
});

export const orders = mysqlTable("orders", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  awbNo: varchar("awb_no", { length: 50 }).notNull(),
  supplierId: varchar("supplier_id", { length: 36 }).references(() => suppliers.id),
  productName: varchar("product_name", { length: 255 }).notNull(),
  courier: varchar("courier", { length: 100 }),
  qty: int("qty").notNull().default(1),
  currency: varchar("currency", { length: 10 }).default("INR"),
  status: varchar("status", { length: 50 }).notNull(),
  orderAccount: varchar("order_account", { length: 255 }),
  channelOrderDate: datetime("channel_order_date"),
  orderDate: datetime("order_date"),
  deliveredDate: datetime("delivered_date"),
  rtsDate: datetime("rts_date"),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  lineAmount: decimal("line_amount", { precision: 10, scale: 2 }),
  hsn: varchar("hsn", { length: 50 }),
  fileId: varchar("file_id", { length: 36 }).references(() => uploadedFiles.id),
  createdAt: datetime("created_at").default(sql`CURRENT_TIMESTAMP`),
  previousStatus: varchar("previous_status", { length: 50 }),
  source: varchar("source", { length: 50 }).default("parcelx") // 'parcelx' or 'nimbus'
});

export const reconciliationLog = mysqlTable("reconciliation_log", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  awbNo: varchar("awb_no", { length: 50 }).notNull(),
  orderId: varchar("order_id", { length: 36 }).references(() => orders.id),
  previousStatus: varchar("previous_status", { length: 50 }),
  newStatus: varchar("new_status", { length: 50 }).notNull(),
  impact: decimal("impact", { precision: 10, scale: 2 }).notNull(),
  note: text("note"),
  timestamp: datetime("timestamp").default(sql`CURRENT_TIMESTAMP`)
});

export const supplierEmails = mysqlTable("supplier_emails", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  supplierId: varchar("supplier_id", { length: 36 }).references(() => suppliers.id),
  email: varchar("email", { length: 255 }).notNull(),
  supplierName: varchar("supplier_name", { length: 255 }).notNull(),
  createdAt: datetime("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime("updated_at").default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`)
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

export const insertSupplierEmailSchema = createInsertSchema(supplierEmails).omit({
  id: true,
  createdAt: true,
  updatedAt: true
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
export type InsertSupplierEmail = z.infer<typeof insertSupplierEmailSchema>;
export type SupplierEmail = typeof supplierEmails.$inferSelect;

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
