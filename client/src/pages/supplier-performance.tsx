import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, TrendingUp, Package, Calendar, ArrowLeft, ArrowUpDown, ChevronUp, ChevronDown, Download } from "lucide-react";
import { Link } from 'wouter';

export default function SupplierPerformance() {
  // Sorting state
  const [sortBy, setSortBy] = useState<string>('missing_prices');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Get dashboard stats
  const { data: dashboardStats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 30000
  });

  // Get suppliers with missing price data
  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery({
    queryKey: ['/api/suppliers/with-missing-prices', sortBy, sortOrder],
    queryFn: async () => {
      const response = await fetch(`/api/suppliers/with-missing-prices?sortBy=${sortBy}&sortOrder=${sortOrder}`);
      if (!response.ok) {
        throw new Error('Failed to fetch suppliers');
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    }
  });

  // Handle sorting
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  // Handle direct export from table
  const handleExportMissingPrices = async (supplierName: string) => {
    try {
      const response = await fetch(`/api/export/missing-price-entries?supplier=${encodeURIComponent(supplierName)}`);
      if (!response.ok) {
        throw new Error('Failed to export missing prices');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${supplierName.replace(/[^a-zA-Z0-9]/g, '_')}_missing_prices.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export missing prices. Please try again.');
    }
  };

  // Get sort icon
  const getSortIcon = (column: string) => {
    if (sortBy !== column) return <ArrowUpDown className="h-4 w-4" />;
    return sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
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
                    <Users className="h-8 w-8 text-blue-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">Supplier Performance</h1>
                    <p className="text-blue-600 font-medium">Track & Analyze Supplier Metrics</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Performance Overview */}
        {dashboardStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-2 border-blue-200 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-600">Total Orders</CardTitle>
                <Package className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-900">
                  {dashboardStats.totalOrders?.toLocaleString()}
                </div>
                <p className="text-xs text-blue-600">Across all suppliers</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-green-200 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-600">Active Suppliers</CardTitle>
                <Users className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-900">
                  {dashboardStats.totalSuppliers}
                </div>
                <p className="text-xs text-green-600">Registered vendors</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-purple-200 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-purple-600">Products</CardTitle>
                <Package className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-900">
                  {dashboardStats.totalProducts}
                </div>
                <p className="text-xs text-purple-600">Unique products</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-orange-200 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-orange-600">Avg Order Value</CardTitle>
                <TrendingUp className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-900">
                  ₹{dashboardStats.avgOrderValue?.toFixed(2)}
                </div>
                <p className="text-xs text-orange-600">Per order average</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Supplier List */}
        <Card className="border-2 border-gray-200 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-gray-700 to-gray-800 text-white rounded-t-lg">
            <CardTitle className="flex items-center space-x-3 text-xl">
              <Users className="h-6 w-6" />
              <span>Supplier Directory</span>
            </CardTitle>
            <CardDescription className="text-gray-200">
              Complete list of registered suppliers
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b-2 border-gray-300">
                  <tr>
                    <th className="text-left p-4 font-bold text-gray-700">
                      <button 
                        onClick={() => handleSort('name')}
                        className="flex items-center space-x-2 hover:text-blue-600 transition-colors"
                      >
                        <span>Supplier Name</span>
                        {getSortIcon('name')}
                      </button>
                    </th>
                    <th className="text-center p-4 font-bold text-gray-700">Registration Date</th>
                    <th className="text-center p-4 font-bold text-gray-700">
                      <button 
                        onClick={() => handleSort('missing_prices')}
                        className="flex items-center justify-center space-x-2 hover:text-red-600 transition-colors w-full"
                      >
                        <span>Missing Products</span>
                        {getSortIcon('missing_prices')}
                      </button>
                    </th>
                    <th className="text-center p-4 font-bold text-gray-700">
                      <button 
                        onClick={() => handleSort('total_orders')}
                        className="flex items-center justify-center space-x-2 hover:text-green-600 transition-colors w-full"
                      >
                        <span>Total Orders</span>
                        {getSortIcon('total_orders')}
                      </button>
                    </th>
                    <th className="text-center p-4 font-bold text-gray-700">Status</th>
                    <th className="text-center p-4 font-bold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliersLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500">
                        Loading suppliers...
                      </td>
                    </tr>
                  ) : suppliers && suppliers.length > 0 ? (
                    suppliers.map((supplier: any, index: number) => (
                      <tr key={supplier.id} className={`border-b hover:bg-blue-25 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="p-4 font-semibold text-gray-800">{supplier.name}</td>
                        <td className="p-4 text-center text-gray-600">
                          {supplier.created_at ? new Date(supplier.created_at).toLocaleDateString('en-IN') : 'N/A'}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex flex-col items-center space-y-1">
                            <span className={`font-bold text-lg ${supplier.missing_prices > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {supplier.missing_prices?.toLocaleString() || '0'}
                            </span>
                            <span className="text-xs text-gray-500">
                              ({supplier.missing_price_percentage || '0'}% of {supplier.total_unique_products || 0} products)
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <span className="font-semibold text-blue-600">
                            {supplier.total_orders?.toLocaleString() || '0'}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                            Active
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleExportMissingPrices(supplier.name)}
                              className="text-green-600 border-green-600 hover:bg-green-50"
                              disabled={supplier.missing_prices === 0}
                              data-testid={`button-export-${supplier.name.toLowerCase().replace(/\s+/g, '-')}`}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Export
                            </Button>
                            <Link href={`/supplier/${encodeURIComponent(supplier.name)}`}>
                              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                                View Details
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500">
                        No suppliers found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}