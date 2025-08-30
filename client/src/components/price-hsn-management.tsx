import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Tags, Upload, Plus, Edit, Trash2, Database, Download, ExternalLink, Search, Filter, FileDown, FileUp } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Link } from 'wouter';
import * as XLSX from 'xlsx';

interface PriceHSNManagementProps {
  onSetupComplete: () => void;
}

interface PriceEntryForm {
  supplierId: string;
  productName: string;
  currency: string;
  price: number;
  hsn: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export function PriceHSNManagement({ onSetupComplete }: PriceHSNManagementProps) {
  const [selectedSupplier, setSelectedSupplier] = useState("all");
  const [pricingBasis, setPricingBasis] = useState("delivered_date");
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [bulkPrices, setBulkPrices] = useState<{[key: string]: { price: string, hsn: string, gstRate?: string }}>({});
  const [selectedBulkFile, setSelectedBulkFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Missing products modal filters
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [minOrderCount, setMinOrderCount] = useState('');
  const [maxOrderCount, setMaxOrderCount] = useState('');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<PriceEntryForm>({
    defaultValues: {
      supplierId: '',
      productName: '',
      currency: 'INR',
      price: 0,
      hsn: '',
      effectiveFrom: '',
      effectiveTo: ''
    }
  });

  // Fetch price entries
  const { data: priceEntries = [], isLoading: loadingPrices, error: priceEntriesError } = useQuery({
    queryKey: ['/api/price-entries', selectedSupplier],
    queryFn: async () => {
      const params = (selectedSupplier && selectedSupplier !== 'all') ? `?supplier=${selectedSupplier}` : '';
      const response = await fetch(`/api/price-entries${params}`);
      if (!response.ok) {
        console.error(`API Error: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to fetch price entries: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Price entries data type:', typeof data, 'isArray:', Array.isArray(data), 'data:', data);
      return Array.isArray(data) ? data : [];
    },
    retry: 3,
    retryDelay: 1000
  });

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ['/api/suppliers'],
    queryFn: async () => {
      const response = await fetch('/api/suppliers');
      return response.json(); // Keep .json() for fetch calls
    }
  });

  // Fetch missing price entries (vendor-product combinations needing prices)
  const { data: missingPriceEntries = [] } = useQuery({
    queryKey: ['/api/missing-price-entries'],
    queryFn: async () => {
      const response = await fetch('/api/missing-price-entries');
      return response.json(); // Keep .json() for fetch calls
    }
  });

  // Filter missing price entries based on search and order count filters
  const filteredMissingEntries = missingPriceEntries.filter((entry: any) => {
    // Supplier name filter
    const supplierMatch = !supplierSearchQuery || 
      entry.supplierName.toLowerCase().includes(supplierSearchQuery.toLowerCase());
    
    // Order count filter
    const orderCount = entry.orderCount || 0;
    const minMatch = !minOrderCount || orderCount >= parseInt(minOrderCount);
    const maxMatch = !maxOrderCount || orderCount <= parseInt(maxOrderCount);
    
    return supplierMatch && minMatch && maxMatch;
  });

  const createPriceEntryMutation = useMutation({
    mutationFn: async (data: PriceEntryForm) => {
      // Convert date strings to Date objects for database
      const processedData = {
        ...data,
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
        effectiveTo: data.effectiveTo && data.effectiveTo.trim() ? new Date(data.effectiveTo) : null,
      };
      
      return await apiRequest('POST', '/api/price-entries', processedData);
    },
    onSuccess: () => {
      toast({
        title: "Price entry created",
        description: "Price/HSN entry has been successfully added"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/price-entries'] });
      reset();
      setShowPriceModal(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to create entry",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updatePriceEntryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: Partial<PriceEntryForm> }) => {
      console.log('Updating price entry:', id, data);
      try {
        // Convert date strings to Date objects for database
        const processedData = {
          ...data,
          effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : undefined,
          effectiveTo: data.effectiveTo && data.effectiveTo.trim() ? new Date(data.effectiveTo) : null,
        };
        
        console.log('Processed data for API:', processedData);
        
        const response = await fetch(`/api/price-entries/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(processedData),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Error Response:', errorText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Price entry updated successfully:', result);
        return result;
      } catch (error) {
        console.error('Update API error:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('Update mutation succeeded:', data);
      toast({
        title: "Price entry updated",
        description: "Price/HSN entry has been successfully updated"
      });
      // Force cache refresh to show updated values immediately
      queryClient.invalidateQueries({ queryKey: ['/api/price-entries'] });
      queryClient.refetchQueries({ queryKey: ['/api/price-entries'] });
      setEditingEntry(null);
      setShowPriceModal(false);
      reset();
    },
    onError: (error) => {
      console.error('Update price entry error:', error);
      toast({
        title: "Update Failed", 
        description: "Could not update price entry. Please try again.",
        variant: "destructive"
      });
    }
  });

  const deletePriceEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/price-entries/${id}`, undefined);
    },
    onSuccess: () => {
      toast({
        title: "Price entry deleted",
        description: "Price/HSN entry has been successfully deleted"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/price-entries'] });
    }
  });

  const onSubmit = async (data: PriceEntryForm) => {
    console.log('Form submitted with data:', data);

    // Validate required fields
    if (!data.supplierId) {
      toast({
        title: "Error",
        description: "Supplier select karna zaroori hai",
        variant: "destructive"
      });
      return;
    }

    if (!data.productName?.trim()) {
      toast({
        title: "Error", 
        description: "Product name fill karna zaroori hai",
        variant: "destructive"
      });
      return;
    }

    if (!data.hsn?.trim()) {
      toast({
        title: "Error", 
        description: "HSN code fill karna zaroori hai",
        variant: "destructive"
      });
      return;
    }

    if (!data.effectiveFrom) {
      toast({
        title: "Error", 
        description: "Effective date select karna zaroori hai",
        variant: "destructive"
      });
      return;
    }

    // Allow price = 0 as it's a valid price (not missing price)
    if (data.price < 0) {
      toast({
        title: "Error", 
        description: "Price negative nahi ho sakta",
        variant: "destructive"
      });
      return;
    }

    try {
      // Calculate GST amounts automatically
      const finalPrice = parseFloat(data.price.toString());
      const gstRate = 18.0; // Default GST rate - can be made configurable later
      const priceBeforeGst = finalPrice / (1 + gstRate/100);
      
      console.log('GST Calculation:', {
        finalPrice,
        gstRate,
        priceBeforeGst: priceBeforeGst.toFixed(2)
      });
      
      // Format the data with automatic GST calculation
      const formattedData = {
        supplierId: data.supplierId || '',
        productName: data.productName.trim(),
        currency: data.currency || 'INR',
        price: finalPrice,
        priceBeforeGst: parseFloat(priceBeforeGst.toFixed(2)),
        gstRate: gstRate,
        hsn: data.hsn.trim(),
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo || ''
      };

      console.log('Sending data to API:', formattedData);

      if (editingEntry) {
        await updatePriceEntryMutation.mutateAsync({ id: editingEntry.id, data: formattedData });
      } else {
        await createPriceEntryMutation.mutateAsync(formattedData);
      }
    } catch (error) {
      console.error('Form submission error:', error);
      toast({
        title: "Error",
        description: "Entry save nahi ho paa rahi. Try again kijiye",
        variant: "destructive"
      });
    }
  };

  const openEditModal = (entry: any) => {
    setEditingEntry(entry);
    setValue('supplierId', entry.supplierId);
    setValue('productName', entry.productName);
    setValue('currency', entry.currency);
    setValue('price', parseFloat(entry.price));
    setValue('hsn', entry.hsn);
    setValue('effectiveFrom', entry.effectiveFrom?.split('T')[0] || '');
    setValue('effectiveTo', entry.effectiveTo?.split('T')[0] || '');
    setShowPriceModal(true);
  };

  const quickAddFromMissing = (missingEntry: any) => {
    setEditingEntry(null);
    
    // Find supplier ID from suppliers list
    const supplierMatch = suppliers.find((s: any) => s.name === missingEntry.supplierName);
    const supplierId = supplierMatch?.id || '';
    
    reset({
      supplierId: supplierId,
      productName: missingEntry.productName,
      currency: 'INR',
      price: 0,
      hsn: '',
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: ''
    });
    
    setShowPriceModal(true);
    
    toast({
      title: "Quick Add Mode",
      description: `Adding price for ${missingEntry.productName} from ${missingEntry.supplierName}`,
    });
  };

  // Handle bulk price updates
  const updateBulkPrice = (productKey: string, field: 'price' | 'hsn' | 'gstRate', value: string) => {
    setBulkPrices(prev => ({
      ...prev,
      [productKey]: {
        ...prev[productKey],
        [field]: value
      }
    }));
  };

  const saveBulkPrices = async () => {
    const entries = Object.entries(bulkPrices).filter(([_, data]) => 
      data.price && parseFloat(data.price) > 0 && data.hsn?.trim() && data.gstRate
    );

    if (entries.length === 0) {
      toast({
        title: "No entries to save",
        description: "Please fill price and HSN for at least one product",
        variant: "destructive"
      });
      return;
    }

    try {
      for (const [productKey, data] of entries) {
        const entry = missingPriceEntries.find((e: any) => 
          `${e.supplierName}_${e.productName}` === productKey
        );
        
        if (entry) {
          const supplierMatch = suppliers.find((s: any) => s.name === entry.supplierName);
          const finalPrice = parseFloat(data.price);
          const gstRate = parseFloat(data.gstRate) || 18.0;
          const priceBeforeGst = finalPrice / (1 + gstRate/100);
          
          const formattedData = {
            supplierId: supplierMatch?.id || '',
            productName: entry.productName,
            currency: 'INR',
            price: finalPrice,
            priceBeforeGst: parseFloat(priceBeforeGst.toFixed(2)),
            gstRate: gstRate,
            hsn: data.hsn.trim(),
            effectiveFrom: new Date().toISOString().split('T')[0],
            effectiveTo: ''
          };

          await createPriceEntryMutation.mutateAsync(formattedData);
        }
      }

      toast({
        title: "Bulk prices saved",
        description: `Successfully added ${entries.length} price entries`
      });
      
      setBulkPrices({});
      setShowBulkAddModal(false);
      queryClient.invalidateQueries({ queryKey: ['/api/price-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/missing-price-entries'] });
      
    } catch (error) {
      console.error('Bulk save error:', error);
      toast({
        title: "Error saving prices",
        description: "Some entries might not have been saved. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Download all price entries as Excel
  const downloadAllPricesExcel = async () => {
    try {
      // Get all price entries (not filtered by supplier)
      const response = await fetch('/api/price-entries');
      if (!response.ok) {
        throw new Error('Failed to fetch price entries');
      }
      
      const allPriceEntries = await response.json();
      
      if (!Array.isArray(allPriceEntries) || allPriceEntries.length === 0) {
        toast({
          title: "No Data to Export",
          description: "No price entries found in the database",
          variant: "destructive"
        });
        return;
      }

      // Get orders to calculate order count per product
      const ordersResponse = await fetch('/api/orders');
      const orders = ordersResponse.ok ? await ordersResponse.json() : [];
      
      // Calculate order count for each supplier-product combination
      const orderCounts = new Map();
      if (Array.isArray(orders)) {
        orders.forEach((order: any) => {
          const key = `${order.supplierId}_${order.productName}`;
          orderCounts.set(key, (orderCounts.get(key) || 0) + 1);
        });
      }

      // Format data according to user's screenshot format
      const worksheetData = [
        [
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
          'Effective To (YYYY-MM-DD)'
        ]
      ];

      allPriceEntries.forEach((entry: any) => {
        const orderCount = orderCounts.get(`${entry.supplierId}_${entry.productName}`) || 0;
        
        // Format Supplier Product ID: Supplier NameProduct Name (no special characters)
        const supplierName = (entry.supplierName || 'Unknown').toUpperCase();
        const productName = (entry.productName || '');
        const supplierProductId = `${supplierName}${productName}`;
        
        const effectiveFrom = entry.effectiveFrom ? new Date(entry.effectiveFrom).toISOString().split('T')[0] : '';
        const effectiveTo = entry.effectiveTo ? new Date(entry.effectiveTo).toISOString().split('T')[0] : '';
        
        worksheetData.push([
          entry.supplierName || 'Unknown',
          entry.productName || '',
          orderCount,
          supplierProductId,
          parseFloat(String(entry.priceBeforeGst || entry.price || 0)).toFixed(2),
          parseFloat(String(entry.gstRate || 18)).toFixed(1) + '%',
          parseFloat(String(entry.price || 0)).toFixed(2),
          entry.hsn || '',
          entry.currency || 'INR',
          effectiveFrom,
          effectiveTo
        ]);
      });

      // Create workbook
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      
      // Auto-size columns
      const colWidths = [
        { wch: 20 }, // Supplier Name
        { wch: 25 }, // Product Name
        { wch: 12 }, // Order Count
        { wch: 30 }, // Supplier Product ID
        { wch: 18 }, // Price Before GST
        { wch: 12 }, // GST Rate
        { wch: 18 }, // Price After GST
        { wch: 12 }, // HSN Code
        { wch: 10 }, // Currency
        { wch: 18 }, // Effective From
        { wch: 18 }  // Effective To
      ];
      worksheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Product Price Database');
      
      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `Product_Price_Database_${currentDate}.xlsx`;
      
      // Download the file
      XLSX.writeFile(workbook, filename);
      
      toast({
        title: "Excel Downloaded Successfully",
        description: `Downloaded ${allPriceEntries.length} price entries to ${filename}`
      });
      
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download price database. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Download missing entries as CSV template
  const downloadMissingEntriesCSV = async () => {
    try {
      const response = await fetch('/api/export/missing-price-entries');
      
      if (!response.ok) {
        throw new Error('Failed to download Excel file');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'missing-price-entries-template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Excel Downloaded",
        description: "Template file (.xlsx) download ho gaya. GST calculations ke saath ready hai!",
      });
    } catch (error) {
      console.error('Excel download error:', error);
      toast({
        title: "Download Failed",
        description: "Excel download nahi ho paya. Try again kijiye.",
        variant: "destructive"
      });
    }
  };

  // Handle bulk upload file selection
  const handleBulkUploadFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Accept both CSV and Excel files
      const isCSV = file.type === 'text/csv' || file.name.endsWith('.csv');
      const isExcel = file.type.includes('excel') || file.type.includes('spreadsheet') || 
                     file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      
      if (!isCSV && !isExcel) {
        toast({
          title: "Invalid File Type", 
          description: "Please select a CSV or Excel (.xlsx, .xls) file",
          variant: "destructive"
        });
        return;
      }
      setSelectedBulkFile(file);
      toast({
        title: "File Selected", 
        description: `${file.name} ready for upload`,
      });
    }
  };

  // Handle drag and drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      // Accept both CSV and Excel files
      const isCSV = file.type === 'text/csv' || file.name.endsWith('.csv');
      const isExcel = file.type.includes('excel') || file.type.includes('spreadsheet') || 
                     file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      
      if (!isCSV && !isExcel) {
        toast({
          title: "Invalid File Type", 
          description: "Please drop a CSV or Excel (.xlsx, .xls) file",
          variant: "destructive"
        });
        return;
      }
      
      setSelectedBulkFile(file);
      toast({
        title: "File Dropped Successfully", 
        description: `${file.name} is ready for upload`,
      });
    }
  };

  // Process bulk upload
  const processBulkUpload = async () => {
    if (!selectedBulkFile) return;

    setIsBulkUploading(true);
    setUploadProgress(0);
    setUploadStage('Preparing file upload...');

    // Simulate progress while uploading
    let progress = 0;
    let currentStage = 0;
    const stages = [
      { name: "Uploading file...", duration: 2000, maxProgress: 20 },
      { name: "Processing Excel data...", duration: 3000, maxProgress: 50 },
      { name: "Validating supplier names...", duration: 2000, maxProgress: 70 },
      { name: "Creating price entries...", duration: 10000, maxProgress: 95 }
    ];

    const progressInterval = setInterval(() => {
      if (currentStage < stages.length) {
        const stage = stages[currentStage];
        setUploadStage(stage.name);
        
        if (progress < stage.maxProgress) {
          const increment = (stage.maxProgress - progress) / (stage.duration / 200);
          progress = Math.min(progress + increment, stage.maxProgress);
          setUploadProgress(progress);
        } else {
          currentStage++;
        }
      }
    }, 200);

    const formData = new FormData();
    formData.append('file', selectedBulkFile);

    try {
      const response = await fetch('/api/price-entries/bulk-upload', {
        method: 'POST',
        body: formData
      });

      clearInterval(progressInterval);
      setUploadStage('Finalizing...');
      setUploadProgress(100);

      const result = await response.json();

      if (response.ok) {
        if (result.details.processed > 0) {
          toast({
            title: "Bulk Upload Successful",
            description: `${result.details.processed} price entries added for ${result.details.suppliers.length} suppliers!`,
          });
          
          // Close modal and reset states
          setShowBulkImportModal(false);
          setSelectedBulkFile(null);
        } else {
          // Show errors to user when no entries processed
          const errorPreview = result.details.errors.slice(0, 3).join('\n');
          toast({
            title: "Upload Failed - No Entries Added",
            description: `${result.details.skipped} entries skipped. Common errors:\n${errorPreview}${result.details.errors.length > 3 ? '\n...and more' : ''}`,
            variant: "destructive"
          });
        }
        
        queryClient.invalidateQueries({ queryKey: ['/api/price-entries'] });
        queryClient.invalidateQueries({ queryKey: ['/api/missing-price-entries'] });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      clearInterval(progressInterval);
      console.error('Bulk upload error:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload Excel file",
        variant: "destructive"
      });
    } finally {
      // Reset loading states
      setTimeout(() => {
        setIsBulkUploading(false);
        setUploadProgress(0);
        setUploadStage('');
      }, 1000);
    }
  };

  // Export filtered missing entries to Excel
  const exportFilteredMissingEntries = () => {
    const exportData = filteredMissingEntries.map((entry: any) => ({
      'Supplier Name': entry.supplierName,
      'Product Name': entry.productName,
      'Order Count': entry.orderCount,
      'Price Before GST (INR)': '',
      'GST Rate (%)': '',
      'Price After GST (INR)': '',
      'HSN Code': '',
      'Currency': 'INR',
      'Effective From (YYYY-MM-DD)': new Date().toISOString().split('T')[0],
      'Effective To (YYYY-MM-DD)': ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Missing Prices');
    
    const fileName = `missing-prices-filtered-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast({
      title: "Export Successful",
      description: `${filteredMissingEntries.length} missing price entries exported to Excel`,
    });
  };

  // Import missing prices from Excel/CSV file
  const handleMissingPricesImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Process imported data and update bulkPrices
        const newBulkPrices: any = {};
        jsonData.forEach((row: any) => {
          const supplierName = row['Supplier Name'] || row['supplier_name'];
          const productName = row['Product Name'] || row['product_name'];
          const price = row['Price Before GST (INR)'] || row['price_before_gst'] || '';
          const gstRate = row['GST Rate (%)'] || row['gst_rate'] || '';
          const hsn = row['HSN Code'] || row['hsn_code'] || '';

          if (supplierName && productName) {
            const productKey = `${supplierName}_${productName}`;
            newBulkPrices[productKey] = {
              price: price.toString(),
              gstRate: gstRate.toString(),
              hsn: hsn.toString()
            };
          }
        });

        setBulkPrices(prev => ({ ...prev, ...newBulkPrices }));
        
        toast({
          title: "Import Successful",
          description: `Imported ${Object.keys(newBulkPrices).length} price entries from ${file.name}`,
        });
        
        // Reset file input
        event.target.value = '';
      } catch (error) {
        console.error('Import error:', error);
        toast({
          title: "Import Failed",
          description: "Failed to import Excel file. Please check the format.",
          variant: "destructive"
        });
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  // State for bulk upload loading
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('');

  const openAddModal = () => {
    setEditingEntry(null);
    reset({
      supplierId: '',
      productName: '',
      currency: 'INR',
      price: 0,
      hsn: '',
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: ''
    });
    setShowPriceModal(true);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Present';
    return new Date(dateString).toLocaleDateString();
  };

  const formatPrice = (price: string, currency: string) => {
    const symbol = currency === 'INR' ? '₹' : '$';
    return `${symbol}${parseFloat(price).toLocaleString()}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Tags className="text-primary text-xl" />
          <h2 className="text-xl font-semibold text-gray-900">Price/HSN Management</h2>
        </div>
        <div className="flex space-x-3">
          <Button 
            variant="outline" 
            onClick={() => setShowBulkImportModal(true)} 
            data-testid="button-import-price-hsn"
            className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
          >
            <Upload className="h-4 w-4 mr-2" />
            Bulk Import CSV/Excel
          </Button>
          <Button 
            onClick={downloadAllPricesExcel}
            data-testid="button-download-price-database"
            variant="outline"
            className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Product Database
          </Button>
          <Button 
            onClick={openAddModal} 
            data-testid="button-add-price-entry"
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Price/HSN Entry
          </Button>
        </div>
      </div>

      {/* Quick Actions & Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">Total Price Entries</p>
              <p className="text-2xl font-bold text-blue-900" data-testid="text-price-entries-count">
                {priceEntries.length}
              </p>
            </div>
            <Database className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700">Active Suppliers</p>
              <p className="text-2xl font-bold text-green-900">
                {suppliers.length}
              </p>
            </div>
            <Tags className="h-8 w-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-700">Pricing Basis</p>
              <Select value={pricingBasis} onValueChange={setPricingBasis}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="delivered_date">Delivered Date</SelectItem>
                  <SelectItem value="order_date">Order Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Missing Price Entries Alert */}
      {missingPriceEntries.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="bg-yellow-100 rounded-full p-2">
                <Tags className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-yellow-800 mb-1">
                Missing Price/HSN Entries Found
              </h3>
              <p className="text-sm text-yellow-700 mb-3">
                Aapke uploaded order data mein <strong>{missingPriceEntries.length}</strong> products hain jinke liye price missing hai. 
                Neeche jo products dikh rahe hain, unpe click karke directly price entry kar sakte hain.
              </p>
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-yellow-800">
                  Click on any product to add its price:
                </h4>
                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                  {missingPriceEntries.slice(0, 15).map((entry: any, index: number) => (
                    <div 
                      key={index} 
                      className="bg-white p-3 rounded border hover:bg-gray-50 cursor-pointer transition-colors border-l-4 border-l-yellow-400"
                      onClick={() => quickAddFromMissing(entry)}
                      data-testid={`missing-entry-${index}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 text-sm">{entry.supplierName}</div>
                          <div className="text-gray-600 text-xs mt-1">{entry.productName}</div>
                          <div className="text-yellow-600 text-xs font-medium">
                            {entry.orderCount} orders pending
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Link href={`/supplier/${encodeURIComponent(entry.supplierName)}`}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-600 border-blue-600 hover:bg-blue-50 text-xs px-2 py-1"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              quickAddFromMissing(entry);
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1"
                          >
                            Add Price
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {missingPriceEntries.length > 15 && (
                    <div className="text-xs text-yellow-600 text-center py-2 border-t">
                      +{missingPriceEntries.length - 15} more products need pricing
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={() => setShowBulkAddModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Add All Prices
                </Button>
                <Button
                  size="sm"
                  onClick={openAddModal}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  Add Single Entry
                </Button>
                <Button
                  size="sm"
                  onClick={downloadMissingEntriesCSV}
                  variant="outline"
                  className="border-green-300 text-green-700 hover:bg-green-50"
                >
                  Download CSV Template
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Controls */}
      <div className="flex items-center justify-between mb-6 p-4 bg-gray-50 rounded-lg border">
        <div className="flex items-center space-x-4">
          <Label className="text-sm font-medium text-gray-700">Filter by Supplier:</Label>
          <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Suppliers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {suppliers
                .filter((supplier: any) => supplier.id && supplier.id.trim() !== '' && supplier.name && supplier.name.trim() !== '')
                .map((supplier: any) => (
                <SelectItem key={supplier.id} value={supplier.name}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-gray-600">
          Showing {priceEntries.length} price entries
        </div>
      </div>

      {/* Price/HSN Table */}
      <div className="overflow-hidden border border-gray-200 rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Supplier</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Price Before GST (INR)</TableHead>
              <TableHead>GST Rate (%)</TableHead>
              <TableHead>Price After GST (INR)</TableHead>
              <TableHead>HSN</TableHead>
              <TableHead>Effective Period</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingPrices ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">Loading...</TableCell>
              </TableRow>
            ) : !Array.isArray(priceEntries) ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-red-600">
                  Error loading price entries. Please refresh the page.
                </TableCell>
              </TableRow>
            ) : priceEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12">
                  <div className="flex flex-col items-center space-y-4">
                    <Tags className="h-12 w-12 text-gray-400" />
                    <div className="text-center">
                      <p className="text-lg font-medium text-gray-600">No Price/HSN Entries Found</p>
                      <p className="text-sm text-gray-500 mt-1">Add your first price entry to get started</p>
                    </div>
                    <Button 
                      onClick={openAddModal}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Entry
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              priceEntries.map((entry: any) => (
                <TableRow key={entry.id} className="hover:bg-gray-50">
                  <TableCell data-testid={`cell-supplier-${entry.id}`}>{entry.supplierName}</TableCell>
                  <TableCell data-testid={`cell-product-${entry.id}`}>{entry.productName}</TableCell>
                  <TableCell>{entry.currency}</TableCell>
                  <TableCell className="font-medium">
                    ₹{parseFloat(entry.priceBeforeGst || '0').toFixed(2)}
                  </TableCell>
                  <TableCell className="font-medium text-center">
                    {parseFloat(entry.gstRate || '0').toFixed(1)}%
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatPrice(entry.price, entry.currency)}
                  </TableCell>
                  <TableCell>{entry.hsn}</TableCell>
                  <TableCell className="text-gray-600">
                    {formatDate(entry.effectiveFrom)} to {formatDate(entry.effectiveTo)}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(entry)}
                        data-testid={`button-edit-${entry.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deletePriceEntryMutation.mutate(entry.id)}
                        data-testid={`button-delete-${entry.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-error" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Price Entry Modal */}
      <Dialog open={showPriceModal} onOpenChange={setShowPriceModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Tags className="h-5 w-5 text-primary" />
              <span>{editingEntry ? 'Edit Price/HSN Entry' : 'Add New Price/HSN Entry'}</span>
            </DialogTitle>

          </DialogHeader>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Supplier & Product Section */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 border-b pb-2">Basic Information</h4>
              
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Supplier <span className="text-red-500">*</span>
                </Label>
                <Select 
                  value={watch('supplierId') || ""} 
                  onValueChange={(value) => setValue('supplierId', value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choose a supplier..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers
                      .filter((supplier: any) => supplier.id && supplier.id.trim() !== '' && supplier.name && supplier.name.trim() !== '')
                      .map((supplier: any) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.supplierId && (
                  <p className="text-sm text-red-600 mt-1">Supplier is required</p>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Product Name <span className="text-red-500">*</span>
                </Label>
                <Input 
                  {...register('productName', { required: "Product name is required" })} 
                  placeholder="Enter product name"
                  className="mt-1"
                />
                {errors.productName && (
                  <p className="text-sm text-red-600 mt-1">{errors.productName.message}</p>
                )}
              </div>
            </div>

            {/* Pricing Information Section */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 border-b pb-2">Pricing Details</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Currency</Label>
                  <Select 
                    value={watch('currency') || "INR"} 
                    onValueChange={(value) => setValue('currency', value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">🇮🇳 INR (Indian Rupee)</SelectItem>
                      <SelectItem value="USD">🇺🇸 USD (US Dollar)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    Price <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    {...register('price', { 
                      required: "Price is required", 
                      valueAsNumber: true,
                      min: { value: 0, message: "Price must be positive" }
                    })} 
                    placeholder="0.00"
                    className="mt-1"
                  />
                  {errors.price && (
                    <p className="text-sm text-red-600 mt-1">{errors.price.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">
                  HSN Code <span className="text-red-500">*</span>
                </Label>
                <Input 
                  {...register('hsn', { required: "HSN code is required" })} 
                  placeholder="Enter HSN code (8 digits)"
                  className="mt-1"
                />
                {errors.hsn && (
                  <p className="text-sm text-red-600 mt-1">{errors.hsn.message}</p>
                )}
              </div>
            </div>

            {/* Date Range Section */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 border-b pb-2">Validity Period</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    Effective From <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    type="date" 
                    {...register('effectiveFrom', { required: "Effective date is required" })} 
                    className="mt-1"
                  />
                  {errors.effectiveFrom && (
                    <p className="text-sm text-red-600 mt-1">{errors.effectiveFrom.message}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Effective To (Optional)</Label>
                  <Input 
                    type="date" 
                    {...register('effectiveTo')} 
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave blank if no end date</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowPriceModal(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createPriceEntryMutation.isPending || updatePriceEntryMutation.isPending}
                data-testid="button-submit-price-entry"
                className="bg-green-600 hover:bg-green-700 text-white min-w-[120px]"
              >
                {(createPriceEntryMutation.isPending || updatePriceEntryMutation.isPending) ? 'Saving...' : (editingEntry ? 'Update Entry' : 'Save Entry')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Modal */}
      <Dialog open={showBulkImportModal} onOpenChange={setShowBulkImportModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Upload className="h-5 w-5 text-blue-600" />
              <span>Bulk Import Price/HSN Entries</span>
            </DialogTitle>

          </DialogHeader>
          
          <div className="space-y-6">
            {/* Instructions */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">How to Bulk Import:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>1. Download the Excel template with all missing products</li>
                <li>2. Fill Price Before GST and GST Rate columns (Price After GST will auto-calculate)</li>
                <li>3. Fill HSN Code for each product</li>
                <li>4. Save as CSV format and upload the completed file</li>
              </ul>
            </div>

            {/* Template Download */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div>
                <p className="font-medium text-gray-900">Download Excel Template</p>
                <p className="text-sm text-gray-600">Get Excel file with GST calculations and all missing products</p>
              </div>
              <Button 
                variant="outline"
                onClick={downloadMissingEntriesCSV}
                className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Excel (.xlsx)
              </Button>
            </div>

            {/* File Upload Area with Drag & Drop */}
            <div 
              className={`border-2 border-dashed ${isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'} rounded-lg p-8 text-center hover:border-blue-400 transition-colors`}
              onDrop={handleFileDrop}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              data-testid="drag-drop-area"
            >
              <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <div>
                <p className="text-lg font-medium text-gray-700">Drop File Here or Click to Upload</p>
                <p className="text-sm text-gray-500 mt-1">CSV or Excel file with GST prices and HSN codes</p>
              </div>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleBulkUploadFile}
                className="hidden"
                id="bulk-upload-input"
              />
              <label htmlFor="bulk-upload-input">
                <Button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer">
                  Choose File (CSV/Excel)
                </Button>
              </label>
              {selectedBulkFile && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700 font-medium">
                    ✓ Selected: {selectedBulkFile.name}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Size: {(selectedBulkFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {/* Progress display area */}
              <div id="upload-status" className="min-h-[60px] p-3 bg-gray-50 rounded-lg border">
                {isBulkUploading ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-blue-700">{uploadStage}</p>
                      <p className="text-sm text-blue-600">{Math.round(uploadProgress)}%</p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-600 text-center">
                      Processing large Excel files may take 1-2 minutes. Please wait...
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 text-center">
                    Upload results और errors यहां दिखेंगे
                  </p>
                )}
              </div>
              
              <div className="flex justify-end space-x-3">
                <Button 
                  variant="outline" 
                  disabled={isBulkUploading}
                  onClick={() => setShowBulkImportModal(false)}
                >
                  Cancel
                </Button>
                <Button 
                  disabled={!selectedBulkFile || isBulkUploading}
                  onClick={processBulkUpload}
                  className="bg-green-600 hover:bg-green-700 text-white min-w-[120px]"
                >
                  {isBulkUploading ? 'Processing...' : 'Import Prices'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Add Modal */}
      <Dialog open={showBulkAddModal} onOpenChange={setShowBulkAddModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5 text-blue-600" />
              <span>Add Prices for Missing Products</span>
            </DialogTitle>
            <DialogDescription>
              Neeche ki table mein sabhi missing products hain. Price aur HSN code fill karke sabko ek saath save kar sakte hain.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Stats and Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex-1">
                <p className="text-sm text-blue-700">
                  <strong>{filteredMissingEntries.length}</strong> of <strong>{missingPriceEntries.length}</strong> products shown. 
                  Fill prices and HSN codes for products you want to save.
                </p>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportFilteredMissingEntries}
                  className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                  data-testid="button-export-filtered"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Export ({filteredMissingEntries.length})
                </Button>
                
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleMissingPricesImport}
                  style={{ display: 'none' }}
                  id="import-missing-prices"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('import-missing-prices')?.click()}
                  className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                  data-testid="button-import-prices"
                >
                  <FileUp className="h-4 w-4 mr-2" />
                  Import Prices
                </Button>
              </div>
            </div>

            {/* Filters and Search */}
            <div className="flex flex-col lg:flex-row gap-4 p-4 bg-gray-50 rounded-lg border">
              <div className="flex-1">
                <Label htmlFor="supplier-search" className="text-sm font-medium text-gray-700 mb-2 block">
                  <Search className="h-4 w-4 inline mr-1" />
                  Search Suppliers
                </Label>
                <Input
                  id="supplier-search"
                  placeholder="Type supplier name to filter..."
                  value={supplierSearchQuery}
                  onChange={(e) => setSupplierSearchQuery(e.target.value)}
                  className="bg-white"
                  data-testid="input-supplier-search"
                />
              </div>
              
              <div className="flex gap-3">
                <div>
                  <Label htmlFor="min-orders" className="text-sm font-medium text-gray-700 mb-2 block">
                    <Filter className="h-4 w-4 inline mr-1" />
                    Min Orders
                  </Label>
                  <Input
                    id="min-orders"
                    type="number"
                    placeholder="Min"
                    value={minOrderCount}
                    onChange={(e) => setMinOrderCount(e.target.value)}
                    className="w-20 bg-white"
                    min="0"
                    data-testid="input-min-orders"
                  />
                </div>
                
                <div>
                  <Label htmlFor="max-orders" className="text-sm font-medium text-gray-700 mb-2 block">
                    Max Orders
                  </Label>
                  <Input
                    id="max-orders"
                    type="number"
                    placeholder="Max"
                    value={maxOrderCount}
                    onChange={(e) => setMaxOrderCount(e.target.value)}
                    className="w-20 bg-white"
                    min="0"
                    data-testid="input-max-orders"
                  />
                </div>
                
                {(supplierSearchQuery || minOrderCount || maxOrderCount) && (
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSupplierSearchQuery('');
                        setMinOrderCount('');
                        setMaxOrderCount('');
                      }}
                      className="text-gray-600 hover:text-gray-800"
                      data-testid="button-clear-filters"
                    >
                      Clear Filters
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="min-w-[160px]">Supplier</TableHead>
                    <TableHead className="min-w-[180px]">Product Name</TableHead>
                    <TableHead className="min-w-[110px]">Supplier Product ID</TableHead>
                    <TableHead className="min-w-[70px] text-center">Orders</TableHead>
                    <TableHead className="min-w-[110px]">Price Before GST</TableHead>
                    <TableHead className="min-w-[80px]">GST Rate (%)</TableHead>
                    <TableHead className="min-w-[100px]">HSN Code</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMissingEntries.map((entry: any, index: number) => {
                    const productKey = `${entry.supplierName}_${entry.productName}`;
                    const currentData = bulkPrices[productKey] || { price: '', hsn: '', gstRate: '' };
                    
                    return (
                      <TableRow key={index} className="hover:bg-gray-50">
                        <TableCell className="font-medium text-sm">
                          {entry.supplierName}
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.productName}
                        </TableCell>
                        <TableCell className="text-xs font-mono bg-gray-50">
                          {entry.supplierProductId || `${entry.supplierName?.replace(/[^A-Z0-9]/gi, '').toUpperCase()}${entry.productName?.replace(/[^A-Z0-9]/gi, '').toUpperCase().substring(0, 10)}`}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium">
                            {entry.orderCount}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            placeholder="Price before GST"
                            value={currentData.price}
                            onChange={(e) => updateBulkPrice(productKey, 'price', e.target.value)}
                            className="w-full"
                            min="0"
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            placeholder="GST %"
                            value={currentData.gstRate || ''}
                            onChange={(e) => updateBulkPrice(productKey, 'gstRate' as any, e.target.value)}
                            className="w-full"
                            min="0"
                            max="100"
                            step="0.1"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            placeholder="HSN"
                            value={currentData.hsn}
                            onChange={(e) => updateBulkPrice(productKey, 'hsn', e.target.value)}
                            className="w-full"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">
                {Object.entries(bulkPrices).filter(([_, data]) => 
                  data.price && parseFloat(data.price) > 0 && data.hsn?.trim() && data.gstRate
                ).length} products ready to save
              </div>
              <div className="flex space-x-3">
                <Button 
                  variant="outline" 
                  onClick={() => setShowBulkAddModal(false)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={saveBulkPrices}
                  disabled={createPriceEntryMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white min-w-[120px]"
                >
                  {createPriceEntryMutation.isPending ? 'Saving...' : 'Save All Prices'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
