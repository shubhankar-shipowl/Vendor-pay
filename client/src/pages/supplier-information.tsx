import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Users, Download, Upload, FileText, TrendingUp, Package, ArrowLeft, AlertCircle } from 'lucide-react';
import { Link } from 'wouter';
import * as XLSX from 'xlsx';
import { apiRequest } from '@/lib/queryClient';

interface MissingPriceEntry {
  supplierName: string;
  productName: string;
  hsn: string;
  orderCount: number;
}

export default function SupplierInformation() {
  const [match, params] = useRoute('/supplier/:supplierName');
  const supplierName = params?.supplierName ? decodeURIComponent(params.supplierName) : '';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  // Get supplier information
  const { data: suppliers = [] } = useQuery({
    queryKey: ['/api/suppliers'],
  });

  const supplier = suppliers.find((s: any) => s.name === supplierName);

  // Get missing price entries for this supplier
  const { data: allMissingPriceEntries = [] } = useQuery({
    queryKey: ['/api/missing-price-entries'],
  });

  // Filter missing price entries for current supplier
  const supplierMissingEntries = useMemo(() => {
    return allMissingPriceEntries.filter((entry: MissingPriceEntry) => 
      entry.supplierName === supplierName
    );
  }, [allMissingPriceEntries, supplierName]);

  // Export missing prices for this supplier
  const exportMissingPrices = () => {
    if (supplierMissingEntries.length === 0) {
      toast({
        title: "No missing prices",
        description: "This supplier has no missing price entries to export",
        variant: "destructive"
      });
      return;
    }

    // Create export data with template headers
    const exportData = supplierMissingEntries.map((entry: MissingPriceEntry) => ({
      'Product Name': entry.productName,
      'Price Before GST (INR)': '', // Empty for user to fill
      'GST Rate (%)': '18', // Default GST rate
      'Price After GST (INR)': '', // Calculated field for user reference
      'HSN Code': entry.hsn || '',
      'Currency': 'INR',
      'Effective From (YYYY-MM-DD)': new Date().toISOString().split('T')[0],
      'Effective To (YYYY-MM-DD)': '', // Optional
      'Orders Count': entry.orderCount
    }));

    // Create workbook and export
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // Set column widths
    const colWidths = [
      { wch: 30 }, // Product Name
      { wch: 18 }, // Price Before GST
      { wch: 12 }, // GST Rate
      { wch: 18 }, // Price After GST
      { wch: 12 }, // HSN Code
      { wch: 10 }, // Currency
      { wch: 18 }, // Effective From
      { wch: 18 }, // Effective To
      { wch: 12 }  // Orders Count
    ];
    worksheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Missing Prices');
    
    const filename = `${supplierName.replace(/[^a-zA-Z0-9]/g, '_')}_missing_prices_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);

    toast({
      title: "Export successful",
      description: `Downloaded ${supplierMissingEntries.length} missing price entries for ${supplierName}`
    });
  };

  // Handle bulk price upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV or Excel (.xlsx) file",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('supplierName', supplierName);

      const response = await fetch('/api/price-entries/bulk-upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Upload successful",
          description: result.message
        });

        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['/api/price-entries'] });
        queryClient.invalidateQueries({ queryKey: ['/api/missing-price-entries'] });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });

        // Clear the file input
        event.target.value = '';
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : 'Failed to upload price list',
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (!supplier) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Supplier Not Found</h2>
            <p className="text-gray-600 mb-4">The supplier "{supplierName}" could not be found.</p>
            <Link href="/supplier-performance">
              <Button>Back to Suppliers</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <Link href="/supplier-performance">
                <Button variant="outline" size="sm" className="flex items-center space-x-2 bg-white text-blue-600 hover:bg-blue-50">
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Suppliers</span>
                </Button>
              </Link>
              <div className="border-l-2 border-blue-400 pl-6">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-500 p-2 rounded-lg">
                    <Users className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-white">Supplier Information: {supplierName}</h1>
                    <p className="text-blue-200 font-medium">Manage prices and view performance metrics</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Missing Price Entries Card */}
          <Card className="border-2 border-red-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-red-500 to-red-600 text-white rounded-t-lg">
              <CardTitle className="flex items-center space-x-3 text-xl">
                <AlertCircle className="h-6 w-6" />
                <span>Missing Price Entries ({supplierMissingEntries.length})</span>
              </CardTitle>
              <CardDescription className="text-red-100">
                Products that need price information
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {supplierMissingEntries.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-green-600 font-medium">All prices are up to date!</p>
                  <p className="text-gray-500 text-sm">No missing price entries for this supplier.</p>
                </div>
              ) : (
                <>
                  {/* Sample entries */}
                  <div className="space-y-3 mb-6 max-h-40 overflow-y-auto">
                    {supplierMissingEntries.slice(0, 3).map((entry: MissingPriceEntry, index: number) => (
                      <div key={index} className="bg-red-50 p-3 rounded border-l-4 border-l-red-400">
                        <div className="font-medium text-gray-900 text-sm">{entry.productName}</div>
                        <div className="text-gray-600 text-xs mt-1">HSN: {entry.hsn || 'N/A'} | Qty: {entry.orderCount}</div>
                      </div>
                    ))}
                    {supplierMissingEntries.length > 3 && (
                      <div className="text-xs text-red-600 text-center py-2 border-t">
                        +{supplierMissingEntries.length - 3} more products need pricing
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="space-y-3">
                    <Button
                      onClick={exportMissingPrices}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      data-testid="export-missing-prices"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export Missing Price List (Excel)
                    </Button>

                    <div className="relative">
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        data-testid="upload-price-list"
                        disabled={isUploading}
                      />
                      <Button
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        disabled={isUploading}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {isUploading ? 'Uploading...' : 'Upload Filled Price List'}
                      </Button>
                    </div>

                    <p className="text-xs text-gray-500 text-center">
                      Upload an Excel/CSV file with filled prices to auto-update and recalculate payouts
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions Card */}
          <Card className="border-2 border-blue-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
              <CardTitle className="flex items-center space-x-3 text-xl">
                <TrendingUp className="h-6 w-6" />
                <span>Quick Actions</span>
              </CardTitle>
              <CardDescription className="text-blue-100">
                Supplier management shortcuts
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <Link href="/supplier-performance">
                <Button variant="outline" className="w-full justify-start">
                  <Users className="h-4 w-4 mr-2" />
                  View Performance
                </Button>
              </Link>
              
              <Link href="/reports">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Reports
                </Button>
              </Link>
              
              <Link href="/price-management">
                <Button variant="outline" className="w-full justify-start">
                  <Package className="h-4 w-4 mr-2" />
                  Manage All Prices
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Comprehensive Payout Summary Placeholder */}
        <Card className="border-2 border-green-200 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center space-x-3 text-xl">
              <FileText className="h-6 w-6" />
              <span>Comprehensive Payout Summary</span>
            </CardTitle>
            <CardDescription className="text-green-100">
              Detailed payout calculations for {supplierName}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="text-center py-8">
              <TrendingUp className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-green-600 font-medium">Payout calculations will appear here</p>
              <p className="text-gray-500 text-sm">Once prices are added, detailed payout summary will be shown</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}