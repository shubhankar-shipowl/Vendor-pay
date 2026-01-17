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
  throw new Error('Excel parsing not implemented yet - please use CSV files');
}

// Parcel X column mapping detection - exact mappings based on actual Parcel X columns
export function detectColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  
  // Parcel X specific column mappings
  const parcelXHeaderMap: Record<string, string[]> = {
    supplierName: ['pickup warehouse', 'pickup_warehouse'],
    awbNo: ['waybill num', 'waybill_num', 'awb no', 'awb_no', 'awb'],
    productName: ['product name', 'product_name'],
    status: ['status'],
    orderAccount: ['order account', 'order_account'],
    courier: ['fulfilled by', 'fulfilled_by', 'express', 'courier', 'mode'],
    qty: ['product qty', 'product_qty', 'qty', 'quantity'],
    channelOrderDate: ['channel order date', 'channel_order_date'],
    orderDate: ['pre generated order date', 'pre_generated_order_date', 'order date', 'order_date'],
    deliveredDate: ['delivered date', 'delivered_date', 'delivery date', 'delivery_date'],
    rtsDate: ['rts date', 'rts_date'],
    currency: ['currency']
  };

  for (const [key, synonyms] of Object.entries(parcelXHeaderMap)) {
    for (const header of headers) {
      const normalizedHeader = header.toLowerCase().trim();
      if (synonyms.some(synonym => normalizedHeader === synonym || normalizedHeader.includes(synonym))) {
        mapping[key] = header;
        break;
      }
    }
  }

  return mapping;
}

// Nimbus-specific column mapping detection
export function detectNimbusColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  
  // Nimbus specific column mappings
  const nimbusHeaderMap: Record<string, string[]> = {
    supplierName: ['warehouse name', 'warehouse_name', 'warehouse'],
    awbNo: ['awb number', 'awb_number', 'awb no', 'awb_no', 'awb'],
    productName: ['product(1)', 'product 1', 'product_1', 'product1', 'product'],
    status: ['tracking status', 'tracking_status', 'status'],
    orderAccount: ['store name', 'store_name', 'store'],
    courier: ['courier', 'courier name', 'courier_name'],
    qty: ['qty', 'quantity'],
    channelOrderDate: ['order date', 'order_date'],
    orderDate: ['shipment date', 'shipment_date'],
    deliveredDate: ['delivery date', 'delivery_date', 'delivered date', 'delivered_date'],
    rtsDate: ['rto delivered date', 'rto_delivered_date', 'rto date', 'rto_date'],
    currency: ['currency']
  };

  for (const [key, synonyms] of Object.entries(nimbusHeaderMap)) {
    for (const header of headers) {
      const normalizedHeader = header.toLowerCase().trim();
      if (synonyms.some(synonym => normalizedHeader === synonym || normalizedHeader.includes(synonym))) {
        mapping[key] = header;
        break;
      }
    }
  }

  return mapping;
}

// Generic column mapping that works for both sources
export function detectColumnMappingBySource(headers: string[], source: 'parcelx' | 'nimbus'): Record<string, string> {
  if (source === 'nimbus') {
    return detectNimbusColumnMapping(headers);
  }
  return detectColumnMapping(headers);
}
