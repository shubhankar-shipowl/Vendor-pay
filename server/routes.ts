import type { Express } from 'express';
import { createServer, type Server } from 'http';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { DrizzleStorage } from './drizzle-storage';
import {
  columnMappingSchema,
  insertPriceEntrySchema,
  reportFiltersSchema,
} from '@shared/schema';
import {
  processCSVData,
  normalizeData,
  calculatePayouts,
  generateReports,
} from './data-processor';

// Global type for temporary file storage
declare global {
  var tempFileData: Map<string, Record<string, string>[]> | undefined;
  var tempFileHeaders: Map<string, string[]> | undefined;
  var tempFileMetadata: Map<string, any> | undefined;
}

// Helper function to generate supplier product ID
function generateSupplierProductId(
  supplierName: string,
  productName: string,
): string {
  // Simple concatenation as per user requirement
  return `${supplierName}${productName}`;
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/csv',
      'text/plain', // Some systems send CSV as text/plain
      'application/octet-stream', // Generic binary - check extension
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    // Also check file extension as backup
    const fileExtension = file.originalname?.toLowerCase().split('.').pop();
    const allowedExtensions = ['csv', 'xls', 'xlsx'];

    if (
      allowedTypes.includes(file.mimetype) ||
      allowedExtensions.includes(fileExtension || '')
    ) {
      cb(null, true);
    } else {
      console.log(
        `❌ File rejected: ${file.originalname}, MIME: ${file.mimetype}, Extension: ${fileExtension}`,
      );
      cb(
        new Error(
          `Only CSV and Excel files are allowed. Got: ${file.mimetype}`,
        ),
      );
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  const storage = new DrizzleStorage();

  // GST Portal API integration for fetching company details
  app.get('/api/gst-details/:gstin', async (req, res) => {
    try {
      const { gstin } = req.params;

      if (!gstin || gstin.length !== 15) {
        return res.status(400).json({ error: 'Invalid GSTIN format' });
      }

      // Using a public GST API service (you can replace with preferred provider)
      const gstApiUrl = `https://sheet.gstincheck.co.in/check/${gstin}`;

      const response = await fetch(gstApiUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        // Fallback to basic state detection if API fails
        const stateCodeMap: { [key: string]: string } = {
          '01': 'Jammu and Kashmir',
          '02': 'Himachal Pradesh',
          '03': 'Punjab',
          '04': 'Chandigarh',
          '05': 'Uttarakhand',
          '06': 'Haryana',
          '07': 'Delhi',
          '08': 'Rajasthan',
          '09': 'Uttar Pradesh',
          '10': 'Bihar',
          '11': 'Sikkim',
          '12': 'Arunachal Pradesh',
          '13': 'Nagaland',
          '14': 'Manipur',
          '15': 'Mizoram',
          '16': 'Tripura',
          '17': 'Meghalaya',
          '18': 'Assam',
          '19': 'West Bengal',
          '20': 'Jharkhand',
          '21': 'Odisha',
          '22': 'Chhattisgarh',
          '23': 'Madhya Pradesh',
          '24': 'Gujarat',
          '25': 'Daman and Diu',
          '26': 'Dadra and Nagar Haveli',
          '27': 'Maharashtra',
          '28': 'Andhra Pradesh',
          '29': 'Karnataka',
          '30': 'Goa',
          '31': 'Lakshadweep',
          '32': 'Kerala',
          '33': 'Tamil Nadu',
          '34': 'Puducherry',
          '35': 'Andaman and Nicobar Islands',
          '36': 'Telangana',
          '37': 'Andhra Pradesh',
          '38': 'Ladakh',
        };

        const stateCode = gstin.substring(0, 2);
        const placeOfSupply = stateCodeMap[stateCode] || '';

        return res.json({
          gstin,
          tradeName: '',
          legalName: '',
          address: '',
          placeOfSupply,
          status: 'Active',
          source: 'fallback',
        });
      }

      const data = await response.json();

      // Transform the API response to our expected format
      const gstDetails = {
        gstin: gstin,
        tradeName: data.data?.tradeNam || data.tradeName || '',
        legalName: data.data?.lgnm || data.legalName || '',
        address: data.data?.pradr?.addr?.bno
          ? `${data.data.pradr.addr.bno || ''} ${
              data.data.pradr.addr.st || ''
            } ${data.data.pradr.addr.loc || ''} ${
              data.data.pradr.addr.dst || ''
            } ${data.data.pradr.addr.stcd || ''}`.trim()
          : data.address || '',
        placeOfSupply: data.data?.pradr?.addr?.stcd || data.state || '',
        status: data.data?.sts || data.status || 'Active',
        source: 'api',
      };

      console.log(`✅ GST Details fetched for ${gstin}:`, gstDetails);
      res.json(gstDetails);
    } catch (error) {
      console.error('GST API error:', error);

      // Fallback response with basic state detection
      const stateCodeMap: { [key: string]: string } = {
        '01': 'Jammu and Kashmir',
        '02': 'Himachal Pradesh',
        '03': 'Punjab',
        '04': 'Chandigarh',
        '05': 'Uttarakhand',
        '06': 'Haryana',
        '07': 'Delhi',
        '08': 'Rajasthan',
        '09': 'Uttar Pradesh',
        '10': 'Bihar',
        '11': 'Sikkim',
        '12': 'Arunachal Pradesh',
        '13': 'Nagaland',
        '14': 'Manipur',
        '15': 'Mizoram',
        '16': 'Tripura',
        '17': 'Meghalaya',
        '18': 'Assam',
        '19': 'West Bengal',
        '20': 'Jharkhand',
        '21': 'Odisha',
        '22': 'Chhattisgarh',
        '23': 'Madhya Pradesh',
        '24': 'Gujarat',
        '25': 'Daman and Diu',
        '26': 'Dadra and Nagar Haveli',
        '27': 'Maharashtra',
        '28': 'Andhra Pradesh',
        '29': 'Karnataka',
        '30': 'Goa',
        '31': 'Lakshadweep',
        '32': 'Kerala',
        '33': 'Tamil Nadu',
        '34': 'Puducherry',
        '35': 'Andaman and Nicobar Islands',
        '36': 'Telangana',
        '37': 'Andhra Pradesh',
        '38': 'Ladakh',
      };

      const stateCode = req.params.gstin?.substring(0, 2) || '';
      const placeOfSupply = stateCodeMap[stateCode] || '';

      res.json({
        gstin: req.params.gstin,
        tradeName: '',
        legalName: '',
        address: '',
        placeOfSupply,
        status: 'Unknown',
        source: 'fallback',
        error: 'Failed to fetch from GST portal',
      });
    }
  });

  // Upload GST data for suppliers
  app.post('/api/upload-gst-data', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      console.log(`📄 Processing GST data file: ${req.file.originalname}`);

      let data: any[][] = [];
      const fileExtension = req.file.originalname
        .toLowerCase()
        .split('.')
        .pop();

      // Parse Excel file
      if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
      }
      // Parse CSV file
      else if (fileExtension === 'csv') {
        const csvText = req.file.buffer.toString('utf8');
        const lines = csvText.split('\n').filter((line) => line.trim());
        data = lines.map((line) => {
          // Simple CSV parsing (handles basic cases)
          const values = [];
          let current = '';
          let inQuotes = false;

          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim());
          return values;
        });
      } else {
        return res.status(400).json({ error: 'Unsupported file format' });
      }

      if (data.length < 2) {
        return res
          .status(400)
          .json({ error: 'File must contain header row and data' });
      }

      const headers = data[0].map(
        (h: string) => h?.toLowerCase()?.trim() || '',
      );
      const dataRows = data.slice(1);

      // Find column indices
      const gstinIndex = headers.findIndex(
        (h: string) =>
          h.includes('gstin') || h.includes('gst') || h.includes('tin'),
      );
      const tradeNameIndex = headers.findIndex(
        (h: string) =>
          h.includes('trade') || h.includes('company') || h.includes('name'),
      );
      const addressIndex = headers.findIndex(
        (h: string) => h.includes('address') || h.includes('addr'),
      );
      const placeOfSupplyIndex = headers.findIndex(
        (h: string) =>
          h.includes('place') || h.includes('state') || h.includes('supply'),
      );

      if (gstinIndex === -1) {
        return res.status(400).json({
          error:
            'GSTIN column not found. Expected columns: GSTIN, Trade Name, Address',
        });
      }

      let updatedCount = 0;

      // Process each row
      for (const row of dataRows) {
        const gstin = row[gstinIndex]?.toString()?.trim();
        const tradeName = row[tradeNameIndex]?.toString()?.trim() || '';
        const address = row[addressIndex]?.toString()?.trim() || '';
        const placeOfSupply = row[placeOfSupplyIndex]?.toString()?.trim() || '';

        if (!gstin || gstin.length !== 15) continue;

        // Find supplier by name (assuming first word of trade name matches supplier name)
        const supplierName = tradeName.split(' ')[0];
        const suppliers = await storage.getAllSuppliers();
        const matchingSupplier = suppliers.find(
          (s: any) =>
            s.name.toLowerCase().includes(supplierName.toLowerCase()) ||
            supplierName.toLowerCase().includes(s.name.toLowerCase()),
        );

        if (matchingSupplier) {
          // Update supplier with GST data
          await storage.updateSupplier(matchingSupplier.id, {
            gstin: gstin,
            tradeName: tradeName || matchingSupplier.name,
            address: address,
            placeOfSupply: placeOfSupply,
            shipToAddress: address, // Use same address for shipping
          });
          updatedCount++;
        } else {
          // Create new supplier if trade name doesn't match existing
          await storage.createSupplier({
            name: tradeName || `Supplier_${gstin}`,
            gstin: gstin,
            tradeName: tradeName,
            address: address,
            placeOfSupply: placeOfSupply,
            shipToAddress: address,
          });
          updatedCount++;
        }
      }

      console.log(`✅ Updated/created ${updatedCount} suppliers with GST data`);

      res.json({
        success: true,
        count: updatedCount,
        message: `Successfully processed GST data for ${updatedCount} suppliers`,
      });
    } catch (error) {
      console.error('GST data upload error:', error);
      res.status(500).json({ error: 'Failed to process GST data file' });
    }
  });

  // Get all uploaded files
  app.get('/api/files', async (req, res) => {
    try {
      const files = await storage.getAllUploadedFiles();
      res.json(files);
    } catch (error) {
      console.error('Get files error:', error);
      res.status(500).json({ error: 'Failed to get uploaded files' });
    }
  });

  // Get all uploaded files (alternative endpoint)
  app.get('/api/uploaded-files', async (req, res) => {
    try {
      const files = await storage.getAllUploadedFiles();
      res.json(files);
    } catch (error) {
      console.error('Get uploaded files error:', error);
      res.status(500).json({ error: 'Failed to get uploaded files' });
    }
  });

  // Get file data/preview endpoint
  app.get('/api/file-data', async (req, res) => {
    try {
      // Return temporary file data if available
      if (global.tempFileData && global.tempFileData.size > 0) {
        const firstFileData = Array.from(global.tempFileData.values())[0];
        return res.json({
          success: true,
          data: firstFileData.slice(0, 100), // Return first 100 rows for preview
          totalRows: firstFileData.length,
        });
      }
      res.json({ success: false, message: 'No file data available' });
    } catch (error) {
      console.error('Get file data error:', error);
      res.status(500).json({ error: 'Failed to get file data' });
    }
  });

  // Get specific file preview
  app.get('/api/files/:id/preview', async (req, res) => {
    try {
      const fileId = req.params.id;

      // Check if we have temp data for this file
      if (global.tempFileData && global.tempFileData.has(fileId)) {
        const fileData = global.tempFileData.get(fileId);
        return res.json({
          success: true,
          data: fileData.slice(0, 50), // Return first 50 rows for preview
          totalRows: fileData.length,
        });
      }

      // Try to get file info from database
      const files = await storage.getAllUploadedFiles();
      const file = files.find((f) => f.id === fileId);

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      res.json({
        success: true,
        fileInfo: file,
        message: 'File found but data not available in memory',
      });
    } catch (error) {
      console.error('Get file preview error:', error);
      res.status(500).json({ error: 'Failed to get file preview' });
    }
  });

  // File upload endpoint - only accept POST requests
  app.get('/api/files/upload', (req, res) => {
    res.status(405).json({
      error: 'Method Not Allowed',
      message:
        'File upload endpoint only accepts POST requests with multipart/form-data',
      expectedMethod: 'POST',
    });
  });

  app.post('/api/files/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
          message: 'Please select a CSV or Excel file to upload',
        });
      }

      console.log(
        `📤 Starting file upload: ${req.file.originalname} (${req.file.size} bytes)`,
      );

      // Validate file type
      const validMimeTypes = [
        'text/csv',
        'application/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];

      if (!validMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          error: 'Invalid file type',
          message: 'Please upload a CSV or Excel (.xlsx) file',
        });
      }

      // Process the file
      const rawData = await processCSVData(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname,
      );

      if (!rawData.headers || rawData.headers.length === 0) {
        return res.status(400).json({
          error: 'No headers found',
          message: 'The file must contain column headers in the first row',
        });
      }

      if (!rawData.data || rawData.data.length === 0) {
        return res.status(400).json({
          error: 'No data found',
          message: 'The file must contain data rows',
        });
      }

      // IMPROVED STORAGE STRATEGY: Always try to store in database first for persistence
      const fileId = `file-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const FILE_SIZE_THRESHOLD = 50 * 1024 * 1024; // Increased to 50MB threshold
      const isLargeFile = req.file.size > FILE_SIZE_THRESHOLD;

      // Create uploaded file object
      const uploadedFile = {
        id: fileId,
        filename: req.file.originalname,
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        data: rawData.data, // Always try to store data in database first
        columnMapping: null,
        processedData: null,
        summary: {
          rowCount: rawData.data.length,
          columnCount: rawData.headers.length,
          uploadedAt: new Date().toISOString(),
          headers: rawData.headers,
          isLargeFile,
          storageType: 'database', // Default to database storage
        },
        uploadedAt: new Date(),
      };

      // Try to store in database first for better persistence across server restarts
      try {
        await storage.createUploadedFile(uploadedFile);
        console.log(
          `💾 File stored in database successfully (${
            isLargeFile ? 'large file' : 'small file'
          })`,
        );
      } catch (error: any) {
        if (
          error?.message?.includes('too large') ||
          error?.message?.includes('payload')
        ) {
          console.log(
            `📁 File too large for database, using memory-only storage`,
          );
          // Fallback to memory-only for very large files
          uploadedFile.summary.storageType = 'memory-only';
          uploadedFile.data = null; // Don't store data in database
        } else {
          console.error('Database storage error:', error);
          // Still continue with memory storage
          uploadedFile.summary.storageType = 'memory-fallback';
        }
      }

      // Always keep in memory for immediate access
      if (!global.tempFileData) {
        global.tempFileData = new Map();
      }
      if (!global.tempFileHeaders) {
        global.tempFileHeaders = new Map();
      }
      if (!global.tempFileMetadata) {
        global.tempFileMetadata = new Map();
      }

      global.tempFileData.set(fileId, rawData.data);
      global.tempFileHeaders.set(fileId, rawData.headers);
      global.tempFileMetadata.set(fileId, uploadedFile);

      console.log(`✅ File upload successful:`);
      console.log(`📁 File: ${uploadedFile.filename}`);
      console.log(
        `📏 Size: ${uploadedFile.size} bytes (${(
          uploadedFile.size /
          (1024 * 1024)
        ).toFixed(1)}MB)`,
      );
      console.log(`📋 Headers: ${rawData.headers.length}`);
      console.log(`📦 Data rows: ${rawData.data.length}`);
      console.log(`🔑 Generated File ID: ${fileId}`);
      console.log(`💾 Storage strategy: ${uploadedFile.summary.storageType}`);
      console.log(
        `🔍 In tempFileMetadata: ${
          global.tempFileMetadata?.has(fileId) ? 'YES' : 'NO'
        }`,
      );

      // Return success response with storage information
      res.json({
        success: true,
        fileId: uploadedFile.id,
        filename: uploadedFile.filename,
        size: uploadedFile.size,
        headers: rawData.headers,
        rowCount: rawData.data.length,
        headerCount: rawData.headers.length,
        preview: rawData.data.slice(0, 3), // First 3 rows for preview
        storageType: uploadedFile.summary.storageType,
        isLargeFile: uploadedFile.summary.isLargeFile,
      });
    } catch (error) {
      console.error('❌ File upload error:', error);

      // Return detailed error information
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      res.status(500).json({
        error: 'Failed to upload file',
        message: errorMessage,
        details:
          'Please check that your file is a valid CSV or Excel file with headers in the first row',
      });
    }
  });

  // Column mapping endpoint
  app.post('/api/files/:fileId/mapping', async (req, res) => {
    try {
      const { fileId } = req.params;

      console.log(`🔍 Column mapping request for file: ${fileId}`);
      console.log(`📋 Received mapping:`, JSON.stringify(req.body, null, 2));

      // Validate that we have a mapping object
      if (!req.body || typeof req.body !== 'object') {
        return res
          .status(400)
          .json({ error: 'Invalid column mapping - must be an object' });
      }

      const mapping = req.body;

      // Validate required fields are present in mapping
      const requiredFields = ['supplierName', 'awbNo', 'productName', 'status'];
      const missingFields = requiredFields.filter(
        (field) => !mapping[field] || mapping[field].trim() === '',
      );

      if (missingFields.length > 0) {
        console.log(
          `❌ Missing required fields in mapping: ${missingFields.join(', ')}`,
        );
        return res.status(400).json({
          error: 'Missing required column mappings',
          missingFields,
          message: `Please map the following required columns: ${missingFields.join(
            ', ',
          )}`,
        });
      }

      console.log(
        `📂 Available temp files:`,
        global.tempFileMetadata
          ? Array.from(global.tempFileMetadata.keys())
          : 'No temp files',
      );

      // Try to get file from memory first, then database
      let file = global.tempFileMetadata?.get(fileId);

      if (!file) {
        console.log(
          `⚠️ File ${fileId} not found in memory, checking database...`,
        );
        // Fallback to database for smaller files
        file = await storage.getUploadedFile(fileId);
        if (!file) {
          console.log(`❌ File ${fileId} not found in database either`);
          if (fileId.startsWith('temp-')) {
            return res.status(410).json({
              error: 'File session expired',
              message:
                'Your uploaded file is no longer available. This happens when the server restarts. Please re-upload your file.',
              action: 'reupload',
            });
          }
          return res.status(404).json({ error: 'File not found', fileId });
        }
        // Update file with column mapping in database
        await storage.updateUploadedFile(fileId, {
          columnMapping: mapping,
        });
      } else {
        console.log(`✅ File ${fileId} found in memory, updating mapping...`);
        // Update file with column mapping in memory
        file.columnMapping = mapping;
        global.tempFileMetadata?.set(fileId, file);
      }

      console.log(`✅ Column mapping saved successfully for file ${fileId}`);
      res.json({ success: true, mapping });
    } catch (error) {
      console.error('❌ Column mapping error:', error);
      res.status(500).json({
        error: 'Failed to save column mapping',
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  });

  // Process data endpoint
  app.post('/api/files/:fileId/process', async (req, res) => {
    try {
      const { fileId } = req.params;

      console.log(`🔍 Processing request for file: ${fileId}`);

      // Try to get file from memory first, then database
      let file = global.tempFileMetadata?.get(fileId);
      let rawData = global.tempFileData?.get(fileId) || [];

      if (!file) {
        console.log(
          `📁 File ${fileId} not found in memory, checking database...`,
        );
        // Fallback to database for smaller files
        file = await storage.getUploadedFile(fileId);
        if (!file) {
          console.log(`❌ File ${fileId} not found in database either`);
          return res.status(404).json({
            error: 'File not found',
            message:
              'The uploaded file could not be found. Please re-upload your file.',
            action: 'reupload',
          });
        }
      }

      if (!file.columnMapping) {
        console.log(`❌ No column mapping found for file ${fileId}`);
        return res.status(400).json({
          error: 'Column mapping not set',
          message: 'Please set up column mapping before processing the data.',
        });
      }

      // If no data in memory, get from database (works for both temp and regular files)
      if (rawData.length === 0) {
        console.log(`📋 No data in memory for ${fileId}, checking database...`);
        rawData = file.data || [];
        console.log(
          `📋 Retrieved ${rawData.length} records from database for file ${fileId}`,
        );

        // Store back in memory for faster access
        if (rawData.length > 0) {
          if (!global.tempFileData) {
            global.tempFileData = new Map();
          }
          global.tempFileData.set(fileId, rawData);
          console.log(
            `💾 Restored ${rawData.length} records to memory for file ${fileId}`,
          );
        }
      }

      console.log(
        `Processing ${rawData.length} records with mapping:`,
        file.columnMapping,
      );

      if (rawData.length === 0) {
        console.log(`⚠️ No data found for file ${fileId}`);

        // Check if this is a temp file that was stored in memory only
        if (fileId.startsWith('temp-')) {
          return res.status(410).json({
            error: 'File session expired',
            message:
              'Your uploaded file data is no longer available due to server restart. This happens with temporary files when the server restarts. Please re-upload your file and process it immediately.',
            action: 'reupload',
            storageType: 'temporary',
          });
        } else {
          return res.status(410).json({
            error: 'File data not available',
            message:
              'Your uploaded file data is no longer available. Please re-upload your file and process it immediately.',
            action: 'reupload',
            storageType: 'database',
          });
        }
      }

      // ENHANCED DEBUG: Check unique pickup warehouses in raw data BEFORE filtering
      const mapping = file.columnMapping;
      const uniquePickupWarehouses = new Set();
      const warehouseFrequency = new Map();

      console.log(`🔍 DEBUG MODE ENABLED - Column Mapping Analysis:`);
      console.log(`📋 Supplier Name Column: "${mapping.supplierName}"`);
      console.log(`📋 Product Name Column: "${mapping.productName}"`);
      console.log(`📋 Status Column: "${mapping.status}"`);

      rawData.forEach((row, index) => {
        const supplierValue = row[mapping.supplierName];
        if (supplierValue) {
          uniquePickupWarehouses.add(supplierValue);
          warehouseFrequency.set(
            supplierValue,
            (warehouseFrequency.get(supplierValue) || 0) + 1,
          );
        }

        // Show first 5 rows for debugging
        if (index < 5) {
          console.log(`🔍 Row ${index + 1} Debug:`, {
            supplier: supplierValue,
            product: row[mapping.productName],
            status: row[mapping.status],
            awb: row[mapping.awbNo],
          });
        }
      });

      console.log(
        `🏪 TOTAL Unique pickup warehouses in raw data: ${uniquePickupWarehouses.size}`,
      );
      console.log(
        `📦 All pickup warehouses:`,
        Array.from(uniquePickupWarehouses),
      );

      // Show frequency distribution
      const sortedFrequency = Array.from(warehouseFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      console.log(`📊 Top 10 warehouse frequency:`, sortedFrequency);

      const normalizedData = normalizeData(rawData, file.columnMapping);

      // Separate cancelled orders
      const cancelledOrders = normalizedData.filter(
        (row) => row.status?.toLowerCase() === 'cancelled',
      );
      const validOrders = normalizedData.filter(
        (row) => row.status?.toLowerCase() !== 'cancelled',
      );

      // OPTIMIZED PROCESSING: Pre-create all unique suppliers first
      const uniqueSuppliers = new Set(
        validOrders.map((row) => row.supplierName),
      );
      const supplierMap = new Map();

      console.log(`📦 Creating ${uniqueSuppliers.size} unique suppliers...`);
      for (const supplierName of Array.from(uniqueSuppliers)) {
        let supplier = await storage.getSupplierByName(supplierName);
        if (!supplier) {
          supplier = await storage.createSupplier({ name: supplierName });
        }
        supplierMap.set(supplierName, supplier);
      }
      console.log(
        `✅ Suppliers created. Processing ${validOrders.length} orders in batches...`,
      );

      // After filtering debug
      console.log(
        `📊 After filtering: ${validOrders.length} valid orders, ${cancelledOrders.length} cancelled`,
      );
      console.log(
        `🔍 Normalized data supplier distribution:`,
        validOrders.reduce((acc, order) => {
          acc[order.supplierName] = (acc[order.supplierName] || 0) + 1;
          return acc;
        }, {}),
      );

      // Initialize progress tracking
      global.processingProgress = global.processingProgress || new Map();
      const totalBatches = Math.ceil(validOrders.length / 1000);
      global.processingProgress.set(fileId, {
        status: 'processing',
        currentBatch: 0,
        totalBatches,
        totalRecords: validOrders.length,
        processedRecords: 0,
        percentage: 0,
        message: 'Starting data processing...',
      });

      // Process in smaller batches to avoid stack overflow
      const BATCH_SIZE = 1000;
      const createdOrders = [];

      for (let i = 0; i < validOrders.length; i += BATCH_SIZE) {
        const batch = validOrders.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;

        // Update progress
        global.processingProgress.set(fileId, {
          status: 'processing',
          currentBatch: batchNum,
          totalBatches,
          totalRecords: validOrders.length,
          processedRecords: i,
          percentage: Math.round((i / validOrders.length) * 100),
          message: `Processing batch ${batchNum} of ${totalBatches}...`,
        });

        // Fast batch preparation using map instead of loop
        const ordersToCreate = batch.map((row) => ({
          awbNo: row.awbNo,
          supplierId: supplierMap.get(row.supplierName)!.id,
          productName: row.productName,
          courier: row.courier,
          qty: parseInt(row.qty || '1'),
          currency: row.currency || 'INR',
          status: row.status,
          orderAccount: row.orderAccount, // Extract order account from the uploaded data
          channelOrderDate: row.channelOrderDate
            ? new Date(row.channelOrderDate)
            : null,
          orderDate: row.orderDate ? new Date(row.orderDate) : null,
          deliveredDate: row.deliveredDate ? new Date(row.deliveredDate) : null,
          rtsDate: row.rtsDate ? new Date(row.rtsDate) : null,
          fileId: fileId.startsWith('temp-') ? null : fileId,
          unitPrice: null,
          lineAmount: null,
          hsn: null,
          previousStatus: null,
        }));

        try {
          const batchResults = await storage.createOrders(ordersToCreate);
          createdOrders.push(...batchResults);
          console.log(
            `⚡ Batch ${batchNum}/${totalBatches} - ${batchResults.length} orders saved`,
          );
        } catch (error) {
          console.error(
            `❌ Error in batch ${Math.floor(i / BATCH_SIZE) + 1}:`,
            error,
          );
        }
      }

      // Mark processing as complete
      if (!global.processingProgress) {
        global.processingProgress = new Map();
      }
      global.processingProgress.set(fileId, {
        status: 'completed',
        currentBatch: totalBatches,
        totalBatches,
        totalRecords: validOrders.length,
        processedRecords: validOrders.length,
        percentage: 100,
        message: `Processing complete! ${createdOrders.length} orders created.`,
      });

      console.log(
        `🎉 Processing complete! Total orders created: ${createdOrders.length}`,
      );

      // Generate summary
      const summary = {
        totalRecords: rawData.length,
        validOrders: validOrders.length,
        cancelledOrders: cancelledOrders.length,
        deliveredOrders: validOrders.filter(
          (row) => row.status?.toLowerCase() === 'delivered',
        ).length,
        uniqueSuppliers: supplierMap.size,
        ordersCreated: createdOrders.length,
        processingDate: new Date().toISOString(),
      };

      // Update file with processed data and summary
      await storage.updateUploadedFile(fileId, {
        processedData: null, // Don't store large data
        summary,
      });

      // Clear temporary data after processing (but keep database record for reference)
      global.tempFileData?.delete(fileId);

      // For temp files, schedule cleanup after 1 hour
      if (fileId.startsWith('temp-')) {
        setTimeout(async () => {
          try {
            console.log(`🧹 Cleaning up temporary file: ${fileId}`);
            await storage.deleteUploadedFile(fileId);
          } catch (error) {
            console.error('Error cleaning up temp file:', error);
          }
        }, 60 * 60 * 1000); // 1 hour
      }

      // Clean up progress after a delay to allow frontend to fetch final status
      setTimeout(() => {
        global.processingProgress?.delete(fileId);
      }, 10000);

      res.json({
        success: true,
        summary,
        cancelledOrders,
        orderIds: createdOrders.map((o) => o.id),
      });
    } catch (error) {
      console.error('Data processing error:', error);

      // Set error status in progress tracking
      if (!global.processingProgress) {
        global.processingProgress = new Map();
      }
      global.processingProgress.set(fileId, {
        status: 'error',
        currentBatch: 0,
        totalBatches: 0,
        totalRecords: 0,
        processedRecords: 0,
        percentage: 0,
        message: 'Processing failed due to an error',
        errorMessage:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });

      res.status(500).json({
        error: 'Failed to process data',
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  });

  // Price/HSN endpoints
  app.get('/api/price-entries', async (req, res) => {
    try {
      const { supplier } = req.query;
      let priceEntries = await storage.getAllPriceEntries();

      if (supplier) {
        const supplierEntity = await storage.getSupplierByName(
          supplier as string,
        );
        if (supplierEntity) {
          priceEntries = await storage.getPriceEntriesBySupplier(
            supplierEntity.id,
          );
        }
      }

      // Join with supplier names
      const enrichedEntries = await Promise.all(
        priceEntries.map(async (entry) => {
          const supplier = entry.supplierId
            ? await storage.getSupplier(entry.supplierId)
            : null;
          return {
            ...entry,
            supplierName: supplier?.name || 'Unknown',
          };
        }),
      );

      res.json(enrichedEntries);
    } catch (error) {
      console.error('Get price entries error:', error);
      res.status(500).json({ error: 'Failed to get price entries' });
    }
  });

  app.post('/api/price-entries', async (req, res) => {
    try {
      console.log('Received price entry data:', req.body);

      // Validate the request body
      const validationResult = insertPriceEntrySchema.safeParse(req.body);

      if (!validationResult.success) {
        console.error('Validation failed:', validationResult.error.errors);
        return res.status(400).json({
          error: 'Validation failed',
          details: validationResult.error.errors,
        });
      }

      const priceEntryData = validationResult.data;

      // Ensure supplierId exists if provided
      if (priceEntryData.supplierId) {
        const supplier = await storage.getSupplier(priceEntryData.supplierId);
        if (!supplier) {
          return res.status(400).json({ error: 'Invalid supplier ID' });
        }
      }

      const priceEntry = await storage.createPriceEntry(priceEntryData);
      console.log('Price entry created successfully:', priceEntry);

      res.json(priceEntry);
    } catch (error) {
      console.error('Create price entry error:', error);
      res.status(500).json({
        error: 'Failed to create price entry',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.put('/api/price-entries/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      console.log('Update request received:', { id, updates });

      // CRITICAL FIX: Ensure all date fields are proper Date objects
      const processedUpdates = { ...updates };

      // Convert effectiveFrom if it exists
      if (processedUpdates.effectiveFrom) {
        if (typeof processedUpdates.effectiveFrom === 'string') {
          processedUpdates.effectiveFrom = new Date(
            processedUpdates.effectiveFrom,
          );
        }
        console.log('Processed effectiveFrom:', processedUpdates.effectiveFrom);
      }

      // Convert effectiveTo if it exists and is not null
      if (processedUpdates.effectiveTo !== undefined) {
        if (
          processedUpdates.effectiveTo === null ||
          processedUpdates.effectiveTo === ''
        ) {
          processedUpdates.effectiveTo = null;
        } else if (typeof processedUpdates.effectiveTo === 'string') {
          processedUpdates.effectiveTo = new Date(processedUpdates.effectiveTo);
        }
        console.log('Processed effectiveTo:', processedUpdates.effectiveTo);
      }

      // Remove any undefined values to prevent Drizzle issues
      Object.keys(processedUpdates).forEach((key) => {
        if (processedUpdates[key] === undefined) {
          delete processedUpdates[key];
        }
      });

      console.log('Final processed updates:', processedUpdates);

      const updatedEntry = await storage.updatePriceEntry(id, processedUpdates);

      if (!updatedEntry) {
        return res.status(404).json({ error: 'Price entry not found' });
      }

      console.log('Price entry updated successfully:', updatedEntry);
      res.json(updatedEntry);
    } catch (error) {
      console.error('Update price entry error:', error);
      res.status(500).json({
        error: 'Failed to update price entry',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.delete('/api/price-entries/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deletePriceEntry(id);

      if (!deleted) {
        return res.status(404).json({ error: 'Price entry not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Delete price entry error:', error);
      res.status(500).json({ error: 'Failed to delete price entry' });
    }
  });

  // Bulk upload price entries from Excel/CSV
  app.post(
    '/api/price-entries/bulk-upload',
    upload.single('file'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            error: 'No file uploaded',
            message: 'Please select a CSV or Excel file to upload',
          });
        }

        // Check if supplierName is provided in request body (for single supplier uploads)
        const { supplierName } = req.body;

        console.log(
          `📤 Processing price list upload: ${req.file.originalname}`,
        );
        console.log(
          `📋 File details: MIME: ${req.file.mimetype}, Size: ${req.file.size} bytes`,
        );
        console.log(
          `🏢 Single supplier mode: ${
            supplierName
              ? 'YES (' + supplierName + ')'
              : 'NO (multi-supplier file expected)'
          }`,
        );

        // Process the uploaded file
        const rawData = await processCSVData(
          req.file.buffer,
          req.file.mimetype,
          req.file.originalname,
        );

        if (!rawData.headers || rawData.headers.length === 0) {
          return res.status(400).json({
            error: 'No headers found',
            message: 'The file must contain column headers in the first row',
          });
        }

        // Get all suppliers for reference
        const allSuppliers = await storage.getAllSuppliers();

        // Expected format for price list:
        // Supplier Name, Product Name, Price Before GST (INR), GST Rate (%), Price After GST (INR), HSN Code, Currency, Effective From, Effective To
        let processedCount = 0;
        const errors = [];
        const skippedCount = 0;

        for (let i = 0; i < rawData.data.length; i++) {
          const row = rawData.data[i];
          try {
            // Map columns (flexible mapping for both single and multi-supplier files)
            const rowSupplierName =
              row['Supplier Name'] ||
              row['supplier_name'] ||
              row['SupplierName'] ||
              supplierName ||
              '';
            const productName =
              row['Product Name'] ||
              row['product_name'] ||
              row['ProductName'] ||
              '';
            const priceBeforeGst = parseFloat(
              row['Price Before GST (INR)'] ||
                row['price_before_gst'] ||
                row['PriceBeforeGST'] ||
                '0',
            );
            const gstRate = parseFloat(
              row['GST Rate (%)'] || row['gst_rate'] || row['GSTRate'] || '18',
            ); // Default 18%
            const priceAfterGst = parseFloat(
              row['Price After GST (INR)'] ||
                row['price_after_gst'] ||
                row['PriceAfterGST'] ||
                '0',
            );
            const hsnCode =
              row['HSN Code'] || row['hsn_code'] || row['HSN'] || '';
            const currency = row['Currency'] || row['currency'] || 'INR';
            const effectiveFromStr =
              row['Effective From (YYYY-MM-DD)'] ||
              row['effective_from'] ||
              new Date().toISOString().split('T')[0];
            const effectiveToStr =
              row['Effective To (YYYY-MM-DD)'] || row['effective_to'] || null;

            // Validate required fields
            if (!rowSupplierName) {
              errors.push(
                `Row ${
                  i + 2
                }: Supplier name is required (check "Supplier Name" column)`,
              );
              continue;
            }

            if (!productName) {
              errors.push(`Row ${i + 2}: Product name is required`);
              continue;
            }

            // Ensure dates are strings, not Date objects
            const effectiveFrom =
              typeof effectiveFromStr === 'string'
                ? effectiveFromStr
                : new Date().toISOString().split('T')[0];
            const effectiveTo =
              effectiveToStr && typeof effectiveToStr === 'string'
                ? effectiveToStr
                : null;

            // Find or create supplier for this row
            let supplier = allSuppliers.find((s) => s.name === rowSupplierName);

            if (!supplier) {
              // Create new supplier if not exists
              supplier = await storage.createSupplier({
                name: rowSupplierName,
                contactEmail: '',
                contactPhone: '',
                orderAccount: '',
              });
              console.log(`🆕 Created new supplier: ${rowSupplierName}`);
              allSuppliers.push(supplier); // Add to local cache
            }

            // Allow "0" as valid price - only reject negative prices
            if (
              (priceBeforeGst < 0 && priceAfterGst < 0) ||
              (isNaN(priceBeforeGst) && isNaN(priceAfterGst))
            ) {
              errors.push(
                `Row ${
                  i + 2
                }: Invalid price values (negative values not allowed)`,
              );
              continue;
            }

            // Check if price entry already exists for this supplier-product combination
            const existingPrices = await storage.getAllPriceEntries();
            const existingPrice = existingPrices.find(
              (p) =>
                p.supplierId === supplier.id && p.productName === productName,
            );

            if (existingPrice) {
              // Calculate final price - use provided after GST price or calculate from before GST + rate
              // Allow "0" as valid price - only reject negative or NaN values
              let finalPrice: number;
              if (priceAfterGst >= 0 && !isNaN(priceAfterGst)) {
                // Use provided after GST price (including "0")
                finalPrice = priceAfterGst;
              } else if (priceBeforeGst >= 0 && !isNaN(priceBeforeGst)) {
                // Calculate from before GST price and rate (including "0")
                finalPrice = priceBeforeGst * (1 + gstRate / 100);
              } else {
                errors.push(
                  `Row ${
                    i + 2
                  }: Both price values are invalid (must be 0 or positive numbers)`,
                );
                continue;
              }

              // Update existing price entry
              await storage.updatePriceEntry(existingPrice.id, {
                price: finalPrice.toString(),
                priceBeforeGst: (
                  priceBeforeGst || finalPrice / (1 + gstRate / 100)
                ).toString(),
                gstRate: gstRate.toString(),
                hsn: hsnCode,
                currency,
                effectiveFrom: new Date(effectiveFrom),
                effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
              });
            } else {
              // Calculate final price - use provided after GST price or calculate from before GST + rate
              // Allow "0" as valid price - only reject negative or NaN values
              let finalPrice: number;
              if (priceAfterGst >= 0 && !isNaN(priceAfterGst)) {
                // Use provided after GST price (including "0")
                finalPrice = priceAfterGst;
              } else if (priceBeforeGst >= 0 && !isNaN(priceBeforeGst)) {
                // Calculate from before GST price and rate (including "0")
                finalPrice = priceBeforeGst * (1 + gstRate / 100);
              } else {
                errors.push(
                  `Row ${
                    i + 2
                  }: Both price values are invalid (must be 0 or positive numbers)`,
                );
                continue;
              }

              // Create new price entry
              await storage.createPriceEntry({
                supplierId: supplier.id,
                productName,
                price: finalPrice.toString(),
                priceBeforeGst: (
                  priceBeforeGst || finalPrice / (1 + gstRate / 100)
                ).toString(),
                gstRate: gstRate.toString(),
                hsn: hsnCode,
                currency,
                effectiveFrom: new Date(effectiveFrom),
                effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
              });
            }

            processedCount++;
          } catch (error) {
            errors.push(`Row ${i + 2}: ${error.message}`);
          }
        }

        // Collect stats about suppliers processed
        const uniqueSuppliers = new Set();
        for (let i = 0; i < rawData.data.length; i++) {
          const row = rawData.data[i];
          const rowSupplierName =
            row['Supplier Name'] ||
            row['supplier_name'] ||
            row['SupplierName'] ||
            supplierName ||
            '';
          if (rowSupplierName) {
            uniqueSuppliers.add(rowSupplierName);
          }
        }

        console.log(
          `✅ Processed ${processedCount} price entries for ${
            uniqueSuppliers.size
          } suppliers: ${Array.from(uniqueSuppliers).join(', ')}`,
        );

        res.json({
          success: true,
          details: {
            processed: processedCount,
            skipped: rawData.data.length - processedCount,
            errors: errors.length > 0 ? errors : [],
            suppliers: Array.from(uniqueSuppliers),
          },
          message: `Successfully processed ${processedCount} price entries for ${
            uniqueSuppliers.size
          } supplier(s)${
            errors.length > 0 ? ` with ${errors.length} errors` : ''
          }`,
        });
      } catch (error) {
        console.error('Bulk price upload error:', error);
        res.status(500).json({
          error: 'Failed to process price list upload',
          message: error.message,
        });
      }
    },
  );

  // Suppliers endpoint
  app.get('/api/suppliers', async (req, res) => {
    try {
      const suppliers = await storage.getAllSuppliers();
      res.json(suppliers);
    } catch (error) {
      console.error('Get suppliers error:', error);
      res.status(500).json({ error: 'Failed to get suppliers' });
    }
  });

  // Get suppliers with missing price counts and sorting
  app.get('/api/suppliers/with-missing-prices', async (req, res) => {
    try {
      const { sortBy = 'missing_prices', sortOrder = 'desc' } = req.query;

      // Validate sort parameters to prevent SQL injection
      const validSortColumns = [
        'name',
        'missing_prices',
        'total_orders',
        'created_at',
      ];
      const validSortOrder = ['asc', 'desc'];

      const safeSortBy = validSortColumns.includes(sortBy as string)
        ? sortBy
        : 'missing_prices';
      const safeSortOrder = validSortOrder.includes(
        (sortOrder as string)?.toLowerCase(),
      )
        ? (sortOrder as string).toUpperCase()
        : 'DESC';

      const sortColumn = safeSortBy === 'name' ? 's.name' : safeSortBy;

      const suppliers = await storage.getAllSuppliers();
      const orders = await storage.getAllOrders();

      // Create a map of existing price entries (supplier-product combinations)
      // This includes ALL prices - even "0" prices are valid and should NOT be counted as missing
      const priceEntries = await storage.getAllPriceEntries();
      const existingPrices = new Map();
      priceEntries.forEach((entry) => {
        const key = `${entry.supplierId}-${entry.productName}`;
        existingPrices.set(key, {
          price: entry.price,
          hasPrice: true,
        });
      });

      // Process data in memory - count unique products missing prices, not individual orders
      const supplierStats = suppliers.map((supplier) => {
        const supplierOrders = orders.filter(
          (order) => order.supplierId === supplier.id,
        );
        const totalOrders = supplierOrders.length;

        // Find unique products for this supplier that need price entries
        // Only count as missing if NO price entry exists (even "0" is a valid price)
        const uniqueProducts = new Map();
        supplierOrders.forEach((order) => {
          const key = `${supplier.id}-${order.productName}`;
          const priceEntry = existingPrices.get(key);

          // Only add to missing if NO price entry exists at all
          // "0" prices are valid and should NOT be counted as missing
          if (!priceEntry || !priceEntry.hasPrice) {
            uniqueProducts.set(order.productName, true);
          }
        });

        const missingPriceProducts = uniqueProducts.size;
        const totalUniqueProducts = new Set(
          supplierOrders.map((order) => order.productName),
        ).size;
        const missingPricePercentage =
          totalUniqueProducts > 0
            ? Math.round(
                ((missingPriceProducts * 100) / totalUniqueProducts) * 100,
              ) / 100
            : 0;

        return {
          id: supplier.id,
          name: supplier.name,
          order_account: supplier.orderAccount,
          created_at: supplier.createdAt,
          total_orders: totalOrders,
          missing_prices: missingPriceProducts, // Count unique products, not orders
          missing_price_percentage: missingPricePercentage,
          total_unique_products: totalUniqueProducts,
        };
      });

      // Sort the results
      supplierStats.sort((a, b) => {
        let aVal = a[safeSortBy];
        let bVal = b[safeSortBy];

        if (safeSortBy === 'name') {
          aVal = a.name;
          bVal = b.name;
        }

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return safeSortOrder === 'ASC'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        if (safeSortOrder === 'ASC') {
          return aVal - bVal;
        } else {
          return bVal - aVal;
        }
      });

      res.json(supplierStats);
    } catch (error) {
      console.error('Error fetching suppliers with missing prices:', error);
      res
        .status(500)
        .json({ error: 'Failed to fetch supplier data', suppliers: [] });
    }
  });

  // Update supplier order account
  app.patch('/api/suppliers/:id/order-account', async (req, res) => {
    try {
      const { id } = req.params;
      const { orderAccount } = req.body;

      const updated = await storage.updateSupplierOrderAccount(
        id,
        orderAccount,
      );
      if (!updated) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      res.json({ success: true, supplier: updated });
    } catch (error) {
      console.error('Update supplier order account error:', error);
      res
        .status(500)
        .json({ error: 'Failed to update supplier order account' });
    }
  });

  // Orders endpoint - Get all saved orders
  app.get('/api/orders', async (req, res) => {
    try {
      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch (error) {
      console.error('Get orders error:', error);
      res.status(500).json({ error: 'Failed to get orders' });
    }
  });

  // Progress tracking endpoint
  app.get('/api/files/:fileId/progress', async (req, res) => {
    try {
      const { fileId } = req.params;

      console.log(`🔍 Progress request for file: ${fileId}`);
      console.log(
        `📊 Available progress entries:`,
        global.processingProgress
          ? Array.from(global.processingProgress.keys())
          : 'No progress data',
      );

      const progress = global.processingProgress?.get(fileId);

      if (!progress) {
        // Check if file exists to provide better error messages
        let file = global.tempFileMetadata?.get(fileId);

        if (!file) {
          // Try database
          try {
            file = await storage.getUploadedFile(fileId);
          } catch (error) {
            console.log(`File ${fileId} not found in database`);
          }
        }

        if (!file) {
          console.log(`❌ File ${fileId} not found anywhere`);
          return res.status(404).json({
            error: 'File not found',
            message:
              'The file you are looking for does not exist or has expired.',
            status: 'not_found',
          });
        }

        // File exists but no progress - check if it has been processed
        if (file.summary && file.summary.processingDate) {
          console.log(`✅ File ${fileId} already processed`);
          return res.json({
            status: 'completed',
            currentBatch: 1,
            totalBatches: 1,
            totalRecords: file.summary.validOrders || 0,
            processedRecords: file.summary.ordersCreated || 0,
            percentage: 100,
            message: `Processing completed! ${
              file.summary.ordersCreated || 0
            } orders created.`,
            completedAt: file.summary.processingDate,
          });
        }

        // File exists but not processed yet
        console.log(`⏳ File ${fileId} not processed yet`);
        return res.json({
          status: 'pending',
          currentBatch: 0,
          totalBatches: 0,
          totalRecords: 0,
          processedRecords: 0,
          percentage: 0,
          message:
            'File uploaded but processing not started yet. Please set column mapping and click Process Data.',
        });
      }

      console.log(`📊 Progress found for ${fileId}:`, progress);
      res.json(progress);
    } catch (error) {
      console.error('Get progress error:', error);
      res.status(500).json({
        error: 'Failed to get progress',
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  });

  // Dashboard stats endpoint
  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      const orders = await storage.getAllOrders();
      const suppliers = await storage.getAllSuppliers();
      const priceEntries = await storage.getAllPriceEntries();

      // Calculate unique products from orders
      const uniqueProducts = new Set();
      orders.forEach((order) => {
        if (order.productName && order.productName.trim()) {
          uniqueProducts.add(order.productName.trim());
        }
      });

      // Calculate average order value from delivered orders with prices
      const deliveredOrders = orders.filter(
        (o) =>
          o.status?.toLowerCase() === 'delivered' ||
          o.status?.toLowerCase() === 'completed',
      );

      let totalOrderValue = 0;
      let validOrdersCount = 0;

      deliveredOrders.forEach((order) => {
        // Find price entry for this order
        const priceEntry = priceEntries.find(
          (entry) =>
            entry.supplierId === order.supplierId &&
            entry.productName === order.productName,
        );

        if (priceEntry && (priceEntry.price > 0 || priceEntry.unitPrice > 0)) {
          const unitPrice = parseFloat(
            String(priceEntry.price || priceEntry.unitPrice || 0),
          );
          const deliveredQty = parseInt(
            String(order.deliveredQty || order.qty || 0),
          );

          if (unitPrice > 0 && deliveredQty > 0) {
            totalOrderValue += unitPrice * deliveredQty;
            validOrdersCount++;
          }
        }
      });

      const averageOrderValue =
        validOrdersCount > 0 ? totalOrderValue / validOrdersCount : 0;

      const stats = {
        totalOrders: orders.length,
        totalSuppliers: suppliers.length,
        totalPriceEntries: priceEntries.length,
        uniqueProducts: uniqueProducts.size,
        averageOrderValue: averageOrderValue,
        deliveredOrders: deliveredOrders.length,
        cancelledOrders: orders.filter(
          (o) => o.status?.toLowerCase() === 'cancelled',
        ).length,
        rtsOrders: orders.filter((o) => o.status?.toLowerCase() === 'rts')
          .length,
        lastUpdated: new Date().toISOString(),
      };

      res.json(stats);
    } catch (error) {
      console.error('Get dashboard stats error:', error);
      res.status(500).json({ error: 'Failed to get dashboard stats' });
    }
  });

  // Helper function to generate supplier ID from name and product
  const generateSupplierProductId = (
    supplierName: string,
    productName: string,
  ) => {
    // Format: "SupplierNameProductName" (no separator, full names)
    return `${supplierName}${productName}`;
  };

  // Get missing price entries (vendor-product combinations that need prices)
  app.get('/api/missing-price-entries', async (req, res) => {
    try {
      const orders = await storage.getAllOrders();
      const priceEntries = await storage.getAllPriceEntries();
      const suppliers = await storage.getAllSuppliers();

      // Create a map of existing price entries
      const existingPrices = new Map();
      priceEntries.forEach((entry) => {
        const key = `${entry.supplierId}-${entry.productName}`;
        existingPrices.set(key, true);
      });

      // Find unique vendor-product combinations from orders
      const combinations = new Map();
      for (const order of orders) {
        // Get supplier name - either from order directly or from supplier table
        let supplierName = order.supplierName;
        if (!supplierName && order.supplierId) {
          const supplier = suppliers.find((s) => s.id === order.supplierId);
          supplierName = supplier?.name || 'Unknown Supplier';
        }
        if (!supplierName || supplierName === 'undefined') {
          supplierName = 'Unknown Supplier';
        }

        const key = `${supplierName}-${order.productName}`;
        if (!combinations.has(key)) {
          combinations.set(key, {
            supplierName: supplierName,
            productName: order.productName,
            orderCount: 1,
            latestOrderDate: order.orderDate,
            supplierProductId: generateSupplierProductId(
              supplierName,
              order.productName,
            ),
          });
        } else {
          const existing = combinations.get(key);
          existing.orderCount += 1;
          if (new Date(order.orderDate) > new Date(existing.latestOrderDate)) {
            existing.latestOrderDate = order.orderDate;
          }
        }
      }

      // Filter out combinations that already have price entries
      const missing = [];
      combinations.forEach((combo, key) => {
        const supplier = suppliers.find((s) => s.name === combo.supplierName);
        const priceKey = supplier
          ? `${supplier.id}-${combo.productName}`
          : null;

        if (!priceKey || !existingPrices.has(priceKey)) {
          missing.push({
            ...combo,
            supplierId: supplier?.id || null,
            needsPricing: true,
          });
        }
      });

      res.json(missing);
    } catch (error) {
      console.error('Get missing price entries error:', error);
      res.status(500).json({ error: 'Failed to get missing price entries' });
    }
  });

  // Export missing price entries as CSV template for bulk upload
  app.get('/api/export/missing-price-entries', async (req, res) => {
    const { supplier } = req.query; // Optional supplier filter
    try {
      const orders = await storage.getAllOrders();
      const priceEntries = await storage.getAllPriceEntries();
      const suppliers = await storage.getAllSuppliers();

      // Create a map of existing price entries
      const existingPrices = new Map();
      priceEntries.forEach((entry) => {
        const key = `${entry.supplierId}-${entry.productName}`;
        existingPrices.set(key, true);
      });

      // Find unique vendor-product combinations from orders
      const combinations = new Map();
      for (const order of orders) {
        // Get supplier name - either from order directly or from supplier table
        let supplierName = order.supplierName;
        if (!supplierName && order.supplierId) {
          const foundSupplier = suppliers.find(
            (s) => s.id === order.supplierId,
          );
          supplierName = foundSupplier?.name || 'Unknown Supplier';
        }
        if (!supplierName || supplierName === 'undefined') {
          supplierName = 'Unknown Supplier';
        }

        // Filter by specific supplier if requested
        if (supplier && supplierName !== supplier) {
          continue;
        }

        const key = `${supplierName}-${order.productName}`;
        if (!combinations.has(key)) {
          combinations.set(key, {
            supplierName: supplierName,
            productName: order.productName,
            orderCount: 1,
            latestOrderDate: order.orderDate,
            supplierProductId: generateSupplierProductId(
              supplierName,
              order.productName,
            ),
          });
        } else {
          const existing = combinations.get(key);
          existing.orderCount += 1;
          if (new Date(order.orderDate) > new Date(existing.latestOrderDate)) {
            existing.latestOrderDate = order.orderDate;
          }
        }
      }

      // Filter out combinations that already have price entries
      const missing = [];
      combinations.forEach((combo, key) => {
        const supplier = suppliers.find((s) => s.name === combo.supplierName);
        const priceKey = supplier
          ? `${supplier.id}-${combo.productName}`
          : null;

        if (!priceKey || !existingPrices.has(priceKey)) {
          missing.push({
            supplierName: combo.supplierName,
            productName: combo.productName,
            orderCount: combo.orderCount,
            supplierProductId: combo.supplierProductId,
            priceBeforeGST: '', // Empty for user to fill
            gstRate: '', // Empty for user to fill
            priceAfterGST: '', // Will be calculated
            hsn: '', // Empty for user to fill
            currency: 'INR',
            effectiveFrom: new Date().toISOString().split('T')[0],
            effectiveTo: '',
          });
        }
      });

      console.log(
        `📋 Export Result: Found ${missing.length} missing price entries`,
      );
      console.log('Sample missing entries:', missing.slice(0, 3));

      // Generate Excel content with GST calculations
      const excelHeaders = [
        'Supplier Name',
        'Product Name',
        'Order Count',
        'Supplier Product ID',
        'Price Before GST (INR)',
        'GST Rate (%)',
        'Price After GST (INR)',
        'HSN Code',
        'Currency',
        'Effective From (YYYY-MM-DD)',
        'Effective To (YYYY-MM-DD)',
      ];

      const excelRows = missing.map((item) => [
        item.supplierName,
        item.productName,
        item.orderCount,
        item.supplierProductId,
        item.priceBeforeGST,
        item.gstRate,
        item.priceAfterGST,
        item.hsn,
        item.currency,
        item.effectiveFrom,
        item.effectiveTo,
      ]);

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([excelHeaders, ...excelRows]);

      // Add some styling and formulas for GST calculation
      // Set column widths
      const columnWidths = [
        { wch: 25 }, // Supplier Name
        { wch: 30 }, // Product Name
        { wch: 12 }, // Order Count
        { wch: 25 }, // Supplier Product ID
        { wch: 18 }, // Price Before GST
        { wch: 12 }, // GST Rate
        { wch: 18 }, // Price After GST
        { wch: 12 }, // HSN Code
        { wch: 10 }, // Currency
        { wch: 18 }, // Effective From
        { wch: 18 }, // Effective To
      ];
      worksheet['!cols'] = columnWidths;

      // Add formulas for Price After GST calculation (starting from row 2)
      for (let i = 0; i < missing.length; i++) {
        const rowNum = i + 2; // Excel rows are 1-indexed, and we have header
        const priceAfterGSTCell = `G${rowNum}`;
        // Formula: Price Before GST * (1 + GST Rate / 100)
        worksheet[priceAfterGSTCell] = {
          f: `E${rowNum}*(1+F${rowNum}/100)`,
          t: 'n',
        };
      }

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        'Missing Price Entries',
      );

      const excelBuffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
      });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="missing-price-entries-template.xlsx"',
      );
      res.send(excelBuffer);
    } catch (error) {
      console.error('Export missing price entries error:', error);
      res.status(500).json({ error: 'Failed to export missing price entries' });
    }
  });

  // Bulk upload price entries from CSV/Excel
  app.post(
    '/api/price-entries/bulk-upload',
    upload.single('file'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No file provided' });
        }

        console.log(
          `📁 Bulk Upload Started: ${req.file.originalname} (${req.file.size} bytes)`,
        );
        console.log(`📋 MIME Type: ${req.file.mimetype}`);

        let parsedData;

        // Handle Excel files
        if (
          req.file.mimetype.includes('excel') ||
          req.file.mimetype.includes('spreadsheet')
        ) {
          const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          // Use defval option to handle empty cells and preserve formulas
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            raw: false,
            defval: '',
            blankrows: false,
          });

          const headers = jsonData[0] as string[];
          const dataRows = jsonData
            .slice(1)
            .filter(
              (row) => Array.isArray(row) && row.some((cell) => cell !== ''),
            );
          parsedData = { headers, dataRows };
          console.log(
            `📊 Excel parsed: ${headers.length} columns, ${dataRows.length} rows`,
          );
        }
        // Handle CSV files
        else if (req.file.mimetype.includes('csv')) {
          const fileContent = req.file.buffer.toString('utf-8');
          const lines = fileContent.split('\n').filter((line) => line.trim());

          if (lines.length < 2) {
            return res.status(400).json({
              error: 'CSV file should have header and at least one data row',
            });
          }

          const headers = lines[0]
            .split(',')
            .map((h) => h.replace(/"/g, '').trim());
          const dataRows = lines
            .slice(1)
            .map((line) =>
              line.split(',').map((cell) => cell.replace(/"/g, '').trim()),
            );
          parsedData = { headers, dataRows };
          console.log(
            `📊 CSV parsed: ${headers.length} columns, ${dataRows.length} rows`,
          );
        } else {
          return res.status(400).json({
            error: 'Unsupported file type. Please upload CSV or Excel file.',
          });
        }

        const { headers, dataRows } = parsedData;

        console.log(`📋 Headers detected:`, headers);
        console.log(`📊 First row sample:`, dataRows[0]);
        console.log(`📊 Second row sample:`, dataRows[1]);
        console.log(`📊 Third row sample:`, dataRows[2]);

        // Check actual column counts in data rows
        for (let i = 0; i < Math.min(5, dataRows.length); i++) {
          const row = Array.isArray(dataRows[i])
            ? dataRows[i]
            : dataRows[i]
                .split(',')
                .map((cell) => cell.replace(/"/g, '').trim());
          console.log(
            `📊 Row ${i + 1} has ${row.length} columns:`,
            row.slice(0, 5),
            '...',
          );
        }

        // Expected headers: Supplier Name, Product Name, Order Count, Supplier Product ID, Price Before GST, GST Rate, Price After GST, HSN Code, Currency, Effective From, Effective To
        const expectedHeaders = [
          'Supplier Name',
          'Product Name',
          'Order Count',
          'Supplier Product ID',
          'Price Before GST (INR)',
          'GST Rate (%)',
          'Price After GST (INR)',
          'HSN Code',
          'Currency',
          'Effective From (YYYY-MM-DD)',
          'Effective To (YYYY-MM-DD)',
        ];

        const results = {
          totalRows: dataRows.length,
          processed: 0,
          skipped: 0,
          errors: [] as string[],
        };

        for (let i = 0; i < dataRows.length; i++) {
          try {
            const row = Array.isArray(dataRows[i])
              ? dataRows[i]
              : dataRows[i]
                  .split(',')
                  .map((cell) => cell.replace(/"/g, '').trim());

            if (row.length < 8) {
              // Reduced from 11 to 8 - only need core fields
              results.skipped++;
              results.errors.push(
                `Row ${i + 2}: Insufficient columns - has ${
                  row.length
                }, need at least 8`,
              );
              continue;
            }

            const [
              supplierName,
              productName,
              orderCount,
              supplierProductId,
              priceBeforeGST,
              gstRate,
              priceAfterGST,
              hsn,
              currency,
              effectiveFrom,
              effectiveTo,
            ] = row;

            console.log(
              `🔍 Processing row ${
                i + 2
              }: Supplier=${supplierName}, Product=${productName}, Price=${priceBeforeGST}, HSN=${hsn}`,
            );

            // Clean and validate price - handle various Excel formats
            let cleanPrice = '';
            if (
              priceBeforeGST !== undefined &&
              priceBeforeGST !== null &&
              priceBeforeGST !== ''
            ) {
              if (typeof priceBeforeGST === 'number') {
                cleanPrice = priceBeforeGST.toString();
              } else {
                cleanPrice = String(priceBeforeGST).replace(/[^\d.-]/g, '');
              }
            }

            const cleanHSN = hsn ? String(hsn).trim() : '';

            console.log(
              `🧹 Cleaned values - Original Price: "${priceBeforeGST}", Clean Price: "${cleanPrice}", HSN: "${cleanHSN}"`,
            );

            // Skip if price before GST or HSN is empty - but allow "0" as valid price
            if (
              !cleanPrice ||
              !cleanHSN ||
              parseFloat(cleanPrice) < 0 ||
              isNaN(parseFloat(cleanPrice))
            ) {
              console.log(
                `❌ Skipping row ${
                  i + 2
                }: Price=${cleanPrice}, HSN=${cleanHSN}`,
              );
              results.skipped++;
              results.errors.push(
                `Row ${
                  i + 2
                }: Missing price (${cleanPrice}) or HSN (${cleanHSN}) - negative prices not allowed`,
              );
              continue;
            }

            // Find supplier
            const suppliers = await storage.getAllSuppliers();
            const supplier = suppliers.find((s) => s.name === supplierName);

            if (!supplier) {
              results.skipped++;
              results.errors.push(
                `Row ${i + 2}: Supplier "${supplierName}" not found`,
              );
              continue;
            }

            // Handle dates - schema expects timestamp format
            const currentDate = new Date();
            let fromDate = currentDate;
            let toDate = null;

            // Simple date handling - use today's date for effectiveFrom if empty
            if (effectiveFrom && effectiveFrom.toString().trim()) {
              try {
                fromDate = new Date(effectiveFrom.toString());
                if (isNaN(fromDate.getTime())) {
                  fromDate = currentDate;
                }
              } catch {
                fromDate = currentDate;
              }
            }

            if (effectiveTo && effectiveTo.toString().trim()) {
              try {
                toDate = new Date(effectiveTo.toString());
                if (isNaN(toDate.getTime())) {
                  toDate = null;
                }
              } catch {
                toDate = null;
              }
            }

            // Create price entry (use price before GST for calculations)
            const priceEntryData = {
              supplierId: supplier.id,
              productName: productName.trim(),
              currency: currency || 'INR',
              price: cleanPrice, // Store cleaned price before GST
              hsn: cleanHSN,
              effectiveFrom: fromDate,
              effectiveTo: toDate,
            };

            console.log(`💾 Creating price entry:`, priceEntryData);
            await storage.createPriceEntry(priceEntryData);
            results.processed++;
            console.log(
              `✅ Successfully created price entry for ${productName}`,
            );
          } catch (rowError) {
            console.error(`❌ Error processing row ${i + 2}:`, rowError);
            results.skipped++;
            results.errors.push(
              `Row ${i + 2}: ${
                rowError instanceof Error
                  ? rowError.message
                  : 'Processing error'
              }`,
            );
          }
        }

        console.log(`📊 Final Results:`, results);
        console.log(`📋 All Errors:`, results.errors);

        res.json({
          success: true,
          message: `Bulk upload completed: ${results.processed} entries added, ${results.skipped} skipped`,
          details: results,
        });
      } catch (error) {
        console.error('Bulk upload error:', error);
        res.status(500).json({
          error: 'Failed to process bulk upload',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // Orders endpoint
  app.get('/api/orders', async (req, res) => {
    try {
      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch (error) {
      console.error('Get orders error:', error);
      res.status(500).json({ error: 'Failed to get orders' });
    }
  });

  // Calculate payouts endpoint
  app.post('/api/calculate-payouts', async (req, res) => {
    try {
      const { fileId, pricingBasis = 'deliveredDate' } = req.body;

      const orders = fileId
        ? await storage.getOrdersByFileId(fileId)
        : await storage.getAllOrders();
      const priceEntries = await storage.getAllPriceEntries();
      const suppliers = await storage.getAllSuppliers();

      const results = await calculatePayouts(
        orders,
        priceEntries,
        suppliers,
        pricingBasis,
      );

      res.json(results);
    } catch (error) {
      console.error('Calculate payouts error:', error);
      res.status(500).json({ error: 'Failed to calculate payouts' });
    }
  });

  // Reports endpoint
  app.post('/api/reports/generate', async (req, res) => {
    try {
      const filters = reportFiltersSchema.parse(req.body);

      const orders = await storage.getAllOrders();
      const priceEntries = await storage.getAllPriceEntries();
      const suppliers = await storage.getAllSuppliers();
      const reconLogs = await storage.getAllReconciliationLogs();

      const reports = await generateReports(
        orders,
        priceEntries,
        suppliers,
        reconLogs,
        filters,
      );

      res.json(reports);
    } catch (error) {
      console.error('Generate reports error:', error);
      res.status(500).json({ error: 'Failed to generate reports' });
    }
  });

  // Export endpoints
  app.get('/api/export/:reportType', async (req, res) => {
    try {
      const { reportType } = req.params;
      const filters = req.query;

      // TODO: Implement CSV export functionality
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${reportType}.csv`,
      );
      res.send('Export functionality to be implemented');
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ error: 'Failed to export data' });
    }
  });

  // Reconciliation endpoint
  app.post('/api/reconciliation/process', async (req, res) => {
    try {
      const { newOrders } = req.body;
      const reconciliationLogs = [];

      for (const newOrder of newOrders) {
        const existingOrder = await storage.getOrderByAwbNo(newOrder.awbNo);

        if (existingOrder && existingOrder.status !== newOrder.status) {
          // Status change detected
          const impact = calculateStatusChangeImpact(existingOrder, newOrder);

          const log = await storage.createReconciliationLog({
            awbNo: newOrder.awbNo,
            orderId: existingOrder.id,
            previousStatus: existingOrder.status,
            newStatus: newOrder.status,
            impact: impact,
            note: `Status changed from ${existingOrder.status} to ${newOrder.status}`,
          });

          reconciliationLogs.push(log);

          // Update order status
          await storage.updateOrder(existingOrder.id, {
            previousStatus: existingOrder.status,
            status: newOrder.status,
          });
        }
      }

      res.json({ reconciliationLogs, processed: newOrders.length });
    } catch (error) {
      console.error('Reconciliation error:', error);
      res.status(500).json({ error: 'Failed to process reconciliation' });
    }
  });

  // Clear all orders data endpoint
  app.delete('/api/orders/clear-all', async (req, res) => {
    try {
      await storage.clearAllOrders();

      // Also clear temporary file data
      if (global.tempFileData) {
        global.tempFileData.clear();
      }

      console.log('🗑️ All orders data cleared successfully');
      res.json({
        success: true,
        message: 'All orders data cleared successfully',
      });
    } catch (error) {
      console.error('Error clearing orders data:', error);
      res.status(500).json({ error: 'Failed to clear orders data' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function calculateStatusChangeImpact(
  existingOrder: any,
  newOrder: any,
): number {
  // Simple impact calculation - in real implementation this would be more complex
  if (
    existingOrder.status === 'Delivered' &&
    ['RTS', 'RTO', 'Returned'].includes(newOrder.status)
  ) {
    return -(existingOrder.lineAmount || 0);
  } else if (
    ['RTS', 'RTO', 'Returned'].includes(existingOrder.status) &&
    newOrder.status === 'Delivered'
  ) {
    return existingOrder.lineAmount || 0;
  }
  return 0;
}
