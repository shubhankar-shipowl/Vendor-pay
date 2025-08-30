import { type User, type InsertUser, type UploadedFile, type InsertUploadedFile, type Supplier, type InsertSupplier, type PriceEntry, type InsertPriceEntry, type Order, type InsertOrder, type ReconciliationLog, type InsertReconciliationLog } from "@shared/schema";
import { db } from "./db";
import { users, uploadedFiles, suppliers, priceEntries, orders, reconciliationLog } from "@shared/schema";
import { eq } from "drizzle-orm";
import { IStorage } from "./storage";

export class DrizzleStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  // File methods
  async createUploadedFile(file: InsertUploadedFile): Promise<UploadedFile> {
    const result = await db.insert(uploadedFiles).values(file).returning();
    return result[0];
  }

  async getUploadedFile(id: string): Promise<UploadedFile | undefined> {
    const result = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, id));
    return result[0];
  }

  async updateUploadedFile(id: string, updates: Partial<UploadedFile>): Promise<UploadedFile | undefined> {
    const result = await db.update(uploadedFiles).set(updates).where(eq(uploadedFiles.id, id)).returning();
    return result[0];
  }

  async getAllUploadedFiles(): Promise<UploadedFile[]> {
    return await db.select().from(uploadedFiles);
  }

  // Supplier methods
  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const result = await db.insert(suppliers).values(supplier).returning();
    return result[0];
  }

  async getSupplier(id: string): Promise<Supplier | undefined> {
    const result = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return result[0];
  }

  async getSupplierByName(name: string): Promise<Supplier | undefined> {
    const result = await db.select().from(suppliers).where(eq(suppliers.name, name));
    return result[0];
  }

  async getAllSuppliers(): Promise<Supplier[]> {
    return await db.select().from(suppliers);
  }

  async updateSupplierOrderAccount(id: string, orderAccount: string | null): Promise<Supplier | undefined> {
    const result = await db.update(suppliers)
      .set({ orderAccount })
      .where(eq(suppliers.id, id))
      .returning();
    return result[0];
  }

  async updateSupplier(id: string, updates: Partial<Supplier>): Promise<Supplier | undefined> {
    const result = await db.update(suppliers)
      .set(updates)
      .where(eq(suppliers.id, id))
      .returning();
    return result[0];
  }

  // Price entry methods
  async createPriceEntry(priceEntry: InsertPriceEntry): Promise<PriceEntry> {
    const result = await db.insert(priceEntries).values(priceEntry).returning();
    return result[0];
  }

  async getPriceEntry(id: string): Promise<PriceEntry | undefined> {
    const result = await db.select().from(priceEntries).where(eq(priceEntries.id, id));
    return result[0];
  }

  async getAllPriceEntries(): Promise<PriceEntry[]> {
    return await db.select().from(priceEntries);
  }

  async getPriceEntriesBySupplier(supplierId: string): Promise<PriceEntry[]> {
    return await db.select().from(priceEntries).where(eq(priceEntries.supplierId, supplierId));
  }

  async updatePriceEntry(id: string, updates: Partial<PriceEntry>): Promise<PriceEntry | undefined> {
    console.log('DrizzleStorage.updatePriceEntry called with:', { id, updates });
    
    // CRITICAL FIX: Ensure proper date conversion at storage layer
    const cleanUpdates = { ...updates };
    
    // Handle effectiveFrom date conversion
    if (cleanUpdates.effectiveFrom !== undefined) {
      if (typeof cleanUpdates.effectiveFrom === 'string') {
        cleanUpdates.effectiveFrom = new Date(cleanUpdates.effectiveFrom);
      } else if (cleanUpdates.effectiveFrom && !cleanUpdates.effectiveFrom.toISOString) {
        // If it's an object but not a Date, try to convert it
        cleanUpdates.effectiveFrom = new Date(cleanUpdates.effectiveFrom);
      }
    }
    
    // Handle effectiveTo date conversion
    if (cleanUpdates.effectiveTo !== undefined) {
      if (cleanUpdates.effectiveTo === null || cleanUpdates.effectiveTo === '') {
        cleanUpdates.effectiveTo = null;
      } else if (typeof cleanUpdates.effectiveTo === 'string') {
        cleanUpdates.effectiveTo = new Date(cleanUpdates.effectiveTo);
      } else if (cleanUpdates.effectiveTo && !cleanUpdates.effectiveTo.toISOString) {
        // If it's an object but not a Date, try to convert it
        cleanUpdates.effectiveTo = new Date(cleanUpdates.effectiveTo);
      }
    }
    
    // Remove any fields that are undefined to prevent Drizzle issues
    Object.keys(cleanUpdates).forEach(key => {
      if (cleanUpdates[key] === undefined) {
        delete cleanUpdates[key];
      }
    });
    
    console.log('Cleaned updates for Drizzle:', cleanUpdates);
    
    const result = await db.update(priceEntries).set(cleanUpdates).where(eq(priceEntries.id, id)).returning();
    return result[0];
  }

  async deletePriceEntry(id: string): Promise<boolean> {
    const result = await db.delete(priceEntries).where(eq(priceEntries.id, id)).returning();
    return result.length > 0;
  }

  // Order methods
  async createOrder(order: InsertOrder): Promise<Order> {
    const result = await db.insert(orders).values(order).returning();
    return result[0];
  }

  async createOrders(orderList: InsertOrder[]): Promise<Order[]> {
    if (orderList.length === 0) return [];
    const result = await db.insert(orders).values(orderList).returning();
    return result;
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.id, id));
    return result[0];
  }

  async getOrderByAwbNo(awbNo: string): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.awbNo, awbNo));
    return result[0];
  }

  async getAllOrders(): Promise<Order[]> {
    return await db.select().from(orders);
  }

  async clearAllOrders(): Promise<void> {
    await db.delete(orders);
  }

  async getOrdersByFileId(fileId: string): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.fileId, fileId));
  }

  async updateOrder(id: string, updates: Partial<Order>): Promise<Order | undefined> {
    const result = await db.update(orders).set(updates).where(eq(orders.id, id)).returning();
    return result[0];
  }

  // Reconciliation log methods
  async createReconciliationLog(log: InsertReconciliationLog): Promise<ReconciliationLog> {
    const result = await db.insert(reconciliationLog).values(log).returning();
    return result[0];
  }

  async getAllReconciliationLogs(): Promise<ReconciliationLog[]> {
    return await db.select().from(reconciliationLog);
  }

  async getReconciliationLogsByAwbNo(awbNo: string): Promise<ReconciliationLog[]> {
    return await db.select().from(reconciliationLog).where(eq(reconciliationLog.awbNo, awbNo));
  }
}