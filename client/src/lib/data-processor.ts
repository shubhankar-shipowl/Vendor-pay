import type { ColumnMapping, Order, PriceEntry, Supplier, ReconciliationLog, ReportFilters } from "@shared/schema";

export async function processCSVData(buffer: Buffer, mimeType: string) {
  // Simple CSV parsing implementation
  const text = buffer.toString('utf-8');
  const lines = text.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    throw new Error('Empty file');
  }

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const data: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const row: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    data.push(row);
  }

  return { headers, data };
}

export function normalizeData(rawData: Record<string, string>[], mapping: ColumnMapping): any[] {
  return rawData.map(row => {
    const normalized: any = {};
    
    // Map columns based on mapping
    Object.entries(mapping).forEach(([key, columnName]) => {
      if (columnName && row[columnName] !== undefined) {
        normalized[key] = cleanValue(row[columnName], key);
      }
    });

    // Set defaults
    if (!normalized.qty) normalized.qty = '1';
    if (!normalized.currency) normalized.currency = 'INR';

    return normalized;
  });
}

function cleanValue(value: string, type: string): string {
  // Trim spaces
  value = value.trim();
  
  // Parse dates to yyyy-mm-dd format
  if (type.toLowerCase().includes('date') && value) {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch {
      // Keep original value if parsing fails
    }
  }
  
  // Cast numbers safely
  if (type === 'qty' && value) {
    const num = parseInt(value);
    if (!isNaN(num) && num > 0) {
      return num.toString();
    }
    return '1'; // Default to 1
  }

  return value;
}

export async function calculatePayouts(
  orders: Order[], 
  priceEntries: PriceEntry[], 
  suppliers: Supplier[], 
  pricingBasis: string = 'deliveredDate'
) {
  const payableOrders = orders.filter(order => 
    ['delivered', 'completed'].includes(order.status.toLowerCase())
  );

  const supplierMap = new Map(suppliers.map(s => [s.id, s]));
  const calculations = [];
  const missingPrices = new Set();

  for (const order of payableOrders) {
    const basisDate = pricingBasis === 'orderDate' ? order.orderDate : order.deliveredDate;
    if (!basisDate) continue;

    const supplier = supplierMap.get(order.supplierId);
    if (!supplier) continue;

    // Find applicable price entry
    const applicablePriceEntry = findApplicablePriceEntry(
      priceEntries,
      order.supplierId,
      order.productName,
      basisDate
    );

    if (!applicablePriceEntry) {
      missingPrices.add(`${supplier.name}|${order.productName}|${order.currency}`);
      continue;
    }

    const unitPrice = parseFloat(applicablePriceEntry.price);
    const lineAmount = unitPrice * order.qty;

    calculations.push({
      orderId: order.id,
      awbNo: order.awbNo,
      supplierName: supplier.name,
      productName: order.productName,
      qty: order.qty,
      unitPrice,
      lineAmount,
      currency: order.currency,
      hsn: applicablePriceEntry.hsn,
      basisDate: basisDate.toISOString().split('T')[0]
    });
  }

  // Group by supplier and currency
  const supplierSummary = new Map();
  calculations.forEach(calc => {
    const key = `${calc.supplierName}|${calc.currency}`;
    if (!supplierSummary.has(key)) {
      supplierSummary.set(key, {
        supplierName: calc.supplierName,
        currency: calc.currency,
        orderCount: 0,
        totalAmount: 0,
        orders: []
      });
    }
    
    const summary = supplierSummary.get(key);
    summary.orderCount++;
    summary.totalAmount += calc.lineAmount;
    summary.orders.push(calc);
  });

  return {
    calculations,
    supplierSummary: Array.from(supplierSummary.values()),
    missingPrices: Array.from(missingPrices).map(item => {
      const [supplierName, productName, currency] = item.split('|');
      return { supplierName, productName, currency };
    })
  };
}

function findApplicablePriceEntry(
  priceEntries: PriceEntry[],
  supplierId: string,
  productName: string,
  basisDate: Date
): PriceEntry | undefined {
  const applicableEntries = priceEntries.filter(entry => 
    entry.supplierId === supplierId &&
    entry.productName.toLowerCase() === productName.toLowerCase() &&
    entry.effectiveFrom <= basisDate &&
    (!entry.effectiveTo || entry.effectiveTo >= basisDate)
  );

  // Return the most recent one if multiple found
  return applicableEntries.sort((a, b) => 
    b.effectiveFrom.getTime() - a.effectiveFrom.getTime()
  )[0];
}

export async function generateReports(
  orders: Order[],
  priceEntries: PriceEntry[],
  suppliers: Supplier[],
  reconLogs: ReconciliationLog[],
  filters: ReportFilters
) {
  // Apply filters
  let filteredOrders = orders;
  
  if (filters.periodFrom) {
    const fromDate = new Date(filters.periodFrom);
    filteredOrders = filteredOrders.filter(order => 
      order.deliveredDate && order.deliveredDate >= fromDate
    );
  }
  
  if (filters.periodTo) {
    const toDate = new Date(filters.periodTo);
    filteredOrders = filteredOrders.filter(order => 
      order.deliveredDate && order.deliveredDate <= toDate
    );
  }
  
  if (filters.currency) {
    filteredOrders = filteredOrders.filter(order => order.currency === filters.currency);
  }
  
  if (filters.supplier) {
    const supplier = suppliers.find(s => s.name === filters.supplier);
    if (supplier) {
      filteredOrders = filteredOrders.filter(order => order.supplierId === supplier.id);
    }
  }

  // Generate different report types
  const reports = {
    supplierPayoutSummary: generateSupplierPayoutSummary(filteredOrders, suppliers),
    payoutExportSheet: generatePayoutExportSheet(filteredOrders, suppliers, priceEntries),
    cancelledOrdersReport: generateCancelledOrdersReport(orders),
    reconciliationLog: reconLogs,
    exceptionsReport: generateExceptionsReport(filteredOrders),
    lineDetails: generateLineDetails(filteredOrders, suppliers, priceEntries)
  };

  return reports;
}

function generateSupplierPayoutSummary(orders: Order[], suppliers: Supplier[]) {
  const supplierMap = new Map(suppliers.map(s => [s.id, s]));
  const summary = new Map();

  orders.forEach(order => {
    const supplier = supplierMap.get(order.supplierId);
    if (!supplier) return;

    const key = `${supplier.id}|${order.currency}`;
    if (!summary.has(key)) {
      summary.set(key, {
        supplierId: supplier.id,
        supplierName: supplier.name,
        currency: order.currency,
        totalOrders: 0,
        deliveredOrders: 0,
        rtsOrders: 0,
        totalAmount: 0
      });
    }

    const s = summary.get(key);
    s.totalOrders++;
    
    if (['delivered', 'completed'].includes(order.status.toLowerCase())) {
      s.deliveredOrders++;
      s.totalAmount += parseFloat(order.lineAmount || '0');
    } else if (['rts', 'rto', 'returned'].includes(order.status.toLowerCase())) {
      s.rtsOrders++;
    }
  });

  return Array.from(summary.values()).sort((a, b) => b.totalAmount - a.totalAmount);
}

function generatePayoutExportSheet(orders: Order[], suppliers: Supplier[], priceEntries: PriceEntry[]) {
  const supplierMap = new Map(suppliers.map(s => [s.id, s]));
  const deliveredOrders = orders.filter(order => 
    ['delivered', 'completed'].includes(order.status.toLowerCase())
  );

  return deliveredOrders.map(order => {
    const supplier = supplierMap.get(order.supplierId);
    return {
      awbNo: order.awbNo,
      supplierName: supplier?.name || 'Unknown',
      courier: order.courier || '',
      hsn: order.hsn || '',
      productName: order.productName,
      qty: order.qty,
      productPrice: order.unitPrice || 0,
      deliveredDate: order.deliveredDate?.toISOString().split('T')[0] || '',
      status: order.status
    };
  });
}

function generateCancelledOrdersReport(orders: Order[]) {
  return orders
    .filter(order => order.status.toLowerCase() === 'cancelled')
    .map(order => ({
      awbNo: order.awbNo,
      supplierName: 'Unknown', // Would need to join with supplier
      productName: order.productName,
      qty: order.qty,
      status: order.status,
      channelOrderDate: order.channelOrderDate?.toISOString().split('T')[0] || '',
      orderDate: order.orderDate?.toISOString().split('T')[0] || ''
    }));
}

function generateExceptionsReport(orders: Order[]) {
  const exceptions = [];
  
  orders.forEach((order, index) => {
    // Check for missing required fields
    if (!order.awbNo) {
      exceptions.push({
        rowIndex: index + 1,
        type: 'Missing AWB No',
        description: 'AWB Number is required',
        orderId: order.id
      });
    }
    
    if (!order.productName) {
      exceptions.push({
        rowIndex: index + 1,
        type: 'Missing Product Name',
        description: 'Product Name is required',
        orderId: order.id
      });
    }
    
    if (order.qty <= 0) {
      exceptions.push({
        rowIndex: index + 1,
        type: 'Invalid Quantity',
        description: 'Quantity must be greater than 0',
        orderId: order.id
      });
    }
  });

  return exceptions;
}

function generateLineDetails(orders: Order[], suppliers: Supplier[], priceEntries: PriceEntry[]) {
  const supplierMap = new Map(suppliers.map(s => [s.id, s]));
  
  return orders.map(order => {
    const supplier = supplierMap.get(order.supplierId);
    return {
      ...order,
      supplierName: supplier?.name || 'Unknown',
      basisDate: order.deliveredDate?.toISOString().split('T')[0] || order.orderDate?.toISOString().split('T')[0] || ''
    };
  });
}
