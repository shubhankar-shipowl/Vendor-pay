import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Download, Filter, Calculator, Truck, Package, Database, Users, FileText, TrendingUp, Upload, Receipt } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from 'wouter';
import * as XLSX from 'xlsx';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';



// Payout interfaces
interface PayoutOrder {
  id: string;
  awbNo: string;
  supplierName: string;
  productName: string;
  courier: string;
  deliveredDate: string;
  deliveredQty: number;
  unitPrice: number;
  lineAmount: number;
  gstPercent: number;
  gstAmount: number;
  totalWithGst: number;
  status: string;
  currency: string;
  hsn: string;
  orderDate: string;
}

interface PayoutSummary {
  supplier: string;
  dateRange: string;
  deliveriesCount: number;
  totalDeliveredQty: number;
  totalProductCost: number;
  totalPreGstAmount: number;
  totalGstAmount: number;
  totalPostGstAmount: number;
  averageGstRate: number;
  currency: string;
  newDeliveries?: number;
  uniqueProducts: number;
  avgOrderValue: number;
}

export default function Dashboard() {
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState<string>('');
  const [datePreset, setDatePreset] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [pricingBasis, setPricingBasis] = useState<'deliveredDate' | 'orderDate'>('deliveredDate');
  const [currency, setCurrency] = useState<string>('INR');
  const [minAmount, setMinAmount] = useState<string>('');
  
  // Filter application state
  const [appliedFilters, setAppliedFilters] = useState({
    selectedSuppliers: [] as string[],
    dateFrom: '',
    dateTo: '',
    pricingBasis: 'deliveredDate' as 'deliveredDate' | 'orderDate',
    currency: 'INR',
    minAmount: ''
  });
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  const [hasUnappliedChanges, setHasUnappliedChanges] = useState(false);
  
  // Price list upload state
  const [isPriceListUploading, setIsPriceListUploading] = useState(false);
  const queryClient = useQueryClient();

  // Get suppliers for dropdown
  const { data: suppliers = [] } = useQuery({
    queryKey: ['/api/suppliers'],
    retry: 3,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
  });

  // Get orders for payout calculation
  const { data: orders = [] } = useQuery({
    queryKey: ['/api/orders'],
    retry: 3,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
  });

  // Get price entries for unit price lookup
  const { data: priceEntries = [] } = useQuery({
    queryKey: ['/api/price-entries'],
    retry: 3,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
  });
  
  // Fetch dashboard stats
  const { data: dashboardStats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 30000,
    retry: 3,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
  });

  // Get missing price entries for visibility
  const { data: missingPriceEntries = [] } = useQuery({
    queryKey: ['/api/missing-price-entries'],
    retry: 3,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
  });

  // Calculate date range based on preset
  const getDateRange = (preset: string) => {
    const today = new Date();
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    switch (preset) {
      case 'THIS_MONTH':
        return {
          from: thisMonthStart.toISOString().split('T')[0],
          to: today.toISOString().split('T')[0]
        };
      case 'LAST_30_DAYS':
        return {
          from: last30Days.toISOString().split('T')[0],
          to: today.toISOString().split('T')[0]
        };
      default:
        return { from: dateFrom, to: dateTo };
    }
  };

  // Apply date preset
  React.useEffect(() => {
    if (datePreset) {
      const range = getDateRange(datePreset);
      setDateFrom(range.from);
      setDateTo(range.to);
    }
  }, [datePreset]);

  // Calculate supplier date ranges
  const supplierDateRanges = useMemo(() => {
    const ranges = new Map<string, { firstDelivery: string; lastDelivery: string; totalOrders: number }>();
    
    if (Array.isArray(orders) && orders.length > 0 && Array.isArray(suppliers) && suppliers.length > 0) {
      const suppliersMap = new Map(suppliers.map((s: any) => [s.id, s.name]));
      
      orders.forEach((order: any) => {
        const supplierName = suppliersMap.get(order.supplierId) || order.supplierName;
        if (!supplierName || !['Delivered', 'Completed'].includes(order.status)) return;
        
        const deliveryDate = order.deliveredDate || order.orderDate || order.channelOrderDate;
        if (!deliveryDate) return;
        
        const existing = ranges.get(supplierName);
        if (!existing) {
          ranges.set(supplierName, {
            firstDelivery: deliveryDate,
            lastDelivery: deliveryDate,
            totalOrders: 1
          });
        } else {
          ranges.set(supplierName, {
            firstDelivery: deliveryDate < existing.firstDelivery ? deliveryDate : existing.firstDelivery,
            lastDelivery: deliveryDate > existing.lastDelivery ? deliveryDate : existing.lastDelivery,
            totalOrders: existing.totalOrders + 1
          });
        }
      });
    }
    
    return ranges;
  }, [orders, suppliers]);

  // Calculate supplier missing products
  const supplierMissingProducts = useMemo(() => {
    const missing = new Map<string, any[]>();
    
    if (Array.isArray(missingPriceEntries) && missingPriceEntries.length > 0) {
      missingPriceEntries.forEach((entry: any) => {
        const supplierName = entry.supplierName;
        if (!missing.has(supplierName)) {
          missing.set(supplierName, []);
        }
        missing.get(supplierName)?.push(entry);
      });
    }
    
    return missing;
  }, [missingPriceEntries]);

  // Track filter changes
  React.useEffect(() => {
    const hasChanges = (
      JSON.stringify(selectedSuppliers.sort()) !== JSON.stringify(appliedFilters.selectedSuppliers.sort()) ||
      dateFrom !== appliedFilters.dateFrom ||
      dateTo !== appliedFilters.dateTo ||
      pricingBasis !== appliedFilters.pricingBasis ||
      currency !== appliedFilters.currency ||
      minAmount !== appliedFilters.minAmount
    );
    setHasUnappliedChanges(hasChanges);
  }, [selectedSuppliers, dateFrom, dateTo, pricingBasis, currency, minAmount, appliedFilters]);

  // Calculate eligible suppliers for current date range
  const eligibleSuppliers = useMemo(() => {
    if (!dateFrom || !dateTo || !Array.isArray(orders) || !Array.isArray(suppliers) || !Array.isArray(priceEntries)) {
      return [];
    }

    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);

    const suppliersMap = new Map(suppliers.map((s: any) => [s.id, s.name]));
    const supplierPayouts = new Map();

    // Filter orders for date range and calculate payouts per supplier
    orders.forEach((order: any) => {
      const supplierName = suppliersMap.get(order.supplierId) || order.supplierName;
      if (!supplierName) return;

      const targetDate = pricingBasis === 'orderDate' ? 
        new Date(order.orderDate || order.channelOrderDate) : 
        new Date(order.deliveredDate);
      
      if (!targetDate || targetDate < fromDate || targetDate > toDate) return;
      if (order.status !== 'Delivered' && order.status !== 'Completed') return;

      const deliveredQty = parseInt(String(order.deliveredQty || order.qty || 0));
      if (deliveredQty <= 0) return;

      // Find price entry
      const priceEntry = priceEntries.find((entry: any) => 
        entry.supplierId === order.supplierId && 
        entry.productName === order.productName
      );

      if (!priceEntry || (priceEntry.unitPrice < 0 && priceEntry.price < 0)) return;

      // Use either unitPrice or price field
      const unitPriceAfterGst = parseFloat(String(priceEntry.unitPrice || priceEntry.price)) || 0;
      if (unitPriceAfterGst <= 0) return; // Skip if no valid price
      
      const gstPercent = parseFloat(String(priceEntry.gstPercent || priceEntry.gstRate)) || 18;
      const unitPriceBeforeGst = unitPriceAfterGst / (1 + gstPercent / 100);
      const lineAmount = unitPriceBeforeGst * deliveredQty;
      const gstAmount = lineAmount * (gstPercent / 100);
      const totalWithGst = lineAmount + gstAmount;

      if (!supplierPayouts.has(supplierName)) {
        supplierPayouts.set(supplierName, {
          supplierName,
          supplierId: order.supplierId,
          orderCount: 0,
          totalQty: 0,
          totalPreGstAmount: 0,
          totalGstAmount: 0,
          totalPostGstAmount: 0,
          uniqueProducts: new Set(),
          orders: []
        });
      }

      const payout = supplierPayouts.get(supplierName);
      payout.orderCount++;
      payout.totalQty += deliveredQty;
      payout.totalPreGstAmount += lineAmount;
      payout.totalGstAmount += gstAmount;
      payout.totalPostGstAmount += totalWithGst;
      payout.uniqueProducts.add(order.productName);
      payout.orders.push(order);
    });

    // Convert to array and add supplier details
    return Array.from(supplierPayouts.values()).map(payout => {
      const supplier = suppliers.find((s: any) => s.name === payout.supplierName);
      return {
        ...payout,
        uniqueProducts: payout.uniqueProducts.size,
        orderAccount: supplier?.orderAccount || 'N/A',
        avgOrderValue: payout.orderCount > 0 ? payout.totalPostGstAmount / payout.orderCount : 0
      };
    }).sort((a, b) => b.totalPostGstAmount - a.totalPostGstAmount);
  }, [dateFrom, dateTo, pricingBasis, orders, suppliers, priceEntries]);

  // Calculate order account summary for current date range and selected suppliers
  const orderAccountSummary = useMemo(() => {
    if (!dateFrom || !dateTo || selectedSuppliers.length === 0 || !Array.isArray(orders) || !Array.isArray(suppliers) || !Array.isArray(priceEntries)) {
      return [];
    }

    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);

    const suppliersMap = new Map(suppliers.map((s: any) => [s.id, s.name]));
    const orderAccountPayouts = new Map();

    // Filter orders for date range and selected suppliers, calculate payouts per order account
    orders.forEach((order: any) => {
      const supplierName = suppliersMap.get(order.supplierId) || order.supplierName;
      if (!supplierName || !selectedSuppliers.includes(supplierName)) return;

      const targetDate = pricingBasis === 'orderDate' ? 
        new Date(order.orderDate || order.channelOrderDate) : 
        new Date(order.deliveredDate);
      
      if (!targetDate || targetDate < fromDate || targetDate > toDate) return;
      if (order.status !== 'Delivered' && order.status !== 'Completed') return;

      const deliveredQty = parseInt(String(order.deliveredQty || order.qty || 0));
      if (deliveredQty <= 0) return;

      // Find price entry
      const priceEntry = priceEntries.find((entry: any) => 
        entry.supplierId === order.supplierId && 
        entry.productName === order.productName
      );

      if (!priceEntry || (priceEntry.unitPrice < 0 && priceEntry.price < 0)) return;

      // Use either unitPrice or price field
      const unitPriceAfterGst = parseFloat(String(priceEntry.unitPrice || priceEntry.price)) || 0;
      if (unitPriceAfterGst <= 0) return; // Skip if no valid price
      
      const gstPercent = parseFloat(String(priceEntry.gstPercent || priceEntry.gstRate)) || 18;
      const unitPriceBeforeGst = unitPriceAfterGst / (1 + gstPercent / 100);
      const lineAmount = unitPriceBeforeGst * deliveredQty;
      const gstAmount = lineAmount * (gstPercent / 100);
      const totalWithGst = lineAmount + gstAmount;

      // Get order account from supplier or order
      const supplier = suppliers.find((s: any) => s.name === supplierName);
      const orderAccount = supplier?.orderAccount || order.orderAccount || 'Unknown Account';

      if (!orderAccountPayouts.has(orderAccount)) {
        orderAccountPayouts.set(orderAccount, {
          orderAccount,
          orderCount: 0,
          totalQty: 0,
          totalPreGstAmount: 0,
          totalGstAmount: 0,
          totalPostGstAmount: 0,
          uniqueProducts: new Set(),
          suppliers: new Set(),
          orders: []
        });
      }

      const payout = orderAccountPayouts.get(orderAccount);
      payout.orderCount++;
      payout.totalQty += deliveredQty;
      payout.totalPreGstAmount += lineAmount;
      payout.totalGstAmount += gstAmount;
      payout.totalPostGstAmount += totalWithGst;
      payout.uniqueProducts.add(order.productName);
      payout.suppliers.add(supplierName);
      payout.orders.push(order);
    });

    // Convert to array and add calculated fields
    return Array.from(orderAccountPayouts.values()).map(payout => ({
      ...payout,
      uniqueProducts: payout.uniqueProducts.size,
      supplierCount: payout.suppliers.size,
      avgOrderValue: payout.orderCount > 0 ? payout.totalPostGstAmount / payout.orderCount : 0,
      suppliers: Array.from(payout.suppliers)
    })).sort((a, b) => b.totalPostGstAmount - a.totalPostGstAmount);
  }, [dateFrom, dateTo, selectedSuppliers, pricingBasis, orders, suppliers, priceEntries]);

  // Apply filters function
  const applyFilters = async () => {
    setIsApplyingFilters(true);
    
    // Simulate processing delay for user feedback
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setAppliedFilters({
      selectedSuppliers: [...selectedSuppliers],
      dateFrom,
      dateTo,
      pricingBasis,
      currency,
      minAmount
    });
    
    setHasUnappliedChanges(false);
    setIsApplyingFilters(false);
  };

  // Handle price list upload
  const handlePriceListUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsPriceListUploading(true);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('supplierName', selectedSuppliers[0] || '');

      // Direct fetch call for file upload (don't use apiRequest for FormData)
      const response = await fetch('/api/price-entries/bulk-upload', {
        method: 'POST',
        body: formData, // No Content-Type header - let browser set it with boundary
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.message || errorData.error || 'Upload failed');
      }

      const result = await response.json();

      if (result.success) {
        // Invalidate queries to refresh data
        await queryClient.invalidateQueries({ queryKey: ['/api/price-entries'] });
        await queryClient.invalidateQueries({ queryKey: ['/api/missing-price-entries'] });
        
        // Auto-recalculate payouts for current view
        applyFilters();
        
        alert(`Successfully uploaded ${result.processedCount || 0} price entries!`);
      } else {
        alert(result.message || 'Failed to upload price list. Please try again.');
      }
    } catch (error) {
      console.error('Price list upload error:', error);
      alert(`Error uploading price list: ${error.message}`);
    } finally {
      setIsPriceListUploading(false);
      // Reset the file input
      event.target.value = '';
    }
  };

  // Calculate payout data using applied filters
  const payoutData = useMemo(() => {
    if (!appliedFilters.selectedSuppliers.length || !appliedFilters.dateFrom || !appliedFilters.dateTo) {
      return { summary: null, payoutOrders: [], cancelledOrders: [], missingPrices: [] };
    }

    const fromDate = new Date(appliedFilters.dateFrom);
    const toDate = new Date(appliedFilters.dateTo);
    // Set toDate to end of day to include all orders on the last date
    toDate.setHours(23, 59, 59, 999);

    // Find suppliers data to map orders to supplier names
    const suppliersMap = new Map(Array.isArray(suppliers) ? suppliers.map((s: any) => [s.id, s.name]) : []);
    
    // Filter orders for selected suppliers and date range
    const filteredOrders = Array.isArray(orders) ? orders.filter((order: any) => {
      const supplierName = suppliersMap.get(order.supplierId) || order.supplierName;
      
      if (!appliedFilters.selectedSuppliers.includes(supplierName)) return false;

      const targetDate = appliedFilters.pricingBasis === 'orderDate' ? 
        new Date(order.orderDate || order.channelOrderDate) : 
        new Date(order.deliveredDate);
      
      return targetDate >= fromDate && targetDate <= toDate;
    }) : [];

    // Separate delivered/completed vs cancelled orders
    const payableOrders = filteredOrders.filter(order => 
      ['Delivered', 'Completed'].includes(order.status)
    );

    const cancelledOrders = filteredOrders.filter(order => 
      ['Cancelled', 'RTO', 'Lost'].includes(order.status)
    );

    // Create price entries map for quick lookup (with fallback by product name)
    const exactPriceMap = new Map<string, any>(); // supplier + product
    const productPriceMap = new Map<string, any>(); // product name only (fallback)
    
    if (Array.isArray(priceEntries)) {
      priceEntries.forEach((entry: any) => {
        const exactKey = `${entry.supplierId}-${entry.productName}`;
        const productKey = entry.productName;
        
        // Store exact match (supplier + product)
        exactPriceMap.set(exactKey, entry);
        
        // Store by product name only (for fallback lookup)
        if (!productPriceMap.has(productKey)) {
          productPriceMap.set(productKey, entry);
        }
      });
    }

    const payoutOrders: PayoutOrder[] = [];
    const missingPrices: any[] = [];

    // Process payable orders
    payableOrders.forEach(order => {
      const exactPriceKey = `${order.supplierId}-${order.productName}`;
      const productOnlyKey = order.productName;
      
      // Try exact match first (supplier + product), then fallback to product name only
      const priceEntry = exactPriceMap.get(exactPriceKey) || productPriceMap.get(productOnlyKey);

      const deliveredQty = parseInt(order.qty) || 1;
      
      // Get pricing info from price entry
      const unitPriceBeforeGst = parseFloat(priceEntry?.priceBeforeGst) || 0; // Unit price (before GST)
      const unitPriceAfterGst = parseFloat(priceEntry?.price) || 0; // Final price after GST
      const gstPercent = parseFloat(priceEntry?.gstRate) || 18; // Actual GST rate from price entry
      
      // Calculate line amounts (using before-GST pricing)
      const lineAmount = deliveredQty * unitPriceBeforeGst; // Line amount before GST
      const gstAmount = (lineAmount * gstPercent) / 100; // GST amount calculated from line amount
      const totalWithGst = lineAmount + gstAmount; // Total including GST



      if (unitPriceBeforeGst === 0) {
        missingPrices.push({
          supplierName: suppliersMap.get(order.supplierId) || 'Unknown',
          productName: order.productName,
          hsn: order.hsn,
          orderQty: deliveredQty,
          awbNo: order.awbNo,
          orderDate: order.orderDate || order.channelOrderDate
        });
      } else {
        payoutOrders.push({
          id: order.id,
          awbNo: order.awbNo,
          supplierName: suppliersMap.get(order.supplierId) || 'Unknown',
          productName: order.productName,
          courier: order.courier || '',
          orderAccount: order.orderAccount || null,
          deliveredDate: order.deliveredDate || order.orderDate || order.channelOrderDate,
          deliveredQty,
          unitPrice: unitPriceBeforeGst,
          lineAmount,
          gstPercent,
          gstAmount,
          totalWithGst,
          status: order.status,
          currency: order.currency || appliedFilters.currency,
          hsn: order.hsn || priceEntry?.hsn || '',
          orderDate: order.orderDate || order.channelOrderDate
        });
      }
    });

    // Enhanced summary calculation with proper GST breakdown
    const totalDeliveredQty = payoutOrders.reduce((sum, order) => sum + order.deliveredQty, 0);
    const totalPreGstAmount = payoutOrders.reduce((sum, order) => sum + order.lineAmount, 0); // Line amount is before GST
    const totalGstAmount = payoutOrders.reduce((sum, order) => sum + order.gstAmount, 0);
    const totalPostGstAmount = payoutOrders.reduce((sum, order) => sum + order.totalWithGst, 0); // Total with GST
    const uniqueProducts = new Set(payoutOrders.map(order => order.productName)).size;

    const summary: PayoutSummary = {
      supplier: appliedFilters.selectedSuppliers.length === 1 
        ? appliedFilters.selectedSuppliers[0] 
        : `${appliedFilters.selectedSuppliers.length} Suppliers Combined`,
      dateRange: `${appliedFilters.dateFrom} to ${appliedFilters.dateTo}`,
      deliveriesCount: payoutOrders.length,
      totalDeliveredQty,
      totalProductCost: totalPostGstAmount, // Keep backward compatibility
      totalPreGstAmount,
      totalGstAmount,
      totalPostGstAmount,
      averageGstRate: payoutOrders.length > 0 ? 
        payoutOrders.reduce((sum, order) => sum + order.gstPercent, 0) / payoutOrders.length : 0,
      currency: appliedFilters.currency,
      uniqueProducts,
      avgOrderValue: payoutOrders.length > 0 ? totalPostGstAmount / payoutOrders.length : 0,
      newDeliveries: payoutOrders.filter(order => {
        const deliveredDate = new Date(order.deliveredDate);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        return deliveredDate >= cutoffDate;
      }).length
    };

    return { summary, payoutOrders, cancelledOrders, missingPrices };
  }, [appliedFilters, orders, suppliers, priceEntries]);

  // Helper function to calculate missing prices for specific supplier (bulk price management style)
  const calculateSupplierMissingPrices = (supplierName: string, orders: any[], priceEntries: any[], suppliers: any[]) => {
    if (!supplierName || !Array.isArray(orders) || !Array.isArray(priceEntries) || !Array.isArray(suppliers)) {
      return [];
    }

    // Find the supplier ID
    const supplier = suppliers.find((s: any) => s.name === supplierName);
    if (!supplier) return [];

    // Create a map of existing price entries for this supplier
    const existingPrices = new Map();
    priceEntries.forEach((entry: any) => {
      if (entry.supplierId === supplier.id) {
        const key = `${entry.supplierId}-${entry.productName}`;
        existingPrices.set(key, true);
      }
    });

    // Find unique supplier-product combinations from orders for this supplier only
    const combinations = new Map();
    orders.forEach((order: any) => {
      const orderSupplierName = suppliers.find((s: any) => s.id === order.supplierId)?.name || order.supplierName;
      
      // Only process orders for the selected supplier
      if (orderSupplierName === supplierName) {
        const key = `${supplierName}-${order.productName}`;
        if (!combinations.has(key)) {
          combinations.set(key, {
            supplierName: supplierName,
            productName: order.productName,
            orderCount: 1,
            supplierProductId: `${supplierName}${order.productName}`
          });
        } else {
          const existing = combinations.get(key);
          existing.orderCount += 1;
        }
      }
    });

    // Filter out combinations that already have price entries
    const missing: any[] = [];
    combinations.forEach((combo, key) => {
      const priceKey = `${supplier.id}-${combo.productName}`;
      
      if (!existingPrices.has(priceKey)) {
        missing.push(combo);
      }
    });

    return missing;
  };

  // Export function
  const exportPayoutData = (type: string) => {
    const payoutOrders = payoutData.payoutOrders;
    let worksheetData: any[] = [];
    let filename = '';

    switch (type) {
      case 'export':
        const selectedSupplierData = Array.isArray(suppliers) && selectedSuppliers.length > 0 ? suppliers.find((s: any) => s.name === selectedSuppliers[0]) : null;
        const supplierOrderAccount = selectedSupplierData?.orderAccount || 'Not Available';
        
        worksheetData = [
          ['AWB No', 'Supplier Name', 'Order Account', 'Courier', 'HSN', 'Product Name', 'Qty', 'Product Price (INR)', 'Line Amount (INR)', 'GST%', 'GST Amount (INR)', 'Price After GST (INR)', 'Delivered Date', 'Status'],
          ...payoutOrders.map(order => [
            order.awbNo,
            order.supplierName,
            order.orderAccount || 'N/A',
            order.courier,
            order.hsn,
            order.productName,
            order.deliveredQty,
            (parseFloat(String(order.unitPrice)) || 0).toFixed(2),
            (parseFloat(String(order.lineAmount)) || 0).toFixed(2),
            `${order.gstPercent}%`,
            (parseFloat(String(order.gstAmount)) || 0).toFixed(2),
            (parseFloat(String(order.totalWithGst)) || 0).toFixed(2),
            order.deliveredDate,
            order.status
          ])
        ];
        const suppliersText = appliedFilters.selectedSuppliers.length > 1 ? `${appliedFilters.selectedSuppliers.length}Suppliers` : appliedFilters.selectedSuppliers[0] || 'NoSupplier';
        filename = `Payout_Export_${suppliersText}_${appliedFilters.dateFrom}_${appliedFilters.dateTo}.xlsx`;
        break;

      case 'summary':
        const selectedSupplierDataSummary = Array.isArray(suppliers) && selectedSuppliers.length > 0 ? suppliers.find((s: any) => s.name === selectedSuppliers[0]) : null;
        const supplierOrderAccountSummary = selectedSupplierDataSummary?.orderAccount || 'Not Available';
        
        worksheetData = [
          ['Supplier Name', 'Order Account', 'Date Range', 'Total Deliveries', 'Total Qty', 'Unique Products', 'Amount Before GST', 'GST Amount', 'Total Amount with GST', 'Average GST Rate', 'Average Order Value'],
          [
            payoutData.summary?.supplier || '',
            supplierOrderAccountSummary,
            payoutData.summary?.dateRange || '',
            payoutData.summary?.deliveriesCount || 0,
            payoutData.summary?.totalDeliveredQty || 0,
            payoutData.summary?.uniqueProducts || 0,
            (parseFloat(String(payoutData.summary?.totalPreGstAmount || 0))).toFixed(2),
            (parseFloat(String(payoutData.summary?.totalGstAmount || 0))).toFixed(2),
            (parseFloat(String(payoutData.summary?.totalPostGstAmount || 0))).toFixed(2),
            `${(parseFloat(String(payoutData.summary?.averageGstRate || 0))).toFixed(2)}%`,
            (parseFloat(String(payoutData.summary?.avgOrderValue || 0))).toFixed(2)
          ]
        ];
        const suppliersSummaryText = appliedFilters.selectedSuppliers.length > 1 ? `${appliedFilters.selectedSuppliers.length}Suppliers` : appliedFilters.selectedSuppliers[0] || 'NoSupplier';
        filename = `Enhanced_Payout_Summary_${suppliersSummaryText}_${appliedFilters.dateFrom}_${appliedFilters.dateTo}.xlsx`;
        break;

      case 'lines':
        const selectedSupplierDataLines = Array.isArray(suppliers) && selectedSuppliers.length > 0 ? suppliers.find((s: any) => s.name === selectedSuppliers[0]) : null;
        const supplierOrderAccountLines = selectedSupplierDataLines?.orderAccount || 'Not Available';
        
        worksheetData = [
          ['Supplier Name', 'Order Account', 'Product Name', 'AWB No', 'Courier', 'Delivered Date', 'Delivered Qty', 'Product Cost (INR)', 'Line Amount (INR)', 'GST%', 'GST Amount (INR)', 'Price After GST (INR)', 'Status', 'Currency', 'HSN'],
          ...payoutOrders.map(order => [
            order.supplierName,
            order.orderAccount || 'N/A',
            order.productName,
            order.awbNo,
            order.courier,
            order.deliveredDate,
            order.deliveredQty,
            (parseFloat(String(order.unitPrice)) || 0).toFixed(2),
            (parseFloat(String(order.lineAmount)) || 0).toFixed(2),
            `${order.gstPercent}%`,
            (parseFloat(String(order.gstAmount)) || 0).toFixed(2),
            (parseFloat(String(order.totalWithGst)) || 0).toFixed(2),
            order.status,
            order.currency,
            order.hsn
          ])
        ];
        const suppliersLinesText = appliedFilters.selectedSuppliers.length > 1 ? `${appliedFilters.selectedSuppliers.length}Suppliers` : appliedFilters.selectedSuppliers[0] || 'NoSupplier';
        filename = `Payout_Lines_${suppliersLinesText}_${appliedFilters.dateFrom}_${appliedFilters.dateTo}.xlsx`;
        break;

      case 'cancelled':
        worksheetData = [
          ['AWB No', 'Order Account', 'Supplier Name', 'Product Name', 'Order Date', 'Status', 'Reason'],
          ...payoutData.cancelledOrders.map(order => [
            order.awbNo,
            order.orderAccount || 'N/A',
            order.supplierName || 'Unknown',
            order.productName,
            order.orderDate,
            order.status,
            'Order Cancelled/RTO'
          ])
        ];
        const suppliersCancelledText = appliedFilters.selectedSuppliers.length > 1 ? `${appliedFilters.selectedSuppliers.length}Suppliers` : appliedFilters.selectedSuppliers[0] || 'NoSupplier';
        filename = `Cancelled_Orders_${suppliersCancelledText}_${appliedFilters.dateFrom}_${appliedFilters.dateTo}.xlsx`;
        break;

      case 'missing':
        // Calculate missing prices using bulk price management logic for selected supplier
        const supplierMissingPrices = selectedSuppliers.length > 0 ? calculateSupplierMissingPrices(selectedSuppliers[0], orders, priceEntries, suppliers) : [];
        
        console.log(`🔍 Debug Missing Prices Export:`, supplierMissingPrices.length, 'items');
        console.log(`📋 Sample missing price data:`, supplierMissingPrices.slice(0, 3));
        
        worksheetData = [
          ['Supplier Name', 'Product Name', 'Order Count', 'Supplier Product ID', 'Price Before GST (INR)', 'GST Rate (%)', 'Price After GST (INR)', 'HSN Code', 'Currency', 'Effective From (YYYY-MM-DD)', 'Effective To (YYYY-MM-DD)'],
          ...supplierMissingPrices.map(item => [
            item.supplierName,
            item.productName,
            item.orderCount,
            item.supplierProductId,
            '', // Price Before GST - empty for user to fill
            '', // GST Rate - empty for user to fill  
            '', // Price After GST - will be calculated
            '', // HSN - empty for user to fill
            'INR',
            new Date().toISOString().split('T')[0], // Today's date
            '' // Effective To - empty
          ])
        ];
        const suppliersMissingText = appliedFilters.selectedSuppliers.length > 1 ? `${appliedFilters.selectedSuppliers.length}Suppliers` : appliedFilters.selectedSuppliers[0] || 'NoSupplier';
        filename = `Missing_Prices_${suppliersMissingText}_${appliedFilters.dateFrom}_${appliedFilters.dateTo}.xlsx`;
        break;

      default:
        return;
    }

    // Create Excel workbook and worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payout Data');

    // Set column widths for better readability
    const maxColWidths = worksheetData[0].map(() => 10);
    worksheetData.forEach(row => {
      row.forEach((cell: any, colIndex: number) => {
        const cellLength = String(cell || '').length;
        if (cellLength > maxColWidths[colIndex]) {
          maxColWidths[colIndex] = Math.min(cellLength + 2, 50);
        }
      });
    });

    worksheet['!cols'] = maxColWidths.map((width: number) => ({ width }));

    // Generate Excel file and download
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Professional Header */}
      <div className="bg-white shadow-lg border-b-4 border-blue-500">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Calculator className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Supplier Payout Dashboard</h1>
                <p className="text-blue-600 font-medium">Professional Payout Calculation & Management System</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">Asia/Kolkata Timezone</p>
                <p className="text-lg font-semibold text-gray-900">{new Date().toLocaleDateString()}</p>
              </div>
              <div className="flex space-x-2">
                <Link href="/data-management">
                  <Button variant="outline" size="sm" className="flex items-center space-x-2">
                    <Database className="h-4 w-4" />
                    <span>Data Management</span>
                  </Button>
                </Link>
                <Link href="/price-management">
                  <Button variant="outline" size="sm" className="flex items-center space-x-2">
                    <Calculator className="h-4 w-4" />
                    <span>Price Management</span>
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Quick Stats */}
        {(dashboardStats as any) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-2 border-blue-200 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-600">Total Orders</CardTitle>
                <Package className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-900">
                  {((dashboardStats as any)?.totalOrders?.toLocaleString() || '0') as React.ReactNode}
                </div>
                <p className="text-xs text-blue-600">Processed orders</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-green-200 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-600">Suppliers</CardTitle>
                <Truck className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-900">
                  {(dashboardStats as any)?.totalSuppliers || '0'}
                </div>
                <p className="text-xs text-green-600">Active vendors</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-purple-200 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-purple-600">Products</CardTitle>
                <Package className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-900">
                  {(dashboardStats as any)?.uniqueProducts || '0'}
                </div>
                <p className="text-xs text-purple-600">Unique products</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-orange-200 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-orange-600">Average Value</CardTitle>
                <TrendingUp className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-900">
                  ₹{((dashboardStats as any)?.averageOrderValue || 0).toFixed(2)}
                </div>
                <p className="text-xs text-orange-600">Per order</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/supplier-performance">
            <Card className="border-2 border-blue-200 hover:border-blue-400 transition-colors cursor-pointer shadow-lg hover:shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center space-x-3 text-blue-700">
                  <Users className="h-6 w-6" />
                  <span>Supplier Performance</span>
                </CardTitle>
                <CardDescription>
                  Track supplier metrics and performance analytics
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/reports">
            <Card className="border-2 border-purple-200 hover:border-purple-400 transition-colors cursor-pointer shadow-lg hover:shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center space-x-3 text-purple-700">
                  <FileText className="h-6 w-6" />
                  <span>Reports & Analytics</span>
                </CardTitle>
                <CardDescription>
                  Generate comprehensive reports and export data
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/data-management">
            <Card className="border-2 border-gray-200 hover:border-gray-400 transition-colors cursor-pointer shadow-lg hover:shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center space-x-3 text-gray-700">
                  <Database className="h-6 w-6" />
                  <span>Data Management</span>
                </CardTitle>
                <CardDescription>
                  Upload and manage order data with transparency tools
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/gst-invoice">
            <Card className="border-2 border-indigo-200 hover:border-indigo-400 transition-colors cursor-pointer shadow-lg hover:shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center space-x-3 text-indigo-700">
                  <Receipt className="h-6 w-6" />
                  <span>GST Invoice</span>
                </CardTitle>
                <CardDescription>
                  Generate compliant GST invoices for supplier payouts
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>

        {/* Payout Tool Section */}
        <Card className="border-2 border-gradient-to-r from-blue-200 to-green-200 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center space-x-3 text-xl">
              <Calculator className="h-6 w-6" />
              <span>Supplier Payout Calculator</span>
            </CardTitle>
            <CardDescription className="text-blue-100">
              Calculate and export supplier payouts with GST calculations
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            {/* Date Range Controls - Top Priority */}
            <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border-2 border-blue-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                  📅 Select Date Range
                </h3>
                {(dateFrom || dateTo) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDateFrom('');
                      setDateTo('');
                      setDatePreset('');
                    }}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                    data-testid="button-clear-dates"
                  >
                    🗑️ Clear Dates
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="datePreset" className="text-sm font-medium text-gray-700">
                    Quick Select
                  </Label>
                  <Select value={datePreset} onValueChange={setDatePreset}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose preset..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="THIS_MONTH">This Month</SelectItem>
                      <SelectItem value="LAST_30_DAYS">Last 30 Days</SelectItem>
                      <SelectItem value="LAST_7_DAYS">Last 7 Days</SelectItem>
                      <SelectItem value="YESTERDAY">Yesterday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="dateFrom" className="text-sm font-medium text-gray-700">
                    From Date
                  </Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setDatePreset(''); // Clear preset when manual date is selected
                    }}
                    className="w-full"
                    data-testid="input-date-from"
                  />
                </div>

                <div>
                  <Label htmlFor="dateTo" className="text-sm font-medium text-gray-700">
                    To Date
                  </Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setDatePreset(''); // Clear preset when manual date is selected
                    }}
                    className="w-full"
                    data-testid="input-date-to"
                  />
                </div>
              </div>

              {dateFrom && dateTo && (
                <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                  <div className="text-sm text-blue-800">
                    <strong>Selected Range:</strong> {new Date(dateFrom).toLocaleDateString()} to {new Date(dateTo).toLocaleDateString()}
                    <span className="ml-2 text-xs">
                      ({Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24))} days)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Other Filter Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="md:col-span-2">
                <Label className="text-sm font-medium text-gray-700">
                  Select Suppliers ({selectedSuppliers.length} selected)
                </Label>
                <div className="border rounded-lg bg-white">
                  {/* Date Range Info */}
                  {dateFrom && dateTo && (
                    <div className="p-3 bg-blue-50 border-b">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-sm font-medium text-blue-800">
                            📅 Showing suppliers for: {new Date(dateFrom).toLocaleDateString()} - {new Date(dateTo).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-blue-600">
                            {eligibleSuppliers.length} supplier{eligibleSuppliers.length !== 1 ? 's' : ''} with deliveries • Total payable: ₹{eligibleSuppliers.reduce((sum, s) => sum + s.totalPostGstAmount, 0).toFixed(2)}
                          </div>
                        </div>
                        {eligibleSuppliers.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Select all eligible suppliers
                              const allNames = eligibleSuppliers.map(s => s.supplierName);
                              setSelectedSuppliers(allNames);
                            }}
                            className="text-xs"
                            data-testid="button-select-all-eligible"
                          >
                            Select All ({eligibleSuppliers.length})
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Search Input */}
                  <div className="p-3 border-b">
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="Search suppliers..."
                        value={supplierSearchTerm}
                        onChange={(e) => setSupplierSearchTerm(e.target.value)}
                        className="pl-8"
                        data-testid="input-supplier-search"
                      />
                      <div className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400">
                        🔍
                      </div>
                      {supplierSearchTerm && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSupplierSearchTerm('')}
                          className="absolute right-1 top-1 h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                          data-testid="button-clear-search"
                        >
                          ✕
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Supplier List */}
                  <div className="p-3">
                    {dateFrom && dateTo ? (
                      eligibleSuppliers.length > 0 ? (
                        (() => {
                          const filteredSuppliers = eligibleSuppliers.filter((supplier: any) => 
                            supplier.supplierName.toLowerCase().includes(supplierSearchTerm.toLowerCase()) ||
                            (supplier.orderAccount && supplier.orderAccount.toLowerCase().includes(supplierSearchTerm.toLowerCase()))
                          );
                          
                          return filteredSuppliers.length > 0 ? (
                            <div className="space-y-2">
                              {filteredSuppliers.map((supplier: any) => (
                                <div key={supplier.supplierId} className="flex items-start space-x-2 p-3 hover:bg-gray-50 rounded border">
                                  <input
                                    type="checkbox"
                                    id={`supplier-${supplier.supplierId}`}
                                    checked={selectedSuppliers.includes(supplier.supplierName)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedSuppliers(prev => [...prev, supplier.supplierName]);
                                      } else {
                                        setSelectedSuppliers(prev => prev.filter(name => name !== supplier.supplierName));
                                      }
                                    }}
                                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    data-testid={`checkbox-supplier-${supplier.supplierId}`}
                                  />
                                  <label htmlFor={`supplier-${supplier.supplierId}`} className="flex-1 cursor-pointer">
                                    <div className="font-medium text-gray-900">{supplier.supplierName}</div>
                                    {supplier.orderAccount && supplier.orderAccount !== 'N/A' && (
                                      <div className="text-xs text-green-600 font-medium">
                                        📊 {supplier.orderAccount}
                                      </div>
                                    )}
                                    <div className="text-xs text-gray-600 mt-1">
                                      <span className="font-medium">{supplier.orderCount} orders</span> • 
                                      <span className="font-medium"> Qty: {supplier.totalQty}</span> • 
                                      <span className="font-medium"> Products: {supplier.uniqueProducts}</span>
                                    </div>
                                    <div className="text-sm font-semibold text-green-700 mt-1">
                                      💰 Payable: ₹{supplier.totalPostGstAmount.toFixed(2)}
                                      <span className="text-xs text-gray-500 ml-2">
                                        (₹{supplier.totalPreGstAmount.toFixed(2)} + ₹{supplier.totalGstAmount.toFixed(2)} GST)
                                      </span>
                                    </div>
                                  </label>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-gray-500 text-sm text-center py-4">
                              No suppliers found matching "{supplierSearchTerm}"
                            </div>
                          );
                        })()
                      ) : (
                        <div className="text-center py-6">
                          <div className="text-gray-400 text-4xl mb-2">📭</div>
                          <div className="text-gray-600 font-medium">No suppliers with deliveries</div>
                          <div className="text-gray-500 text-sm">No orders found in the selected date range</div>
                        </div>
                      )
                    ) : (
                      <div className="text-center py-6">
                        <div className="text-gray-400 text-4xl mb-2">📅</div>
                        <div className="text-gray-600 font-medium">Select Date Range First</div>
                        <div className="text-gray-500 text-sm">Choose from and to dates to see eligible suppliers</div>
                      </div>
                    )}
                  </div>
                  
                  {/* Selection Summary */}
                  {selectedSuppliers.length > 0 && (
                    <div className="p-3 border-t bg-gray-50">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">
                          {selectedSuppliers.length} supplier{selectedSuppliers.length !== 1 ? 's' : ''} selected
                        </span>
                        <div className="flex space-x-2">
                          {supplierSearchTerm && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSupplierSearchTerm('')}
                              className="text-xs"
                              data-testid="button-clear-search-summary"
                            >
                              Clear Search
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedSuppliers([])}
                            className="text-xs"
                            data-testid="button-clear-suppliers"
                          >
                            Clear All
                          </Button>
                        </div>
                      </div>
                      {/* Show selected suppliers when searched */}
                      {supplierSearchTerm && selectedSuppliers.length > 0 && (
                        <div className="mt-2 text-xs text-blue-600">
                          Selected: {selectedSuppliers.slice(0, 3).join(', ')}
                          {selectedSuppliers.length > 3 && ` +${selectedSuppliers.length - 3} more`}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div>
                <Label htmlFor="pricingBasis" className="text-sm font-medium text-gray-700">
                  Pricing Basis
                </Label>
                <Select value={pricingBasis} onValueChange={(value: 'deliveredDate' | 'orderDate') => setPricingBasis(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deliveredDate">Delivered Date</SelectItem>
                    <SelectItem value="orderDate">Order Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="currency" className="text-sm font-medium text-gray-700">
                  Currency
                </Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR (₹)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="minAmount" className="text-sm font-medium text-gray-700">
                  Min Amount Filter
                </Label>
                <Input
                  type="number"
                  placeholder="Optional"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                />
              </div>
            </div>

            {/* Apply Filters Button */}
            <div className="mb-8 flex justify-center">
              <Button 
                onClick={applyFilters}
                disabled={!dateFrom || !dateTo || isApplyingFilters}
                size="lg"
                className={`px-8 py-3 font-semibold transition-all ${
                  hasUnappliedChanges 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white animate-pulse' 
                    : 'bg-gray-400 text-gray-600'
                } ${isApplyingFilters ? 'bg-blue-500' : ''}`}
                data-testid="button-apply-filters"
              >
                {isApplyingFilters ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Applying Filters...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Calculator className="h-4 w-4" />
                    <span>{hasUnappliedChanges ? 'Apply Filters & Calculate' : 'Filters Applied'}</span>
                  </div>
                )}
              </Button>
            </div>

            {/* Filter Status Indicator */}
            {appliedFilters.selectedSuppliers.length > 0 && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2 text-green-800">
                  <div className="h-2 w-2 bg-green-600 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">
                    Active Filters: {appliedFilters.selectedSuppliers.length === 1 ? appliedFilters.selectedSuppliers[0] : `${appliedFilters.selectedSuppliers.length} Suppliers`} | {appliedFilters.dateFrom} to {appliedFilters.dateTo} | {appliedFilters.pricingBasis === 'deliveredDate' ? 'Delivered' : 'Order'} Date
                  </span>
                </div>
                {hasUnappliedChanges && (
                  <p className="text-sm text-orange-600 mt-2">
                    ⚠️ You have unsaved filter changes. Click "Apply Filters" to update results.
                  </p>
                )}
              </div>
            )}

            {/* Supplier Info Panel */}
            {selectedSuppliers.length === 1 && (
              <Card className="mb-8 border-2 border-blue-200">
                <CardHeader className="bg-blue-600 text-white">
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Users className="h-5 w-5" />
                    <span>Supplier Information: {selectedSuppliers[0]}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Date Range Info */}
                    {supplierDateRanges.has(selectedSuppliers[0]) && (
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <h4 className="font-semibold text-green-800 mb-2 flex items-center">
                          <Calendar className="h-4 w-4 mr-2" />
                          Delivery Period
                        </h4>
                        <div className="space-y-1 text-sm">
                          <p><span className="font-medium">First Delivery:</span> {new Date(supplierDateRanges.get(selectedSuppliers[0])!.firstDelivery).toLocaleDateString()}</p>
                          <p><span className="font-medium">Last Delivery:</span> {new Date(supplierDateRanges.get(selectedSuppliers[0])!.lastDelivery).toLocaleDateString()}</p>
                          <p><span className="font-medium">Total Orders:</span> {supplierDateRanges.get(selectedSuppliers[0])!.totalOrders}</p>
                        </div>
                        <div className="mt-3 flex space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              const range = supplierDateRanges.get(selectedSuppliers[0])!;
                              setDateFrom(range.firstDelivery.split('T')[0]);
                              setDateTo(range.lastDelivery.split('T')[0]);
                            }}
                            className="text-green-700 border-green-300 hover:bg-green-100"
                          >
                            Use Full Range
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              const range = supplierDateRanges.get(selectedSuppliers[0])!;
                              const lastMonthStart = new Date();
                              lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
                              setDateFrom(lastMonthStart.toISOString().split('T')[0]);
                              setDateTo(range.lastDelivery.split('T')[0]);
                            }}
                            className="text-blue-700 border-blue-300 hover:bg-blue-100"
                          >
                            Last Month
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Missing Products Info */}
                    {selectedSuppliers.length === 1 && supplierMissingProducts.has(selectedSuppliers[0]) && (
                      <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                        <h4 className="font-semibold text-red-800 mb-2 flex items-center">
                          <Package className="h-4 w-4 mr-2" />
                          Missing Price Entries ({supplierMissingProducts.get(selectedSuppliers[0])!.length})
                        </h4>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {supplierMissingProducts.get(selectedSuppliers[0])!.slice(0, 5).map((product: any, index: number) => (
                            <div key={index} className="text-sm bg-white p-2 rounded border">
                              <p className="font-medium text-red-900">{product.productName}</p>
                              <p className="text-red-600">HSN: {product.hsn || 'N/A'} | Qty: {product.totalQty}</p>
                            </div>
                          ))}
                          {supplierMissingProducts.get(selectedSuppliers[0])!.length > 5 && (
                            <p className="text-xs text-red-600 text-center pt-2">
                              +{supplierMissingProducts.get(selectedSuppliers[0])!.length - 5} more products
                            </p>
                          )}
                        </div>
                        <Link href="/price-management">
                          <Button size="sm" className="mt-3 bg-red-600 hover:bg-red-700 text-white">
                            Add Missing Prices
                          </Button>
                        </Link>
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <h4 className="font-semibold text-gray-800 mb-2 flex items-center">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Quick Actions
                      </h4>
                      <div className="space-y-2">
                        <Link href={`/supplier-performance?supplier=${encodeURIComponent(selectedSuppliers[0] || '')}`}>
                          <Button size="sm" variant="outline" className="w-full justify-start">
                            <Users className="h-4 w-4 mr-2" />
                            View Performance
                          </Button>
                        </Link>
                        <Link href={`/reports?supplier=${encodeURIComponent(selectedSuppliers[0] || '')}`}>
                          <Button size="sm" variant="outline" className="w-full justify-start">
                            <FileText className="h-4 w-4 mr-2" />
                            Generate Reports
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Loading State */}
            {isApplyingFilters ? (
              <div className="text-center py-12">
                <div className="flex flex-col items-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  <div className="space-y-2">
                    <p className="text-lg font-medium text-gray-700">Processing Your Request...</p>
                    <p className="text-sm text-gray-500">Calculating payouts for {selectedSuppliers.length === 1 ? selectedSuppliers[0] : `${selectedSuppliers.length} suppliers`}</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Order Account Summary */}
                {orderAccountSummary.length > 0 && (
                  <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 mb-6">
                    <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-lg">
                      <CardTitle className="flex items-center space-x-3">
                        📧 Order Account Payout Summary
                      </CardTitle>
                      <CardDescription className="text-purple-100">
                        Payout breakdown by email ID/order account
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="grid gap-4">
                        {orderAccountSummary.map((account: any, index: number) => (
                          <div key={account.orderAccount} className="border rounded-lg p-4 bg-white shadow-sm">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h4 className="font-semibold text-lg text-gray-800">
                                  📧 {account.orderAccount}
                                </h4>
                                <div className="text-sm text-gray-600 mt-1">
                                  {account.supplierCount} supplier{account.supplierCount !== 1 ? 's' : ''} • {account.orderCount} orders • {account.uniqueProducts} products
                                </div>
                                <div className="text-xs text-blue-600 mt-1">
                                  Suppliers: {account.suppliers.join(', ')}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-green-600">
                                  ₹{account.totalPostGstAmount.toFixed(2)}
                                </div>
                                <div className="text-sm text-gray-500">
                                  (₹{account.totalPreGstAmount.toFixed(2)} + ₹{account.totalGstAmount.toFixed(2)} GST)
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm">
                              <div className="bg-blue-50 p-2 rounded">
                                <div className="font-semibold text-blue-600">{account.orderCount}</div>
                                <div className="text-gray-600">Orders</div>
                              </div>
                              <div className="bg-green-50 p-2 rounded">
                                <div className="font-semibold text-green-600">{account.totalQty}</div>
                                <div className="text-gray-600">Quantity</div>
                              </div>
                              <div className="bg-purple-50 p-2 rounded">
                                <div className="font-semibold text-purple-600">{account.uniqueProducts}</div>
                                <div className="text-gray-600">Products</div>
                              </div>
                              <div className="bg-orange-50 p-2 rounded">
                                <div className="font-semibold text-orange-600">₹{account.avgOrderValue.toFixed(2)}</div>
                                <div className="text-gray-600">Avg Order</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Total Summary */}
                      <div className="mt-6 p-4 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg border-2 border-purple-200">
                        <div className="text-center">
                          <h5 className="font-semibold text-gray-800 mb-2">📊 Total Across All Accounts</h5>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="text-2xl font-bold text-purple-600">
                                {orderAccountSummary.length}
                              </div>
                              <div className="text-gray-600">Accounts</div>
                            </div>
                            <div>
                              <div className="text-2xl font-bold text-blue-600">
                                {orderAccountSummary.reduce((sum, acc) => sum + acc.orderCount, 0)}
                              </div>
                              <div className="text-gray-600">Orders</div>
                            </div>
                            <div>
                              <div className="text-2xl font-bold text-green-600">
                                ₹{orderAccountSummary.reduce((sum, acc) => sum + acc.totalPreGstAmount, 0).toFixed(2)}
                              </div>
                              <div className="text-gray-600">Pre-GST</div>
                            </div>
                            <div>
                              <div className="text-2xl font-bold text-red-600">
                                ₹{orderAccountSummary.reduce((sum, acc) => sum + acc.totalPostGstAmount, 0).toFixed(2)}
                              </div>
                              <div className="text-gray-600">Total Payout</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Enhanced Payout Summary with Pre-GST Information */}
                {payoutData.summary && (
              <Card className="mb-8 border-2 border-green-200">
                <CardHeader className="bg-green-600 text-white">
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Calculator className="h-5 w-5" />
                    <span>Comprehensive Payout Summary</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {/* Primary Summary Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Supplier</p>
                      <p className="text-xl font-bold text-green-700">{payoutData.summary.supplier}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Date Range</p>
                      <p className="text-lg font-semibold text-gray-800">{payoutData.summary.dateRange}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Deliveries</p>
                      <p className="text-2xl font-bold text-blue-700">{payoutData.summary.deliveriesCount}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Total Qty</p>
                      <p className="text-2xl font-bold text-purple-700">{payoutData.summary.totalDeliveredQty}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Unique Products</p>
                      <p className="text-2xl font-bold text-indigo-700">{payoutData.summary.uniqueProducts}</p>
                    </div>
                  </div>

                  {/* Financial Breakdown Section */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <TrendingUp className="h-5 w-5 mr-2" />
                      Financial Breakdown with GST Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-600 font-medium">Amount Before GST</p>
                        <p className="text-2xl font-bold text-blue-700">₹{(parseFloat(String(payoutData.summary.totalPreGstAmount)) || 0).toFixed(2)}</p>
                        <p className="text-xs text-blue-500 mt-1">Pre-GST Product Cost</p>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                        <p className="text-sm text-orange-600 font-medium">GST Amount ({payoutData.summary.averageGstRate?.toFixed(1)}%)</p>
                        <p className="text-2xl font-bold text-orange-700">₹{(parseFloat(String(payoutData.summary.totalGstAmount)) || 0).toFixed(2)}</p>
                        <p className="text-xs text-orange-500 mt-1">Total GST Liability</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <p className="text-sm text-green-600 font-medium">Total Payout Amount</p>
                        <p className="text-2xl font-bold text-green-700">₹{(parseFloat(String(payoutData.summary.totalPostGstAmount)) || 0).toFixed(2)}</p>
                        <p className="text-xs text-green-500 mt-1">Final Amount with GST</p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <p className="text-sm text-purple-600 font-medium">Average Order Value</p>
                        <p className="text-2xl font-bold text-purple-700">₹{(parseFloat(String(payoutData.summary.avgOrderValue)) || 0).toFixed(2)}</p>
                        <p className="text-xs text-purple-500 mt-1">Per Delivery</p>
                      </div>
                    </div>
                  </div>

                  {/* Additional Insights */}
                  {payoutData.summary.newDeliveries && payoutData.summary.newDeliveries > 0 && (
                    <div className="border-t pt-4 mt-4">
                      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        <p className="text-sm text-yellow-600 font-medium">Recent Activity (Last 7 Days)</p>
                        <p className="text-xl font-bold text-yellow-700">{payoutData.summary.newDeliveries} new deliveries</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Export Buttons */}
            {payoutData.payoutOrders.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-8">
                <Button onClick={() => exportPayoutData('export')} className="bg-blue-600 hover:bg-blue-700">
                  <Download className="h-4 w-4 mr-2" />
                  Export Payout Data
                </Button>
                <Button onClick={() => exportPayoutData('summary')} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Summary CSV
                </Button>
                <Button onClick={() => exportPayoutData('lines')} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Line Items CSV
                </Button>
                {payoutData.cancelledOrders.length > 0 && (
                  <Button onClick={() => exportPayoutData('cancelled')} variant="outline" className="text-red-600">
                    <Download className="h-4 w-4 mr-2" />
                    Cancelled Orders
                  </Button>
                )}
                {payoutData.missingPrices.length > 0 && (
                  <>
                    <Button onClick={() => exportPayoutData('missing')} variant="outline" className="text-orange-600">
                      <Download className="h-4 w-4 mr-2" />
                      Missing Prices
                    </Button>
                    
                    {/* Upload Price List Control */}
                    <div className="relative">
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handlePriceListUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        data-testid="input-price-upload"
                        disabled={isPriceListUploading}
                      />
                      <Button 
                        variant="outline" 
                        className="text-green-600 border-green-400 hover:bg-green-50"
                        disabled={isPriceListUploading}
                        data-testid="button-upload-prices"
                      >
                        {isPriceListUploading ? (
                          <div className="flex items-center space-x-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                            <span>Uploading...</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <Upload className="h-4 w-4" />
                            <span>Upload Price List</span>
                          </div>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Payout Orders Table */}
            {payoutData.payoutOrders.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Payout Orders ({payoutData.payoutOrders.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100 border-b-2 border-gray-300">
                        <tr>
                          <th className="text-left p-4 font-bold text-gray-700">AWB No</th>
                          <th className="text-left p-4 font-bold text-gray-700">Order Account</th>
                          <th className="text-left p-4 font-bold text-gray-700">Courier</th>
                          <th className="text-left p-4 font-bold text-gray-700">Product</th>
                          <th className="text-center p-4 font-bold text-gray-700">Qty</th>
                          <th className="text-right p-4 font-bold text-gray-700">Unit Price</th>
                          <th className="text-right p-4 font-bold text-gray-700">Line Amount</th>
                          <th className="text-right p-4 font-bold text-gray-700">GST (%)</th>
                          <th className="text-right p-4 font-bold text-green-700">Price After GST</th>
                          <th className="text-center p-4 font-bold text-gray-700">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payoutData.payoutOrders.slice(0, 20).map((order, index) => (
                          <tr key={order.id} className={`border-b hover:bg-blue-25 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                            <td className="p-4 font-mono text-sm">{order.awbNo}</td>
                            <td className="p-4 text-sm text-blue-600">{order.orderAccount || 'N/A'}</td>
                            <td className="p-4 text-sm font-medium text-blue-600">{order.courier || 'N/A'}</td>
                            <td className="p-4">
                              <div>
                                <p className="font-semibold text-gray-800">{order.productName}</p>
                                <p className="text-xs text-gray-500">{order.hsn}</p>
                              </div>
                            </td>
                            <td className="p-4 text-center font-semibold">{order.deliveredQty}</td>
                            <td className="p-4 text-right font-semibold">₹{(parseFloat(String(order.unitPrice)) || 0).toFixed(2)}</td>
                            <td className="p-4 text-right font-semibold">₹{(parseFloat(String(order.lineAmount)) || 0).toFixed(2)}</td>
                            <td className="p-4 text-right text-orange-600 font-semibold">
                              <div>
                                <div className="font-semibold">₹{(parseFloat(String(order.gstAmount)) || 0).toFixed(2)}</div>
                                <div className="text-xs text-gray-500">({order.gstPercent || 18}%)</div>
                              </div>
                            </td>
                            <td className="p-4 text-right text-green-700 font-bold">₹{(parseFloat(String(order.totalWithGst)) || 0).toFixed(2)}</td>
                            <td className="p-4 text-center">
                              <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                                {order.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {payoutData.payoutOrders.length > 20 && (
                    <div className="p-4 bg-gray-50 text-center text-gray-600">
                      Showing first 20 of {payoutData.payoutOrders.length} orders. Export for complete data.
                    </div>
                  )}
                </CardContent>
              </Card>
                )}
              </>
            )}

            {/* No data message */}
            {selectedSuppliers.length === 0 || !dateFrom || !dateTo ? (
              <div className="text-center py-12">
                <Calculator className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">Ready to Calculate Payouts</h3>
                <p className="text-gray-500">Select a supplier and date range to begin payout calculation</p>
              </div>
            ) : payoutData.payoutOrders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">No Payout Data Found</h3>
                <p className="text-gray-500">No delivered orders found for selected criteria</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}