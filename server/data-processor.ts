import * as XLSX from 'xlsx';
import csv from 'csv-parser';
import { Readable } from 'stream';

interface ProcessedData {
  headers: string[];
  data: Record<string, string>[];
}

export async function processCSVData(
  buffer: Buffer,
  mimeType: string,
  filename?: string,
): Promise<ProcessedData> {
  console.log(
    `📂 Processing file: ${mimeType}, size: ${buffer.length} bytes, filename: ${filename}`,
  );

  try {
    // Determine file type by MIME type and/or file extension
    const fileExtension = filename?.toLowerCase().split('.').pop() || '';

    if (
      mimeType.includes('csv') ||
      mimeType.includes('text') ||
      fileExtension === 'csv' ||
      (mimeType === 'application/octet-stream' && fileExtension === 'csv')
    ) {
      return await processCSVFile(buffer);
    } else if (
      mimeType.includes('excel') ||
      mimeType.includes('spreadsheet') ||
      mimeType.includes('openxmlformats') ||
      fileExtension === 'xlsx' ||
      fileExtension === 'xls'
    ) {
      return await processExcelFile(buffer);
    } else {
      throw new Error(
        `Unsupported file type: ${mimeType} (extension: ${fileExtension})`,
      );
    }
  } catch (error) {
    console.error('File processing error:', error);
    throw new Error(
      `Failed to process file: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    );
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
        Object.keys(data).forEach((key) => {
          let value = data[key] || '';
          // Special handling for AWB/tracking numbers to preserve precision
          if (
            key.toLowerCase().includes('waybill') ||
            key.toLowerCase().includes('awb') ||
            key.toLowerCase().includes('tracking')
          ) {
            // Keep original string format to preserve large numbers
            cleanData[key] = String(value).trim();
          } else {
            cleanData[key] = String(value).trim();
          }
        });
        results.push(cleanData);
      })
      .on('end', () => {
        console.log(
          `✅ CSV processing complete: ${headers.length} columns, ${results.length} rows`,
        );
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
    // Read workbook with raw: false to preserve cell formatting as text
    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellText: false,
      cellFormula: false,
      cellHTML: false,
      cellDates: true,
      dense: false,
      sheetStubs: false,
      raw: false, // CRITICAL: Use formatted values, not raw numbers
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
    console.log(
      `📊 Excel Range: ${worksheet['!ref']}, Rows: ${range.e.r + 1}, Columns: ${
        range.e.c + 1
      }`,
    );

    // Extract headers from first row using raw cell access
    const headers: string[] = [];
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
      const cell = worksheet[cellAddress];
      const header = cell ? String(cell.v || cell.w || '').trim() : '';
      headers.push(header || `Column_${col + 1}`);
    }

    console.log(`📋 Headers extracted: ${headers.length}`);
    console.log(`📝 Headers:`, headers.slice(0, 10));

    // Process data rows using raw cell access to preserve precision
    const processedData: Record<string, string>[] = [];

    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      const rowData: Record<string, string> = {};
      let hasData = false;

      headers.forEach((header, colIndex) => {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: colIndex });
        const cell = worksheet[cellAddress];

        let cellValue = '';

        if (cell) {
          // Check if this is a tracking/AWB/order ID column
          const isTrackingColumn =
            header.toLowerCase().includes('waybill') ||
            header.toLowerCase().includes('awb') ||
            header.toLowerCase().includes('tracking') ||
            header.toLowerCase().includes('orderid');

          if (isTrackingColumn && cell.t === 'n') {
            // For numeric cells in tracking columns, use the raw value as string
            // to preserve full precision
            cellValue = String(cell.v);

            // If the number is in scientific notation, convert it properly
            if (cellValue.includes('e') || cellValue.includes('E')) {
              const num = cell.v;
              // Convert to fixed-point notation without decimals
              cellValue = num.toFixed(0);
            }
          } else if (cell.w) {
            // Use formatted value (w) if available
            cellValue = String(cell.w).trim();
          } else if (cell.v !== undefined && cell.v !== null) {
            // Otherwise use raw value
            cellValue = String(cell.v).trim();
          }

          if (cellValue) {
            hasData = true;
          }
        }

        rowData[header] = cellValue;
      });

      // Only add row if it has some data
      if (hasData) {
        processedData.push(rowData);
      }
    }

    console.log(
      `✅ Excel processing complete: ${headers.length} columns, ${processedData.length} data rows`,
    );
    console.log(
      `🔍 Sample data:`,
      processedData[0] ? Object.keys(processedData[0]).slice(0, 5) : 'No data',
    );

    return {
      headers,
      data: processedData,
    };
  } catch (error) {
    console.error('❌ Excel processing failed:', error);
    throw new Error(
      `Excel processing failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    );
  }
}

// Data normalization function
export function normalizeData(
  rawData: Record<string, string>[],
  mapping: any,
): any[] {
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
      channelOrderDate: row[mapping.channelOrderDate]
        ? new Date(row[mapping.channelOrderDate])
        : null,
      orderDate: row[mapping.orderDate]
        ? new Date(row[mapping.orderDate])
        : null,
      deliveredDate: row[mapping.deliveredDate]
        ? new Date(row[mapping.deliveredDate])
        : null,
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
      previousStatus: null,
    };

    return normalizedRow;
  });

  console.log(`✅ Normalized ${normalized.length} records`);
  return normalized;
}

// Payout calculation function
export function calculatePayouts(
  data: any[],
  dateFilter?: { start: Date; end: Date },
) {
  console.log(`🧮 Calculating payouts for ${data.length} records...`);

  const payouts = new Map<
    string,
    {
      supplier: string;
      totalOrders: number;
      deliveredOrders: number;
      totalAmount: number;
      orders: any[];
    }
  >();

  data.forEach((order) => {
    // Filter by date if provided
    if (dateFilter && order.deliveredDate) {
      if (
        order.deliveredDate < dateFilter.start ||
        order.deliveredDate > dateFilter.end
      ) {
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
        orders: [],
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
    totalDeliveredOrders: payouts.reduce(
      (sum, p) => sum + p.deliveredOrders,
      0,
    ),
    totalPayoutAmount: payouts.reduce((sum, p) => sum + p.totalAmount, 0),
  };

  const detailed = payouts.map((payout) => ({
    supplier: payout.supplier,
    orders: payout.totalOrders,
    delivered: payout.deliveredOrders,
    amount: payout.totalAmount,
    averageOrderValue:
      payout.totalOrders > 0 ? payout.totalAmount / payout.totalOrders : 0,
  }));

  console.log(
    `✅ Generated reports: ${summary.totalSuppliers} suppliers, ${summary.totalOrders} orders`,
  );

  return {
    summary,
    detailed,
    raw: payouts,
  };
}

// Export for use in other modules
export { ProcessedData };
