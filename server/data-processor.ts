import * as XLSX from 'xlsx';
import csv from 'csv-parser';
import { Readable } from 'stream';

interface ProcessedData {
  headers: string[];
  data: Record<string, string>[];
}

export async function processCSVData(buffer: Buffer, mimeType: string, filename?: string): Promise<ProcessedData> {
  console.log(`📂 Processing file: ${mimeType}, size: ${buffer.length} bytes, filename: ${filename}`);
  
  try {
    // Determine file type by MIME type and/or file extension
    const fileExtension = filename?.toLowerCase().split('.').pop() || '';
    
    if (mimeType.includes('csv') || mimeType.includes('text') || 
        fileExtension === 'csv' || 
        (mimeType === 'application/octet-stream' && fileExtension === 'csv')) {
      return await processCSVFile(buffer);
    } else if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || 
               mimeType.includes('openxmlformats') ||
               fileExtension === 'xlsx' || fileExtension === 'xls') {
      return await processExcelFile(buffer);
    } else {
      throw new Error(`Unsupported file type: ${mimeType} (extension: ${fileExtension})`);
    }
  } catch (error) {
    console.error('File processing error:', error);
    throw new Error(`Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function processCSVFile(buffer: Buffer): Promise<ProcessedData> {
  console.log('Processing CSV file...');
  
  return new Promise((resolve, reject) => {
    const results: Record<string, string>[] = [];
    let headers: string[] = [];
    
    const stream = Readable.from(buffer.toString());
    
    stream
      .pipe(csv())
      .on('headers', (headerList: string[]) => {
        headers = headerList;
        console.log(`📋 CSV Headers detected: ${headers.length}`);
      })
      .on('data', (data: Record<string, string>) => {
        // Ensure all values are strings and handle AWB numbers properly
        const cleanData: Record<string, string> = {};
        Object.keys(data).forEach(key => {
          let value = data[key] || '';
          // Special handling for AWB/tracking numbers to preserve precision
          if (key.toLowerCase().includes('waybill') || 
              key.toLowerCase().includes('awb') || 
              key.toLowerCase().includes('tracking')) {
            // Keep original string format to preserve large numbers
            cleanData[key] = String(value).trim();
          } else {
            cleanData[key] = String(value).trim();
          }
        });
        results.push(cleanData);
      })
      .on('end', () => {
        console.log(`✅ CSV processing complete: ${headers.length} columns, ${results.length} rows`);
        resolve({ headers, data: results });
      })
      .on('error', (error) => {
        console.error('CSV processing error:', error);
        reject(error);
      });
  });
}

async function processExcelFile(buffer: Buffer): Promise<ProcessedData> {
  console.log('🔄 Processing Excel file...');
  
  try {
    // Read workbook with optimal settings for header and data extraction
    const workbook = XLSX.read(buffer, { 
      type: 'buffer',
      cellText: true,      // Parse text values
      cellFormula: false,  // Don't parse formulas
      cellHTML: false,     // Don't parse HTML
      cellDates: true,     // Parse dates
      dense: false,        // Use standard format for better cell access
      sheetStubs: false    // Don't include empty cells as stubs
    });

    // Get the first worksheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('No worksheets found in Excel file');
    }

    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      throw new Error('Failed to read worksheet');
    }

    // Get worksheet range
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    console.log(`📊 Excel Range: ${worksheet['!ref']}, Rows: ${range.e.r + 1}, Columns: ${range.e.c + 1}`);

    // Extract data using XLSX's built-in JSON converter
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,           // Return array of arrays (first array becomes headers)
      defval: '',          // Default value for empty cells
      blankrows: false,    // Skip blank rows
      raw: false,          // Don't use raw values, use formatted values
      dateNF: 'yyyy-mm-dd' // Date format
    }) as string[][];

    if (jsonData.length === 0) {
      throw new Error('No data found in Excel file');
    }

    // Extract headers from first row
    const rawHeaders = jsonData[0] || [];
    const headers = rawHeaders.map((h, index) => {
      const header = h ? String(h).trim() : '';
      return header || `Column_${index + 1}`;
    });

    console.log(`📋 Headers extracted: ${headers.length}`);
    console.log(`📝 Headers:`, headers.slice(0, 10));

    // Process data rows (skip header row)
    const dataRows = jsonData.slice(1);
    const processedData: Record<string, string>[] = [];

    dataRows.forEach((row, rowIndex) => {
      const rowData: Record<string, string> = {};
      
      headers.forEach((header, colIndex) => {
        let cellValue = row[colIndex] || '';
        
        // Special handling for AWB/tracking numbers to preserve large numbers
        if (header.toLowerCase().includes('waybill') || 
            header.toLowerCase().includes('awb') || 
            header.toLowerCase().includes('tracking') ||
            header.toLowerCase().includes('orderid')) {
          
          // Preserve original format for tracking numbers
          if (cellValue && typeof cellValue === 'number' && cellValue >= 1e10) {
            // Large number - preserve as string to avoid scientific notation
            cellValue = String(cellValue);
          }
        }
        
        rowData[header] = String(cellValue).trim();
      });
      
      processedData.push(rowData);
    });

    console.log(`✅ Excel processing complete: ${headers.length} columns, ${processedData.length} data rows`);
    console.log(`🔍 Sample data:`, processedData[0] ? Object.keys(processedData[0]).slice(0, 5) : 'No data');

    return { 
      headers, 
      data: processedData 
    };

  } catch (error) {
    console.error('❌ Excel processing failed:', error);
    throw new Error(`Excel processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Data normalization function
export function normalizeData(rawData: Record<string, string>[], mapping: any): any[] {
  console.log(`🔄 Normalizing ${rawData.length} records with mapping...`);
  
  const normalized = rawData.map((row, index) => {
    // Map the data according to column mapping
    const normalizedRow = {
      supplierName: row[mapping.supplierName] || '',
      awbNo: row[mapping.awbNo] || '',
      productName: row[mapping.productName] || '',
      status: row[mapping.status] || '',
      courier: row[mapping.courier] || null,
      orderAccount: row[mapping.orderAccount] || null,
      qty: row[mapping.qty] ? parseInt(row[mapping.qty]) || 1 : 1,
      currency: row[mapping.currency] || 'INR',
      channelOrderDate: row[mapping.channelOrderDate] ? new Date(row[mapping.channelOrderDate]) : null,
      orderDate: row[mapping.orderDate] ? new Date(row[mapping.orderDate]) : null,
      deliveredDate: row[mapping.deliveredDate] ? new Date(row[mapping.deliveredDate]) : null,
      rtsDate: row[mapping.rtsDate] ? new Date(row[mapping.rtsDate]) : null,
      orderAmount: row[mapping.orderAmount] || '0',
      totalAmount: row[mapping.totalAmount] || '0',
      codAmount: row[mapping.codAmount] || '0',
      weight: row[mapping.weight] || '0',
      dimensions: row[mapping.dimensions] || '',
      pincode: row[mapping.pincode] || '',
      city: row[mapping.city] || '',
      state: row[mapping.state] || '',
      consigneeName: row[mapping.consigneeName] || '',
      consigneeContact: row[mapping.consigneeContact] || '',
      address: row[mapping.address] || '',
      previousStatus: null
    };
    
    return normalizedRow;
  });
  
  console.log(`✅ Normalized ${normalized.length} records`);
  return normalized;
}

// Payout calculation function
export function calculatePayouts(data: any[], dateFilter?: { start: Date; end: Date }) {
  console.log(`🧮 Calculating payouts for ${data.length} records...`);
  
  const payouts = new Map<string, {
    supplier: string;
    totalOrders: number;
    deliveredOrders: number;
    totalAmount: number;
    orders: any[];
  }>();
  
  data.forEach(order => {
    // Filter by date if provided
    if (dateFilter && order.deliveredDate) {
      if (order.deliveredDate < dateFilter.start || order.deliveredDate > dateFilter.end) {
        return;
      }
    }
    
    // Only include delivered orders for payout
    if (!order.status || !order.status.toLowerCase().includes('delivered')) {
      return;
    }
    
    const supplier = order.supplierName || 'Unknown';
    
    if (!payouts.has(supplier)) {
      payouts.set(supplier, {
        supplier,
        totalOrders: 0,
        deliveredOrders: 0,
        totalAmount: 0,
        orders: []
      });
    }
    
    const payout = payouts.get(supplier)!;
    payout.totalOrders++;
    payout.deliveredOrders++;
    payout.totalAmount += parseFloat(order.totalAmount || '0');
    payout.orders.push(order);
  });
  
  console.log(`✅ Calculated payouts for ${payouts.size} suppliers`);
  return Array.from(payouts.values());
}

// Report generation function
export function generateReports(payouts: any[]) {
  console.log(`📊 Generating reports for ${payouts.length} suppliers...`);
  
  const summary = {
    totalSuppliers: payouts.length,
    totalOrders: payouts.reduce((sum, p) => sum + p.totalOrders, 0),
    totalDeliveredOrders: payouts.reduce((sum, p) => sum + p.deliveredOrders, 0),
    totalPayoutAmount: payouts.reduce((sum, p) => sum + p.totalAmount, 0)
  };
  
  const detailed = payouts.map(payout => ({
    supplier: payout.supplier,
    orders: payout.totalOrders,
    delivered: payout.deliveredOrders,
    amount: payout.totalAmount,
    averageOrderValue: payout.totalOrders > 0 ? payout.totalAmount / payout.totalOrders : 0
  }));
  
  console.log(`✅ Generated reports: ${summary.totalSuppliers} suppliers, ${summary.totalOrders} orders`);
  
  return {
    summary,
    detailed,
    raw: payouts
  };
}

// Export for use in other modules
export { ProcessedData };