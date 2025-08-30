import { type User, type InsertUser, type UploadedFile, type InsertUploadedFile, type Supplier, type InsertSupplier, type PriceEntry, type InsertPriceEntry, type Order, type InsertOrder, type ReconciliationLog, type InsertReconciliationLog } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // File methods
  createUploadedFile(file: InsertUploadedFile): Promise<UploadedFile>;
  getUploadedFile(id: string): Promise<UploadedFile | undefined>;
  updateUploadedFile(id: string, updates: Partial<UploadedFile>): Promise<UploadedFile | undefined>;
  getAllUploadedFiles(): Promise<UploadedFile[]>;
  
  // Supplier methods
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  getSupplier(id: string): Promise<Supplier | undefined>;
  getSupplierByName(name: string): Promise<Supplier | undefined>;
  getAllSuppliers(): Promise<Supplier[]>;
  updateSupplierOrderAccount(id: string, orderAccount: string | null): Promise<Supplier | undefined>;
  
  // Price entry methods
  createPriceEntry(priceEntry: InsertPriceEntry): Promise<PriceEntry>;
  getPriceEntry(id: string): Promise<PriceEntry | undefined>;
  getAllPriceEntries(): Promise<PriceEntry[]>;
  getPriceEntriesBySupplier(supplierId: string): Promise<PriceEntry[]>;
  updatePriceEntry(id: string, updates: Partial<PriceEntry>): Promise<PriceEntry | undefined>;
  deletePriceEntry(id: string): Promise<boolean>;
  
  // Order methods
  createOrder(order: InsertOrder): Promise<Order>;
  createOrders(orders: InsertOrder[]): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrderByAwbNo(awbNo: string): Promise<Order | undefined>;
  getAllOrders(): Promise<Order[]>;
  getOrdersByFileId(fileId: string): Promise<Order[]>;
  updateOrder(id: string, updates: Partial<Order>): Promise<Order | undefined>;
  clearAllOrders(): Promise<void>;
  
  // Reconciliation log methods
  createReconciliationLog(log: InsertReconciliationLog): Promise<ReconciliationLog>;
  getAllReconciliationLogs(): Promise<ReconciliationLog[]>;
  getReconciliationLogsByAwbNo(awbNo: string): Promise<ReconciliationLog[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private uploadedFiles: Map<string, UploadedFile>;
  private suppliers: Map<string, Supplier>;
  private priceEntries: Map<string, PriceEntry>;
  private orders: Map<string, Order>;
  private reconciliationLogs: Map<string, ReconciliationLog>;

  constructor() {
    this.users = new Map();
    this.uploadedFiles = new Map();
    this.suppliers = new Map();
    this.priceEntries = new Map();
    this.orders = new Map();
    this.reconciliationLogs = new Map();
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // File methods
  async createUploadedFile(file: InsertUploadedFile): Promise<UploadedFile> {
    const id = randomUUID();
    const uploadedFile: UploadedFile = { 
      ...file, 
      id,
      uploadedAt: new Date()
    };
    this.uploadedFiles.set(id, uploadedFile);
    return uploadedFile;
  }

  async getUploadedFile(id: string): Promise<UploadedFile | undefined> {
    return this.uploadedFiles.get(id);
  }

  async updateUploadedFile(id: string, updates: Partial<UploadedFile>): Promise<UploadedFile | undefined> {
    const existing = this.uploadedFiles.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.uploadedFiles.set(id, updated);
    return updated;
  }

  async getAllUploadedFiles(): Promise<UploadedFile[]> {
    return Array.from(this.uploadedFiles.values());
  }

  // Supplier methods
  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const id = randomUUID();
    const newSupplier: Supplier = { 
      ...supplier, 
      id,
      createdAt: new Date()
    };
    this.suppliers.set(id, newSupplier);
    return newSupplier;
  }

  async getSupplier(id: string): Promise<Supplier | undefined> {
    return this.suppliers.get(id);
  }

  async getSupplierByName(name: string): Promise<Supplier | undefined> {
    return Array.from(this.suppliers.values()).find(s => s.name === name);
  }

  async getAllSuppliers(): Promise<Supplier[]> {
    return Array.from(this.suppliers.values());
  }

  async updateSupplierOrderAccount(id: string, orderAccount: string | null): Promise<Supplier | undefined> {
    const supplier = this.suppliers.get(id);
    if (!supplier) return undefined;
    
    const updated = { ...supplier, orderAccount };
    this.suppliers.set(id, updated);
    return updated;
  }

  // Price entry methods
  async createPriceEntry(priceEntry: InsertPriceEntry): Promise<PriceEntry> {
    const id = randomUUID();
    const newPriceEntry: PriceEntry = { 
      ...priceEntry, 
      currency: priceEntry.currency || "INR",
      supplierId: priceEntry.supplierId || null,
      effectiveTo: priceEntry.effectiveTo || null,
      id,
      createdAt: new Date()
    };
    this.priceEntries.set(id, newPriceEntry);
    return newPriceEntry;
  }

  async getPriceEntry(id: string): Promise<PriceEntry | undefined> {
    return this.priceEntries.get(id);
  }

  async getAllPriceEntries(): Promise<PriceEntry[]> {
    return Array.from(this.priceEntries.values());
  }

  async getPriceEntriesBySupplier(supplierId: string): Promise<PriceEntry[]> {
    return Array.from(this.priceEntries.values()).filter(pe => pe.supplierId === supplierId);
  }

  async updatePriceEntry(id: string, updates: Partial<PriceEntry>): Promise<PriceEntry | undefined> {
    const existing = this.priceEntries.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.priceEntries.set(id, updated);
    return updated;
  }

  async deletePriceEntry(id: string): Promise<boolean> {
    return this.priceEntries.delete(id);
  }

  // Order methods
  async createOrder(order: InsertOrder): Promise<Order> {
    const id = randomUUID();
    const newOrder: Order = { 
      ...order,
      fileId: order.fileId || null,
      id,
      createdAt: new Date()
    };
    this.orders.set(id, newOrder);
    return newOrder;
  }

  async createOrders(orders: InsertOrder[]): Promise<Order[]> {
    const createdOrders: Order[] = [];
    for (const order of orders) {
      const created = await this.createOrder(order);
      createdOrders.push(created);
    }
    return createdOrders;
  }

  async getOrder(id: string): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getOrderByAwbNo(awbNo: string): Promise<Order | undefined> {
    return Array.from(this.orders.values()).find(o => o.awbNo === awbNo);
  }

  async getAllOrders(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  async getOrdersByFileId(fileId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(o => o.fileId === fileId);
  }

  async updateOrder(id: string, updates: Partial<Order>): Promise<Order | undefined> {
    const existing = this.orders.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.orders.set(id, updated);
    return updated;
  }

  async clearAllOrders(): Promise<void> {
    this.orders.clear();
  }

  // Reconciliation log methods
  async createReconciliationLog(log: InsertReconciliationLog): Promise<ReconciliationLog> {
    const id = randomUUID();
    const newLog: ReconciliationLog = { 
      ...log,
      previousStatus: log.previousStatus || null,
      orderId: log.orderId || null,
      note: log.note || null,
      id,
      timestamp: new Date()
    };
    this.reconciliationLogs.set(id, newLog);
    return newLog;
  }

  async getAllReconciliationLogs(): Promise<ReconciliationLog[]> {
    return Array.from(this.reconciliationLogs.values());
  }

  async getReconciliationLogsByAwbNo(awbNo: string): Promise<ReconciliationLog[]> {
    return Array.from(this.reconciliationLogs.values()).filter(log => log.awbNo === awbNo);
  }
}

// Storage instance is now created in routes.ts with DrizzleStorage
// export const storage = new MemStorage();
