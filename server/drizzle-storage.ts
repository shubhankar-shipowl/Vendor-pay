import { randomUUID } from "crypto";
import { type User, type InsertUser, type UploadedFile, type InsertUploadedFile, type Supplier, type InsertSupplier, type PriceEntry, type InsertPriceEntry, type Order, type InsertOrder, type ReconciliationLog, type InsertReconciliationLog, type SupplierEmail, type InsertSupplierEmail } from "@shared/schema";
import { db, retryDbOperation } from "./db";
import { users, uploadedFiles, suppliers, priceEntries, orders, reconciliationLog, supplierEmails } from "@shared/schema";
import { eq, inArray, or, sql } from "drizzle-orm";
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
    return await retryDbOperation(
      () => db.select().from(suppliers),
      3,
      1000
    );
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
    return await retryDbOperation(
      () => db.select().from(priceEntries),
      3,
      1000
    );
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
    return await retryDbOperation(
      () => db.select().from(orders),
      3,
      1000
    );
  }

  async clearAllOrders(): Promise<void> {
    await db.delete(orders);
  }

  async clearOrdersBySource(source: string): Promise<number> {
    const result = await db.delete(orders).where(eq(orders.source, source));
    return result[0]?.affectedRows || 0;
  }

  async getOrderCountBySource(source: string): Promise<number> {
    const result = await retryDbOperation(
      () => db.select({ count: sql<number>`COUNT(*)` })
        .from(orders)
        .where(eq(orders.source, source)),
      3,
      1000
    );
    return result[0]?.count || 0;
  }

  async getOrderCountsBySource(): Promise<{ parcelx: number; nimbus: number; total: number }> {
    // Use a single efficient SQL query to get all counts
    const result = await retryDbOperation(
      () => db.select({
        source: orders.source,
        count: sql<number>`COUNT(*)`
      })
      .from(orders)
      .groupBy(orders.source),
      3,
      1000
    );

    let parcelx = 0;
    let nimbus = 0;
    
    for (const row of result) {
      if (row.source === 'nimbus') {
        nimbus = Number(row.count);
      } else {
        parcelx += Number(row.count); // Include null/parcelx/undefined as parcelx
      }
    }

    return { parcelx, nimbus, total: parcelx + nimbus };
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

  // Supplier email methods
  async createSupplierEmail(email: InsertSupplierEmail): Promise<SupplierEmail> {
    const id = email.id ?? randomUUID();
    await db.insert(supplierEmails).values({ ...email, id });
    const created = await this.getSupplierEmail(id);
    if (!created) {
      throw new Error("Failed to create supplier email");
    }
    return created;
  }

  async getSupplierEmail(id: string): Promise<SupplierEmail | undefined> {
    const result = await db.select().from(supplierEmails).where(eq(supplierEmails.id, id));
    return result[0];
  }

  async getSupplierEmailBySupplierId(supplierId: string): Promise<SupplierEmail | undefined> {
    const result = await db.select().from(supplierEmails).where(eq(supplierEmails.supplierId, supplierId));
    return result[0];
  }

  async getSupplierEmailBySupplierName(supplierName: string): Promise<SupplierEmail | undefined> {
    const result = await db.select().from(supplierEmails).where(eq(supplierEmails.supplierName, supplierName));
    return result[0];
  }

  async getAllSupplierEmails(): Promise<SupplierEmail[]> {
    return await db.select().from(supplierEmails);
  }

  async updateSupplierEmail(id: string, updates: Partial<SupplierEmail>): Promise<SupplierEmail | undefined> {
    await db.update(supplierEmails).set(updates).where(eq(supplierEmails.id, id));
    return this.getSupplierEmail(id);
  }

  async deleteSupplierEmail(id: string): Promise<boolean> {
    const result = await db.delete(supplierEmails).where(eq(supplierEmails.id, id));
    const affected =
      // @ts-expect-error drizzle mysql returns ResultSetHeader
      (result?.rowsAffected ?? result?.affectedRows ?? 0) as number;
    return affected > 0;
  }

  async bulkUpsertSupplierEmails(emails: InsertSupplierEmail[]): Promise<SupplierEmail[]> {
    if (emails.length === 0) return [];

    const allSuppliers = await this.getAllSuppliers();
    // Use case-insensitive matching by storing both original and lowercase keys
    const supplierMap = new Map<string, typeof allSuppliers[0]>();
    allSuppliers.forEach(s => {
      supplierMap.set(s.name.toLowerCase(), s);
      supplierMap.set(s.name, s); // Also store original case for exact matches
    });

    const results: SupplierEmail[] = [];

    for (const emailData of emails) {
      // Find supplier by name (try both lowercase and original case)
      const supplier = supplierMap.get(emailData.supplierName.toLowerCase()) || 
                       supplierMap.get(emailData.supplierName);
      
      if (!supplier) {
        console.warn(`Supplier not found: ${emailData.supplierName}, skipping email: ${emailData.email}`);
        continue;
      }

      // Check if email already exists for this supplier
      const existing = await this.getSupplierEmailBySupplierId(supplier.id);
      
      if (existing) {
        // Update existing email
        const updated = await this.updateSupplierEmail(existing.id, {
          email: emailData.email,
          supplierName: emailData.supplierName,
        });
        if (updated) results.push(updated);
      } else {
        // Create new email
        const created = await this.createSupplierEmail({
          supplierId: supplier.id,
          email: emailData.email,
          supplierName: emailData.supplierName,
        });
        results.push(created);
      }
    }

    return results;
  }
}