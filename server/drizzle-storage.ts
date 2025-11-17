import { randomUUID } from "crypto";
import { type User, type InsertUser, type UploadedFile, type InsertUploadedFile, type Supplier, type InsertSupplier, type PriceEntry, type InsertPriceEntry, type Order, type InsertOrder, type ReconciliationLog, type InsertReconciliationLog } from "@shared/schema";
import { db } from "./db";
import { users, uploadedFiles, suppliers, priceEntries, orders, reconciliationLog } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
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
    const id = insertUser.id ?? randomUUID();

    await db.insert(users).values({ ...insertUser, id });

    const created = await this.getUser(id);
    if (!created) {
      throw new Error("Failed to create user");
    }
    return created;
  }

  // File methods
  async createUploadedFile(file: InsertUploadedFile): Promise<UploadedFile> {
    const id = file.id ?? randomUUID();
    await db.insert(uploadedFiles).values({ ...file, id });
    const created = await this.getUploadedFile(id);
    if (!created) {
      throw new Error("Failed to create uploaded file");
    }
    return created;
  }

  async getUploadedFile(id: string): Promise<UploadedFile | undefined> {
    const result = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, id));
    return result[0];
  }

  async updateUploadedFile(id: string, updates: Partial<UploadedFile>): Promise<UploadedFile | undefined> {
    await db.update(uploadedFiles).set(updates).where(eq(uploadedFiles.id, id));
    return this.getUploadedFile(id);
  }

  async getAllUploadedFiles(): Promise<UploadedFile[]> {
    return await db.select().from(uploadedFiles);
  }

  // Supplier methods
  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const id = supplier.id ?? randomUUID();
    await db.insert(suppliers).values({ ...supplier, id });
    const created = await this.getSupplier(id);
    if (!created) {
      throw new Error("Failed to create supplier");
    }
    return created;
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
    await db.update(suppliers)
      .set({ orderAccount })
      .where(eq(suppliers.id, id));
    return this.getSupplier(id);
  }

  async updateSupplier(id: string, updates: Partial<Supplier>): Promise<Supplier | undefined> {
    await db.update(suppliers)
      .set(updates)
      .where(eq(suppliers.id, id));
    return this.getSupplier(id);
  }

  // Price entry methods
  async createPriceEntry(priceEntry: InsertPriceEntry): Promise<PriceEntry> {
    const id = priceEntry.id ?? randomUUID();
    await db.insert(priceEntries).values({ ...priceEntry, id });
    const created = await this.getPriceEntry(id);
    if (!created) {
      throw new Error("Failed to create price entry");
    }
    return created;
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
    
    await db.update(priceEntries).set(cleanUpdates).where(eq(priceEntries.id, id));
    return this.getPriceEntry(id);
  }

  async deletePriceEntry(id: string): Promise<boolean> {
    const result = await db.delete(priceEntries).where(eq(priceEntries.id, id));
    const affected =
      // @ts-expect-error drizzle mysql returns ResultSetHeader
      (result?.rowsAffected ?? result?.affectedRows ?? 0) as number;
    return affected > 0;
  }

  // Order methods
  async createOrder(order: InsertOrder): Promise<Order> {
    const id = order.id ?? randomUUID();
    await db.insert(orders).values({ ...order, id });
    const created = await this.getOrder(id);
    if (!created) {
      throw new Error("Failed to create order");
    }
    return created;
  }

  async createOrders(orderList: InsertOrder[]): Promise<Order[]> {
    if (orderList.length === 0) return [];

    const ordersWithIds = orderList.map((order) => ({
      ...order,
      id: order.id ?? randomUUID(),
    }));

    await db.insert(orders).values(ordersWithIds);

    const ids = ordersWithIds.map((order) => order.id!);
    return db.select().from(orders).where(inArray(orders.id, ids));
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
    await db.update(orders).set(updates).where(eq(orders.id, id));
    return this.getOrder(id);
  }

  // Reconciliation log methods
  async createReconciliationLog(log: InsertReconciliationLog): Promise<ReconciliationLog> {
    const id = log.id ?? randomUUID();
    await db.insert(reconciliationLog).values({ ...log, id });
    const created = await db.select().from(reconciliationLog).where(eq(reconciliationLog.id, id));
    if (!created[0]) {
      throw new Error("Failed to create reconciliation log");
    }
    return created[0];
  }

  async getAllReconciliationLogs(): Promise<ReconciliationLog[]> {
    return await db.select().from(reconciliationLog);
  }

  async getReconciliationLogsByAwbNo(awbNo: string): Promise<ReconciliationLog[]> {
    return await db.select().from(reconciliationLog).where(eq(reconciliationLog.awbNo, awbNo));
  }
}