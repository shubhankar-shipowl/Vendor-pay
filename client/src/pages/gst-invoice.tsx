import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, Download, FileText, ArrowLeft, Receipt, Building, User, Upload, Settings, ChevronDown, ChevronUp, AlertCircle, CheckCircle, Search } from "lucide-react";
import { Link } from 'wouter';
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

interface InvoiceItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  amount: number;
  gstAmount: number;
  totalAmount: number;
  hsn: string;
}

interface GSTInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  supplierName: string;
  supplierGSTIN: string;
  supplierTradeName: string;
  supplierAddress: string;
  supplierShipToAddress: string;
  buyerName: string;
  buyerGSTIN: string;
  buyerAddress: string;
  shipToAddress: string;
  placeOfSupply: string;
  termsAndConditions: string;
  items: InvoiceItem[];
  totalAmountBeforeGST: number;
  totalGSTAmount: number;
  totalAmountAfterGST: number;
}

export default function GSTInvoicePage() {
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerGSTIN, setBuyerGSTIN] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [shipToAddress, setShipToAddress] = useState('');
  const [supplierGSTIN, setSupplierGSTIN] = useState('');
  const [supplierTradeName, setSupplierTradeName] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [supplierShipToAddress, setSupplierShipToAddress] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('Payment due within 30 days\nAll disputes subject to local jurisdiction\nGoods once sold cannot be returned\nSubject to delivery as per terms agreed');
  const [generatedInvoice, setGeneratedInvoice] = useState<GSTInvoice | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadingGSTData, setUploadingGSTData] = useState(false);
  const [defaultBuyerGSTIN, setDefaultBuyerGSTIN] = useState('');
  const [defaultBuyerName, setDefaultBuyerName] = useState('');
  const [defaultBuyerAddress, setDefaultBuyerAddress] = useState('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [eligibleSuppliers, setEligibleSuppliers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateType, setDateType] = useState('channelOrderDate'); // 'channelOrderDate', 'deliveredDate' or 'orderDate'
  const [showMultiSelect, setShowMultiSelect] = useState(false);

  const { toast } = useToast();

  const { data: suppliers = [] } = useQuery({ queryKey: ['/api/suppliers'] });
  const { data: orders = [] } = useQuery({ queryKey: ['/api/orders'] });

  // Load default buyer settings on page load and apply to all invoices
  React.useEffect(() => {
    const savedGSTIN = localStorage.getItem('defaultBuyerGSTIN');
    const savedName = localStorage.getItem('defaultBuyerName');
    const savedAddress = localStorage.getItem('defaultBuyerAddress');
    
    if (savedGSTIN && savedName && savedAddress) {
      // Set default values for storage
      setDefaultBuyerGSTIN(savedGSTIN);
      setDefaultBuyerName(savedName);
      setDefaultBuyerAddress(savedAddress);
      
      // Auto-apply to current form for all invoices
      setBuyerGSTIN(savedGSTIN);
      setBuyerName(savedName);
      setBuyerAddress(savedAddress);
      setShipToAddress(savedAddress);
      
      toast({
        title: "Default Buyer Applied",
        description: "Using saved default buyer details for all suppliers",
      });
    }
  }, []);

  // Function to upload GST data file
  const handleGSTDataUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploadingGSTData(true);

    try {
      const response = await fetch('/api/upload-gst-data', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      toast({
        title: "GST Data Uploaded",
        description: `Successfully uploaded GST data for ${result.count} suppliers`,
      });

      setShowUploadDialog(false);
      
      // Refresh suppliers data
      window.location.reload();

    } catch (error) {
      console.error('GST data upload error:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload GST data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploadingGSTData(false);
    }
  };

  // Function to save default buyer settings for ALL suppliers
  const saveDefaultBuyerSettings = () => {
    if (defaultBuyerGSTIN && defaultBuyerName && defaultBuyerAddress) {
      // Store in localStorage for persistence across sessions
      localStorage.setItem('defaultBuyerGSTIN', defaultBuyerGSTIN);
      localStorage.setItem('defaultBuyerName', defaultBuyerName);
      localStorage.setItem('defaultBuyerAddress', defaultBuyerAddress);
      
      // Apply to current form
      setBuyerGSTIN(defaultBuyerGSTIN);
      setBuyerName(defaultBuyerName);
      setBuyerAddress(defaultBuyerAddress);
      setShipToAddress(defaultBuyerAddress);
      
      toast({
        title: "Default Buyer Set for All Suppliers",
        description: "These default buyer details will be used for all future invoices and suppliers",
      });
    } else {
      toast({
        title: "Missing Information", 
        description: "Please fill all buyer fields to set as default",
        variant: "destructive"
      });
    }
  };

  // Function to filter suppliers based on date range
  const filterEligibleSuppliers = () => {
    if (!dateFrom || !dateTo || !Array.isArray(orders) || !Array.isArray(suppliers)) {
      setEligibleSuppliers(Array.isArray(suppliers) ? suppliers : []);
      return;
    }

    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999); // Include the entire day
    
    // Find suppliers with orders in the date range based on selected date type
    const suppliersWithOrders = orders.filter((order: any) => {
      let selectedDate;
      if (dateType === 'channelOrderDate') {
        selectedDate = new Date(order.channelOrderDate);
      } else if (dateType === 'orderDate') {
        selectedDate = new Date(order.orderDate || order.channelOrderDate);
      } else {
        selectedDate = new Date(order.deliveredDate);
      }
      
      if (isNaN(selectedDate.getTime())) {
        return false; // Invalid date
      }
      
      return selectedDate >= fromDate && selectedDate <= toDate;
    });
    
    // Get unique supplier IDs from orders
    const supplierIds = Array.from(new Set(
      suppliersWithOrders.map((order: any) => order.supplierId).filter(Boolean)
    ));
    
    // Find suppliers that match these IDs
    const eligibleSuppliersByIds = suppliers.filter((supplier: any) => 
      supplierIds.includes(supplier.id)
    );
    setEligibleSuppliers(eligibleSuppliersByIds);
    
    if (eligibleSuppliersByIds.length === 0) {
      toast({
        title: "No Eligible Suppliers",
        description: `No suppliers have orders in the selected date range (${dateFrom} to ${dateTo}). Check if orders exist for this period.`,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Suppliers Filtered",
        description: `Found ${eligibleSuppliersByIds.length} suppliers with orders in this date range`,
      });
    }
  };

  // Filter suppliers when date range or date type changes
  React.useEffect(() => {
    if (dateFrom && dateTo) {
      filterEligibleSuppliers();
    }
  }, [dateFrom, dateTo, dateType, orders, suppliers]);

  // Filter suppliers based on search term
  const filteredSuppliers = React.useMemo(() => {
    const suppliersToShow = dateFrom && dateTo && eligibleSuppliers.length > 0 ? eligibleSuppliers : (Array.isArray(suppliers) ? suppliers : []);
    if (!searchTerm) return suppliersToShow;
    
    return suppliersToShow.filter((supplier: any) => 
      supplier.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (supplier.gstin && supplier.gstin.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [eligibleSuppliers, suppliers, searchTerm, dateFrom, dateTo]);

  // Clear all filters
  const clearAllFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSelectedSuppliers([]);
    setSearchTerm('');
    setEligibleSuppliers([]);
    toast({
      title: "Filters Cleared",
      description: "All filters and selections have been reset"
    });
  };

  // Function to export current suppliers for GST data entry
  const exportSuppliersForGST = () => {
    if (!Array.isArray(suppliers) || suppliers.length === 0) {
      toast({
        title: "No Suppliers Found",
        description: "No suppliers available to export",
        variant: "destructive"
      });
      return;
    }

    try {
      // Create data for Excel export
      const excelData = suppliers.map((supplier: any) => ({
        'Supplier Name': supplier.name,
        'GSTIN': supplier.gstin || '',
        'Trade Name': supplier.tradeName || supplier.name,
        'Address': supplier.address || '',
        'Place of Supply': supplier.placeOfSupply || ''
      }));

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Set column widths for better formatting
      const columnWidths = [
        { wch: 25 }, // Supplier Name
        { wch: 20 }, // GSTIN
        { wch: 25 }, // Trade Name
        { wch: 40 }, // Address
        { wch: 20 }  // Place of Supply
      ];
      worksheet['!cols'] = columnWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Suppliers GST Data');

      // Generate Excel file and download
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'All_Suppliers_GST_Data.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Suppliers Exported to Excel",
        description: `Exported ${suppliers.length} suppliers to Excel file. Add GST details and upload back.`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export suppliers to Excel file",
        variant: "destructive"
      });
    }
  };

  // Function to extract place of supply from GSTIN
  const extractPlaceOfSupply = (gstin: string) => {
    if (!gstin || gstin.length < 2) return '';
    
    const stateCodeMap: { [key: string]: string } = {
      '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
      '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
      '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
      '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
      '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
      '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
      '25': 'Daman and Diu', '26': 'Dadra and Nagar Haveli', '27': 'Maharashtra',
      '28': 'Andhra Pradesh', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep',
      '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands',
      '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh'
    };
    
    const stateCode = gstin.substring(0, 2);
    return stateCodeMap[stateCode] || '';
  };

  // Handle supplier selection
  const handleSupplierToggle = (supplierName: string) => {
    setSelectedSuppliers(prev => {
      let newSelected;
      if (prev.includes(supplierName)) {
        newSelected = prev.filter(name => name !== supplierName);
      } else {
        newSelected = [...prev, supplierName];
      }
      
      // Auto-fill supplier details when the first supplier is selected
      if (newSelected.length === 1) {
        const selectedSupplier = (Array.isArray(suppliers) ? suppliers : []).find((s: any) => s.name === supplierName);
        if (selectedSupplier) {
          // Auto-fill the supplier form with selected supplier's data
          setSupplierGSTIN(selectedSupplier.gstin || '');
          setSupplierTradeName(selectedSupplier.tradeName || selectedSupplier.name);
          setSupplierAddress(selectedSupplier.address || '');
          setSupplierShipToAddress(selectedSupplier.address || '');
          if (selectedSupplier.placeOfSupply) {
            setPlaceOfSupply(selectedSupplier.placeOfSupply);
          }
          
          toast({
            title: "Supplier Details Loaded",
            description: `Auto-filled details for ${selectedSupplier.name}`,
          });
        }
      } else if (newSelected.length === 0) {
        // Clear supplier details when no suppliers selected
        setSupplierGSTIN('');
        setSupplierTradeName('');
        setSupplierAddress('');
        setSupplierShipToAddress('');
        setPlaceOfSupply('');
      }
      
      return newSelected;
    });
  };

  const handleSelectAllSuppliers = () => {
    const supplierNames = filteredSuppliers.map((s: any) => s.name);
    setSelectedSuppliers(supplierNames);
  };

  const handleClearAllSuppliers = () => {
    setSelectedSuppliers([]);
  };

  // Function to fetch GST details from portal API
  const fetchGSTDetails = async (gstin: string) => {
    if (!gstin || gstin.length !== 15) return;
    
    try {
      const response = await fetch(`/api/gst-details/${gstin}`);
      const data = await response.json();
      
      if (data.tradeName) {
        setSupplierTradeName(data.tradeName);
      }
      if (data.legalName && !data.tradeName) {
        setSupplierTradeName(data.legalName);
      }
      if (data.address) {
        setSupplierAddress(data.address);
        if (!supplierShipToAddress) {
          setSupplierShipToAddress(data.address);
        }
      }
      if (data.placeOfSupply) {
        setPlaceOfSupply(data.placeOfSupply);
      }
      
      if (data.source === 'api') {
        toast({
          title: "GST Details Fetched",
          description: `Company details fetched from GST portal for ${gstin}`,
        });
      }
      
    } catch (error) {
      console.error('Failed to fetch GST details:', error);
      // Fallback to manual state detection
      const detectedPlace = extractPlaceOfSupply(gstin);
      if (detectedPlace) {
        setPlaceOfSupply(detectedPlace);
      }
    }
  };

  // Function to handle buyer GSTIN change and auto-fetch details
  const handleBuyerGSTINChange = async (gstin: string) => {
    setBuyerGSTIN(gstin);
    if (gstin && gstin.length === 15) {
      try {
        const response = await fetch(`/api/gst-details/${gstin}`);
        const data = await response.json();
        
        if (data.tradeName) {
          setBuyerName(data.tradeName);
        } else if (data.legalName) {
          setBuyerName(data.legalName);
        }
        
        if (data.address) {
          setBuyerAddress(data.address);
          if (!shipToAddress) {
            setShipToAddress(data.address);
          }
        }
        
        if (data.source === 'api') {
          toast({
            title: "Buyer Details Fetched",
            description: `Buyer details fetched from GST portal for ${gstin}`,
          });
        }
        
      } catch (error) {
        console.error('Failed to fetch buyer GST details:', error);
      }
    }
  };

  // Function to handle GSTIN change and auto-detect place of supply
  const handleSupplierGSTINChange = (gstin: string) => {
    setSupplierGSTIN(gstin);
    if (gstin && gstin.length === 15) {
      fetchGSTDetails(gstin);
    } else if (gstin && gstin.length >= 2) {
      const detectedPlace = extractPlaceOfSupply(gstin);
      if (detectedPlace) {
        setPlaceOfSupply(detectedPlace);
      }
    }
  };



  // Fetch price entries
  const { data: priceEntries = [] } = useQuery<any[]>({
    queryKey: ['/api/price-entries'],
    retry: 3,
    retryDelay: 1000,
  });

  const generateInvoice = async () => {
    if (selectedSuppliers.length === 0 || !dateFrom || !dateTo || !buyerName || !buyerGSTIN || !buyerAddress) {
      toast({
        title: "Missing Information",
        description: "Please fill all required fields to generate invoice",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Process invoices for selected suppliers
      const invoicePromises = selectedSuppliers.map(async (supplierName) => {
        const supplier = (Array.isArray(suppliers) ? suppliers : []).find((s: any) => s.name === supplierName);
        if (!supplier) return null;
        
        // Generate invoice for each supplier individually
        return await generateSingleSupplierInvoice(supplier);
      });
      
      const invoices = await Promise.all(invoicePromises);
      const validInvoices = invoices.filter(Boolean);
      
      if (validInvoices.length === 0) {
        throw new Error('No invoices could be generated for selected suppliers');
      }

      // For multiple suppliers, create a combined invoice
      if (validInvoices.length === 1) {
        setGeneratedInvoice(validInvoices[0]);
        toast({
          title: "Invoice Generated",
          description: `Successfully generated invoice for ${validInvoices[0]?.supplierName || 'supplier'}`,
        });
      } else {
        // For multiple suppliers, show them as separate line items in one invoice
        // Smart trade name logic: use single name if same, comma-separated if different
        const uniqueTradeNames = Array.from(new Set(
          validInvoices.map(inv => inv!.supplierTradeName || inv!.supplierName)
        ));
        const finalTradeName = uniqueTradeNames.length === 1 
          ? uniqueTradeNames[0] 
          : uniqueTradeNames.join(', ');

        const combinedInvoice: GSTInvoice = {
          ...validInvoices[0]!,
          supplierName: validInvoices.map(inv => inv!.supplierName).join(', '),
          supplierTradeName: finalTradeName,
          items: validInvoices.flatMap(inv => inv!.items),
          totalAmountBeforeGST: validInvoices.reduce((sum, inv) => sum + inv!.totalAmountBeforeGST, 0),
          totalGSTAmount: validInvoices.reduce((sum, inv) => sum + inv!.totalGSTAmount, 0),
          totalAmountAfterGST: validInvoices.reduce((sum, inv) => sum + inv!.totalAmountAfterGST, 0),
          invoiceNumber: `GST-MULTI-${new Date().getTime()}`
        };
        setGeneratedInvoice(combinedInvoice);
        toast({
          title: "Combined Invoice Generated",
          description: `Successfully generated combined invoice for ${validInvoices.length} suppliers`,
        });
      }
    } catch (error) {
      console.error('Error generating invoice:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate invoice",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Function to generate invoice for a single supplier
  const generateSingleSupplierInvoice = async (supplier: any): Promise<GSTInvoice | null> => {
    try {
      const fromDate = new Date(dateFrom);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);

      // Step 1: Filter orders by channel order date range first
      const ordersInDateRange = (Array.isArray(orders) ? orders : []).filter((order: any) => {
        if (order.supplierId !== supplier.id) return false;
        
        let selectedDate;
        if (dateType === 'channelOrderDate') {
          selectedDate = new Date(order.channelOrderDate);
        } else if (dateType === 'orderDate') {
          selectedDate = new Date(order.orderDate || order.channelOrderDate);
        } else {
          selectedDate = new Date(order.deliveredDate);
        }
        
        if (isNaN(selectedDate.getTime())) return false;
        return selectedDate >= fromDate && selectedDate <= toDate;
      });
      
      // Step 2: From those orders, only use Delivered/Completed for calculations
      const supplierOrders = ordersInDateRange.filter((order: any) => {
        return order.status === 'Delivered' || order.status === 'Completed';
      });
      
      console.log(`📊 Orders in date range for ${supplier.name}: ${ordersInDateRange.length}`);
      console.log(`📊 Delivered/Completed orders for ${supplier.name}: ${supplierOrders.length}`);

      if (supplierOrders.length === 0) return null;

      // Group orders by product and calculate totals
      const productMap = new Map();
      let totalAmountBeforeGST = 0;
      let totalGSTAmount = 0;

      supplierOrders.forEach((order: any) => {
        const priceEntry = priceEntries.find((entry: any) => 
          entry.supplierId === order.supplierId && 
          entry.productName === order.productName
        );

        if (!priceEntry) return;

        const deliveredQty = parseInt(String(order.deliveredQty || order.qty || 0));
        const unitPriceAfterGST = parseFloat(String(priceEntry.price || 0));
        const gstRate = parseFloat(String(priceEntry.gstRate || 18));
        
        if (unitPriceAfterGST <= 0 || deliveredQty <= 0) return;

        const unitPriceBeforeGST = unitPriceAfterGST / (1 + gstRate / 100);
        const amountBeforeGST = unitPriceBeforeGST * deliveredQty;
        const gstAmount = amountBeforeGST * (gstRate / 100);
        const totalAmount = amountBeforeGST + gstAmount;

        const productKey = order.productName;
        if (productMap.has(productKey)) {
          const existing = productMap.get(productKey);
          existing.quantity += deliveredQty;
          existing.amount += amountBeforeGST;
          existing.gstAmount += gstAmount;
          existing.totalAmount += totalAmount;
        } else {
          productMap.set(productKey, {
            productName: order.productName,
            quantity: deliveredQty,
            unitPrice: unitPriceBeforeGST,
            gstRate: gstRate,
            amount: amountBeforeGST,
            gstAmount: gstAmount,
            totalAmount: totalAmount,
            hsn: priceEntry.hsn || ''
          });
        }

        totalAmountBeforeGST += amountBeforeGST;
        totalGSTAmount += gstAmount;
      });

      const items = Array.from(productMap.values());
      
      if (items.length === 0) return null;

      // Generate invoice number
      const invoiceNumber = `GST-${supplier.name.toUpperCase().replace(/\s+/g, '')}-${new Date().getTime()}`;

      const invoice: GSTInvoice = {
        invoiceNumber,
        invoiceDate: new Date().toISOString().split('T')[0],
        supplierName: supplier.name,
        supplierGSTIN: supplier.gstin || supplierGSTIN || 'N/A', // Use supplier's own GSTIN first
        supplierTradeName: supplier.tradeName || supplierTradeName || supplier.name,
        supplierAddress: supplier.address || supplierAddress || 'N/A',
        supplierShipToAddress: supplier.address || supplierShipToAddress || supplierAddress || 'N/A',
        buyerName,
        buyerGSTIN,
        buyerAddress,
        shipToAddress: shipToAddress || buyerAddress,
        placeOfSupply: supplier.placeOfSupply || placeOfSupply || '',
        termsAndConditions,
        items,
        totalAmountBeforeGST,
        totalGSTAmount,
        totalAmountAfterGST: totalAmountBeforeGST + totalGSTAmount
      };

      return invoice;
    } catch (error) {
      console.error('Invoice generation error:', error);
      return null;
    }
  };

  const downloadInvoice = () => {
    if (!generatedInvoice) return;

    const invoiceHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>GST Invoice - ${generatedInvoice.invoiceNumber}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
        .invoice-header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
        .invoice-details { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .party-details { width: 48%; border: 1px solid #ddd; padding: 10px; }
        .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .invoice-table th, .invoice-table td { border: 1px solid #ddd; padding: 6px; text-align: left; font-size: 11px; }
        .invoice-table th { background-color: #f2f2f2; font-weight: bold; }
        .totals { text-align: right; font-weight: bold; }
        .amount { text-align: right; }
        .gst-summary { margin-top: 20px; border: 1px solid #ddd; padding: 10px; background-color: #f8f9fa; }
        .footer-section { margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px; }
        .computer-generated { text-align: center; font-style: italic; color: #666; margin-top: 20px; }
        .place-supply { margin-bottom: 10px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="invoice-header">
        <h1 style="margin: 0; color: #333;">GST INVOICE</h1>
        <p style="margin: 5px 0;">Invoice No: <strong>${generatedInvoice.invoiceNumber}</strong></p>
        <p style="margin: 5px 0;">Date: <strong>${new Date(generatedInvoice.invoiceDate).toLocaleDateString()}</strong></p>
        ${generatedInvoice.placeOfSupply ? `<p class="place-supply">Place of Supply: ${generatedInvoice.placeOfSupply}</p>` : ''}
    </div>
    
    <!-- Billing Details Row -->
    <div class="invoice-details">
        <div class="party-details">
            <h3 style="margin-top: 0; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Supplier Details (Bill From)</h3>
            <p><strong>${generatedInvoice.supplierTradeName || generatedInvoice.supplierName}</strong></p>
            ${generatedInvoice.supplierAddress ? `<p style="margin: 5px 0;">${generatedInvoice.supplierAddress}</p>` : ''}
            <p style="margin: 5px 0;"><strong>GSTIN:</strong> ${generatedInvoice.supplierGSTIN}</p>
        </div>
        <div class="party-details">
            <h3 style="margin-top: 0; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Buyer Details (Bill To)</h3>
            <p><strong>${generatedInvoice.buyerName}</strong></p>
            ${generatedInvoice.buyerAddress ? `<p style="margin: 5px 0;">${generatedInvoice.buyerAddress}</p>` : ''}
            <p style="margin: 5px 0;"><strong>GSTIN:</strong> ${generatedInvoice.buyerGSTIN}</p>
        </div>
    </div>
    
    
    <table class="invoice-table">
        <thead>
            <tr>
                <th>S.No</th>
                <th>Product Name</th>
                <th>HSN Code</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Amount</th>
                <th>GST Rate</th>
                <th>GST Amount</th>
                <th>Total Amount</th>
            </tr>
        </thead>
        <tbody>
            ${generatedInvoice.items.map((item, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.productName}</td>
                    <td>${item.hsn}</td>
                    <td>${item.quantity}</td>
                    <td class="amount">₹${item.unitPrice.toFixed(2)}</td>
                    <td class="amount">₹${item.amount.toFixed(2)}</td>
                    <td>${item.gstRate}%</td>
                    <td class="amount">₹${item.gstAmount.toFixed(2)}</td>
                    <td class="amount">₹${item.totalAmount.toFixed(2)}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    
    <div class="gst-summary">
        <div class="totals">
            <p>Total Amount (Before GST): ₹${generatedInvoice.totalAmountBeforeGST.toFixed(2)}</p>
            <p>Total GST Amount: ₹${generatedInvoice.totalGSTAmount.toFixed(2)}</p>
            <p><strong>Total Amount (After GST): ₹${generatedInvoice.totalAmountAfterGST.toFixed(2)}</strong></p>
        </div>
    </div>
    
    <div class="footer-section">
        <h4 style="margin-top: 0; color: #333;">Terms & Conditions:</h4>
        ${generatedInvoice.termsAndConditions.split('\n').map(term => `<p style="margin: 3px 0;">• ${term}</p>`).join('')}
    </div>
    
    <div class="computer-generated">
        <p style="margin: 10px 0; font-size: 11px;"><strong>This is a computer generated invoice, no signature required.</strong></p>
        <p style="margin: 5px 0; font-size: 10px;">Generated on: ${new Date().toLocaleString()}</p>
    </div>
</body>
</html>`;

    const blob = new Blob([invoiceHTML], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GST_Invoice_${generatedInvoice.invoiceNumber}.html`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast({
      title: "Invoice Downloaded",
      description: `GST Invoice ${generatedInvoice.invoiceNumber} downloaded successfully`
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <div className="bg-white shadow-lg border-b-4 border-blue-500">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <Link href="/">
                <Button variant="outline" size="sm" className="flex items-center space-x-2 hover:bg-blue-50">
                  <ArrowLeft className="h-4 w-4" />
                  <span>Dashboard</span>
                </Button>
              </Link>
              <div className="border-l-2 border-gray-300 pl-6">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <Receipt className="h-8 w-8 text-blue-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">GST Invoice Generator</h1>
                    <p className="text-blue-600 font-medium">Generate compliant GST invoices for supplier payouts</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {/* Upload GST Data Button */}
                  <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex items-center space-x-2 bg-green-50 border-green-200 text-green-700 hover:bg-green-100">
                        <Upload className="h-4 w-4" />
                        <span>Upload GST Data</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Upload Supplier GST Data</DialogTitle>
                        <DialogDescription>
                          Upload a CSV/Excel file with supplier GST information (GSTIN, Trade Name, Address)
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Expected columns: GSTIN, Trade Name, Address, Place of Supply</Label>
                          <div className="flex items-center space-x-2 mt-2">
                            <Button
                              onClick={exportSuppliersForGST}
                              variant="outline"
                              size="sm"
                              className="text-blue-600 border-blue-200 hover:bg-blue-50"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Export All Suppliers
                            </Button>
                            <span className="text-sm text-gray-500">Download with your {Array.isArray(suppliers) ? suppliers.length : 0} suppliers</span>
                          </div>
                          <Input
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            onChange={handleGSTDataUpload}
                            disabled={uploadingGSTData}
                            className="mt-2"
                          />
                        </div>
                        {uploadingGSTData && (
                          <div className="flex items-center space-x-2 text-blue-600">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            <span>Uploading GST data...</span>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Default Buyer Settings */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex items-center space-x-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100">
                        <Settings className="h-4 w-4" />
                        <span>Default Buyer</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Set Default Buyer Details</DialogTitle>
                        <DialogDescription>
                          Set default buyer information that will be automatically applied to ALL suppliers and invoices
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        {/* Status indicator */}
                        {localStorage.getItem('defaultBuyerGSTIN') && (
                          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center space-x-2 text-green-700">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-sm font-medium">Default buyer settings are active for all suppliers</span>
                            </div>
                          </div>
                        )}
                        
                        <div>
                          <Label>Default Buyer GSTIN</Label>
                          <Input
                            type="text"
                            value={defaultBuyerGSTIN}
                            onChange={(e) => setDefaultBuyerGSTIN(e.target.value)}
                            placeholder="Enter default buyer GSTIN"
                            maxLength={15}
                          />
                        </div>
                        <div>
                          <Label>Default Buyer Name</Label>
                          <Input
                            type="text"
                            value={defaultBuyerName}
                            onChange={(e) => setDefaultBuyerName(e.target.value)}
                            placeholder="Enter default buyer company name"
                          />
                        </div>
                        <div>
                          <Label>Default Buyer Address</Label>
                          <Input
                            type="text"
                            value={defaultBuyerAddress}
                            onChange={(e) => setDefaultBuyerAddress(e.target.value)}
                            placeholder="Enter default buyer address"
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3">
                          <Button onClick={saveDefaultBuyerSettings} className="w-full bg-green-600 hover:bg-green-700">
                            Set as Default for All Suppliers
                          </Button>
                          
                          {localStorage.getItem('defaultBuyerGSTIN') && (
                            <Button 
                              onClick={() => {
                                localStorage.removeItem('defaultBuyerGSTIN');
                                localStorage.removeItem('defaultBuyerName');
                                localStorage.removeItem('defaultBuyerAddress');
                                setDefaultBuyerGSTIN('');
                                setDefaultBuyerName('');
                                setDefaultBuyerAddress('');
                                toast({
                                  title: "Defaults Cleared",
                                  description: "Default buyer settings removed. You'll need to enter buyer details manually for each invoice.",
                                });
                              }} 
                              variant="outline" 
                              className="w-full text-red-600 border-red-300 hover:bg-red-50"
                            >
                              Clear Default Settings
                            </Button>
                          )}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Invoice Generation Form */}
        <Card className="border-2 border-blue-200 shadow-xl">
          <CardHeader className="bg-blue-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center space-x-3 text-xl">
              <FileText className="h-6 w-6" />
              <span>Generate GST Invoice</span>
            </CardTitle>
            <CardDescription className="text-blue-100">
              Create GST compliant invoices for supplier transactions
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="space-y-8">
              {/* New Layout: Supplier Selection + Date Range + Controls */}
              <div className="space-y-6">
                {/* Top Controls Row */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-center space-x-4">
                    <h3 className="text-lg font-semibold text-gray-800">Select Suppliers ({selectedSuppliers.length} selected)</h3>
                    <div className="flex space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAllSuppliers}
                        disabled={filteredSuppliers.length === 0}
                      >
                        Select All
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleClearAllSuppliers}
                      >
                        Clear All
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearAllFilters}
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      Clear All Filters
                    </Button>
                  </div>
                </div>

                {/* Date Range and Search Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Date Type *</Label>
                    <Select value={dateType} onValueChange={setDateType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="channelOrderDate">Channel Order Date</SelectItem>
                        <SelectItem value="deliveredDate">Delivered Date</SelectItem>
                        <SelectItem value="orderDate">Order Date</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="dateFrom" className="text-sm font-medium text-gray-700">From Date *</Label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <Label htmlFor="dateTo" className="text-sm font-medium text-gray-700">To Date *</Label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Search Suppliers</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search suppliers..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                {/* Success/Status Message */}
                {dateFrom && dateTo && (
                  <div className="p-4 rounded-lg border">
                    {eligibleSuppliers.length > 0 ? (
                      <div className="text-green-600 bg-green-50 p-3 rounded-lg border border-green-200 flex items-center space-x-2">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">✓ {filteredSuppliers.length} of {eligibleSuppliers.length} suppliers available for selected date range</span>
                      </div>
                    ) : (
                      <div className="text-red-600 bg-red-50 p-3 rounded-lg border border-red-200 flex items-center space-x-2">
                        <AlertCircle className="h-5 w-5" />
                        <span className="font-medium">No suppliers have orders in the selected date range ({dateFrom} to {dateTo})</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Suppliers Grid - No Scroll, Show All */}
                {(!dateFrom || !dateTo) ? (
                  <div className="text-center p-12 border border-dashed border-gray-300 rounded-lg">
                    <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-600 mb-2">Select Date Range First</h3>
                    <p className="text-gray-500">Choose date type, from and to dates to see eligible suppliers</p>
                  </div>
                ) : filteredSuppliers.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredSuppliers.map((supplier: any) => (
                      <div
                        key={supplier.id}
                        className="border rounded-lg p-4 hover:bg-blue-50 hover:border-blue-300 transition-all cursor-pointer"
                        onClick={() => handleSupplierToggle(supplier.name)}
                      >
                        <div className="flex items-start space-x-3">
                          <input
                            type="checkbox"
                            checked={selectedSuppliers.includes(supplier.name)}
                            onChange={() => handleSupplierToggle(supplier.name)}
                            className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 truncate">{supplier.name}</h4>
                            {supplier.gstin && (
                              <p className="text-sm text-green-600 mt-1">GSTIN: {supplier.gstin}</p>
                            )}
                            {supplier.address && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{supplier.address}</p>
                            )}
                            {supplier.tradeName && supplier.tradeName !== supplier.name && (
                              <p className="text-xs text-blue-600 mt-1">Trade: {supplier.tradeName}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-8 border border-dashed border-gray-300 rounded-lg">
                    <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-600 mb-2">No Suppliers Found</h3>
                    <p className="text-gray-500">No suppliers match your current search and date criteria</p>
                  </div>
                )}
              </div>

              {/* Two Column Layout: Supplier | Buyer */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Supplier Details - Left Side */}
                <div className="space-y-6 p-6 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center space-x-2 mb-4">
                    <Building className="h-5 w-5 text-green-600" />
                    <h3 className="text-lg font-semibold text-green-800">Supplier Details</h3>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="supplierGSTIN" className="text-sm font-medium text-gray-700">
                        Supplier GSTIN * <span className="text-xs text-green-600">(auto-fills details)</span>
                      </Label>
                      <Input
                        type="text"
                        value={supplierGSTIN}
                        onChange={(e) => handleSupplierGSTINChange(e.target.value)}
                        placeholder="Enter 15-digit supplier GSTIN"
                        className="w-full"
                        maxLength={15}
                      />
                      {supplierTradeName && (
                        <p className="text-xs text-green-600 mt-1">✓ {supplierTradeName}</p>
                      )}
                    </div>

                    {!supplierTradeName && (
                      <div className="border border-yellow-200 bg-yellow-50 p-3 rounded">
                        <Label htmlFor="supplierTradeName" className="text-sm font-medium text-gray-700">
                          Supplier Trade Name *
                        </Label>
                        <Input
                          type="text"
                          value={supplierTradeName}
                          onChange={(e) => setSupplierTradeName(e.target.value)}
                          placeholder="Enter supplier trade name"
                          className="w-full mt-1"
                        />
                      </div>
                    )}

                    <div>
                      <Label htmlFor="supplierAddress" className="text-sm font-medium text-gray-700">
                        Supplier Address *
                      </Label>
                      <Input
                        type="text"
                        value={supplierAddress}
                        onChange={(e) => setSupplierAddress(e.target.value)}
                        placeholder="Enter supplier billing address"
                        className="w-full"
                      />
                    </div>

                    {placeOfSupply && (
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Place of Supply</Label>
                        <div className="p-2 bg-white border rounded text-sm text-gray-600">
                          {placeOfSupply}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Buyer Details - Right Side */}
                <div className="space-y-6 p-6 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center space-x-2 mb-4">
                    <User className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-blue-800">Buyer Details</h3>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="buyerGSTIN" className="text-sm font-medium text-gray-700">
                        Buyer GSTIN * <span className="text-xs text-blue-600">(auto-fills details)</span>
                      </Label>
                      <Input
                        type="text"
                        value={buyerGSTIN}
                        onChange={(e) => handleBuyerGSTINChange(e.target.value)}
                        placeholder="Enter 15-digit buyer GSTIN"
                        className="w-full"
                        maxLength={15}
                      />
                      {buyerName && (
                        <p className="text-xs text-blue-600 mt-1">✓ {buyerName}</p>
                      )}
                    </div>

                    {!buyerName && (
                      <div className="border border-yellow-200 bg-yellow-50 p-3 rounded">
                        <Label htmlFor="buyerName" className="text-sm font-medium text-gray-700">
                          Buyer Company Name *
                        </Label>
                        <Input
                          type="text"
                          value={buyerName}
                          onChange={(e) => setBuyerName(e.target.value)}
                          placeholder="Enter buyer company name"
                          className="w-full mt-1"
                        />
                      </div>
                    )}

                    <div>
                      <Label htmlFor="buyerAddress" className="text-sm font-medium text-gray-700">
                        Buyer Address *
                      </Label>
                      <Input
                        type="text"
                        value={buyerAddress}
                        onChange={(e) => setBuyerAddress(e.target.value)}
                        placeholder="Enter buyer company address"
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Advanced Options (Collapsible) */}
              <Collapsible open={showAdvancedOptions} onOpenChange={setShowAdvancedOptions}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full flex items-center justify-center space-x-2">
                    {showAdvancedOptions ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        <span>Hide Advanced Options</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        <span>Show Advanced Options</span>
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-6 mt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="supplierShipToAddress" className="text-sm font-medium text-gray-700">
                        Supplier Ship To Address
                      </Label>
                      <Input
                        type="text"
                        value={supplierShipToAddress}
                        onChange={(e) => setSupplierShipToAddress(e.target.value)}
                        placeholder="Leave blank to use supplier address"
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="shipToAddress" className="text-sm font-medium text-gray-700">
                        Ship To Address
                      </Label>
                      <Input
                        type="text"
                        value={shipToAddress}
                        onChange={(e) => setShipToAddress(e.target.value)}
                        placeholder="Leave blank to use buyer address"
                        className="w-full"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="placeOfSupply" className="text-sm font-medium text-gray-700">
                      Place of Supply
                    </Label>
                    <Input
                      type="text"
                      value={placeOfSupply}
                      onChange={(e) => setPlaceOfSupply(e.target.value)}
                      placeholder="Auto-detected from GSTIN"
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="termsAndConditions" className="text-sm font-medium text-gray-700">
                      Terms and Conditions
                    </Label>
                    <textarea
                      value={termsAndConditions}
                      onChange={(e) => setTermsAndConditions(e.target.value)}
                      placeholder="Enter custom terms and conditions"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Generate Button */}
            <div className="flex justify-center">
              <Button
                onClick={generateInvoice}
                disabled={isGenerating}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
              >
                {isGenerating ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Generating...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Receipt className="h-5 w-5" />
                    <span>Generate GST Invoice</span>
                  </div>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Generated Invoice Preview */}
        {generatedInvoice && (
          <Card className="border-2 border-green-200 shadow-xl">
            <CardHeader className="bg-green-600 text-white rounded-t-lg">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Building className="h-6 w-6" />
                  <span>GST Invoice Preview</span>
                </div>
                <Button
                  onClick={downloadInvoice}
                  variant="outline"
                  className="bg-white text-green-600 hover:bg-green-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Invoice
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                {/* Invoice Header */}
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-gray-900">GST INVOICE</h2>
                  <p className="text-gray-600">Invoice No: {generatedInvoice.invoiceNumber}</p>
                  <p className="text-gray-600">Date: {new Date(generatedInvoice.invoiceDate).toLocaleDateString()}</p>
                </div>

                {/* Place of Supply */}
                {generatedInvoice.placeOfSupply && (
                  <div className="text-center mb-4 p-3 bg-blue-50 rounded-lg">
                    <p className="font-semibold text-blue-800">Place of Supply: {generatedInvoice.placeOfSupply}</p>
                  </div>
                )}

                {/* Billing Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="border border-gray-300 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center border-b border-gray-200 pb-2">
                      <FileText className="h-4 w-4 mr-2" />
                      Supplier Details (Bill From)
                    </h3>
                    <div className="space-y-2">
                      <p className="font-medium">{generatedInvoice.supplierTradeName || generatedInvoice.supplierName}</p>
                      {generatedInvoice.supplierAddress && (
                        <p className="text-sm text-gray-700">{generatedInvoice.supplierAddress}</p>
                      )}
                      <p className="text-sm text-gray-600"><strong>GSTIN:</strong> {generatedInvoice.supplierGSTIN}</p>
                    </div>
                  </div>
                  <div className="border border-gray-300 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center border-b border-gray-200 pb-2">
                      <Building className="h-4 w-4 mr-2" />
                      Buyer Details (Bill To)
                    </h3>
                    <div className="space-y-2">
                      <p className="font-medium">{generatedInvoice.buyerName}</p>
                      {generatedInvoice.buyerAddress && (
                        <p className="text-sm text-gray-700">{generatedInvoice.buyerAddress}</p>
                      )}
                      <p className="text-sm text-gray-600"><strong>GSTIN:</strong> {generatedInvoice.buyerGSTIN}</p>
                    </div>
                  </div>
                </div>


                {/* Invoice Items */}
                <div className="overflow-x-auto mb-6">
                  <table className="w-full border border-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border border-gray-300 px-4 py-2 text-left">S.No</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Product Name</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">HSN</th>
                        <th className="border border-gray-300 px-4 py-2 text-right">Qty</th>
                        <th className="border border-gray-300 px-4 py-2 text-right">Unit Price</th>
                        <th className="border border-gray-300 px-4 py-2 text-right">Amount</th>
                        <th className="border border-gray-300 px-4 py-2 text-right">GST%</th>
                        <th className="border border-gray-300 px-4 py-2 text-right">GST Amount</th>
                        <th className="border border-gray-300 px-4 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedInvoice.items.map((item, index) => (
                        <tr key={index}>
                          <td className="border border-gray-300 px-4 py-2">{index + 1}</td>
                          <td className="border border-gray-300 px-4 py-2">{item.productName}</td>
                          <td className="border border-gray-300 px-4 py-2">{item.hsn}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">{item.quantity}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">₹{item.unitPrice.toFixed(2)}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">₹{item.amount.toFixed(2)}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">{item.gstRate}%</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">₹{item.gstAmount.toFixed(2)}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right font-medium">₹{item.totalAmount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="border border-gray-300 p-4 bg-gray-50 mb-6">
                  <div className="text-right space-y-2">
                    <p>Total Amount (Before GST): <span className="font-medium">₹{generatedInvoice.totalAmountBeforeGST.toFixed(2)}</span></p>
                    <p>Total GST Amount: <span className="font-medium">₹{generatedInvoice.totalGSTAmount.toFixed(2)}</span></p>
                    <p className="text-lg font-bold">Total Amount (After GST): <span className="text-green-600">₹{generatedInvoice.totalAmountAfterGST.toFixed(2)}</span></p>
                  </div>
                </div>

                {/* Terms and Conditions */}
                {generatedInvoice.termsAndConditions && (
                  <div className="border border-gray-300 p-4 rounded-lg mb-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Terms & Conditions:</h4>
                    <div className="space-y-1">
                      {generatedInvoice.termsAndConditions.split('\n').map((term, index) => (
                        <p key={index} className="text-sm text-gray-700">• {term}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Computer Generated Notice */}
                <div className="text-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm font-medium text-yellow-800 italic">
                    This is a computer generated invoice, no signature required.
                  </p>
                  <p className="text-xs text-yellow-600 mt-1">
                    Generated on: {new Date().toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    );
  }
