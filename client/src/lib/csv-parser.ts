export interface ParsedCSVData {
  headers: string[];
  data: Record<string, string>[];
}

export async function parseCSV(file: File): Promise<ParsedCSVData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
          throw new Error('Empty CSV file');
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

        resolve({ headers, data });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export async function parseExcel(file: File): Promise<ParsedCSVData> {
  // For Excel files, we'll need to use a library like xlsx
  // For now, return a simple implementation
  throw new Error('Excel parsing not implemented yet - please use CSV files');
}

export function detectColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const headerMap: Record<string, string[]> = {
    supplierName: ['supplier_name', 'supplier', 'vendor', 'pickup_warehouse', 'pickup warehouse'],
    awbNo: ['awb_no', 'awb', 'tracking_no', 'tracking no', 'airway_bill', 'airway bill'],
    productName: ['product_name', 'product', 'item', 'item_name', 'sku_name', 'sku name'],
    status: ['status', 'order_status', 'delivery_status'],
    courier: ['courier', 'carrier', 'logistics_partner', 'logistics partner'],
    orderAccount: ['order_account', 'order account', 'account', 'email', 'customer_email', 'customer email'],
    qty: ['qty', 'quantity'],
    currency: ['currency'],
    channelOrderDate: ['channel_order_date', 'channel order date'],
    orderDate: ['order_date', 'order date'],
    deliveredDate: ['delivered_date', 'delivered date', 'delivery_date', 'delivery date'],
    rtsDate: ['rts_date', 'rts date']
  };

  for (const [key, synonyms] of Object.entries(headerMap)) {
    for (const header of headers) {
      const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
      if (synonyms.some(synonym => normalizedHeader.includes(synonym.replace(/[^a-z0-9]/g, '_')))) {
        mapping[key] = header;
        break;
      }
    }
  }

  return mapping;
}
