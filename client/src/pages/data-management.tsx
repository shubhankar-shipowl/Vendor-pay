import React, { useState } from 'react';
import { DataTransparency } from "@/components/data-transparency";
import { FileUpload } from "@/components/file-upload";
import { ColumnMapping } from "@/components/column-mapping";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, Upload, Settings, ArrowLeft, Trash2, AlertTriangle, Package, Cloud } from "lucide-react";
import { Link } from 'wouter';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DataManagement() {
  // Parcel X states
  const [parcelXStep, setParcelXStep] = useState(1);
  const [parcelXFileData, setParcelXFileData] = useState<any>(null);
  const [parcelXColumnMapping, setParcelXColumnMapping] = useState<any>(null);
  
  // Nimbus states
  const [nimbusStep, setNimbusStep] = useState(1);
  const [nimbusFileData, setNimbusFileData] = useState<any>(null);
  const [nimbusColumnMapping, setNimbusColumnMapping] = useState<any>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get order counts by source
  const { data: orderCounts } = useQuery({
    queryKey: ['/api/orders/count-by-source'],
    queryFn: async () => {
      const response = await fetch('/api/orders/count-by-source');
      if (!response.ok) throw new Error('Failed to fetch order counts');
      return response.json();
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Clear all orders mutation
  const clearOrdersMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/orders/clear-all', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response;
    },
    onSuccess: async () => {
      // Force refetch all related queries
      await queryClient.refetchQueries({ queryKey: ['/api/orders/count-by-source'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/missing-price-entries'] });
      toast({
        title: "Success",
        description: "All order data has been cleared successfully. You can now upload new files.",
        variant: "default"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to clear order data",
        variant: "destructive"
      });
    }
  });

  // Clear Parcel X orders mutation
  const clearParcelXMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/orders/clear-by-source/parcelx', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: async (data) => {
      // Force refetch all related queries
      await queryClient.refetchQueries({ queryKey: ['/api/orders/count-by-source'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/missing-price-entries'] });
      setParcelXFileData(null);
      setParcelXColumnMapping(null);
      setParcelXStep(1);
      toast({
        title: "Parcel X Data Cleared",
        description: `${data.deletedCount || 0} Parcel X orders have been deleted successfully.`,
        variant: "default"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to clear Parcel X data",
        variant: "destructive"
      });
    }
  });

  // Clear Nimbus orders mutation
  const clearNimbusMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/orders/clear-by-source/nimbus', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: async (data) => {
      // Force refetch all related queries
      await queryClient.refetchQueries({ queryKey: ['/api/orders/count-by-source'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/missing-price-entries'] });
      setNimbusFileData(null);
      setNimbusColumnMapping(null);
      setNimbusStep(1);
      toast({
        title: "Nimbus Data Cleared",
        description: `${data.deletedCount || 0} Nimbus orders have been deleted successfully.`,
        variant: "default"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to clear Nimbus data",
        variant: "destructive"
      });
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-lg border-b-4 border-gray-500">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <Link href="/">
                <Button variant="outline" size="sm" className="flex items-center space-x-2 hover:bg-gray-50">
                  <ArrowLeft className="h-4 w-4" />
                  <span>Dashboard</span>
                </Button>
              </Link>
              <div className="border-l-2 border-gray-300 pl-6">
                <div className="flex items-center space-x-3">
                  <div className="bg-gray-100 p-2 rounded-lg">
                    <Database className="h-8 w-8 text-gray-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">Data Management</h1>
                    <p className="text-gray-600 font-medium">Upload, Process & Manage Your Data</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Data Management Actions */}
        <Card className="border-2 border-red-200 shadow-xl">
          <CardHeader className="bg-red-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center space-x-3 text-xl">
              <Trash2 className="h-6 w-6" />
              <span>Database Management</span>
            </CardTitle>
            <CardDescription className="text-red-100">
              Clear all order data to upload new updated files
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-yellow-800">Before Clearing Data</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    This action will permanently delete all order records from the database. 
                    Use this when you want to upload a completely new/updated dataset.
                    Price entries, supplier information, and supplier email addresses will be preserved.
                  </p>
                </div>
              </div>
            </div>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  className="bg-red-600 hover:bg-red-700"
                  disabled={clearOrdersMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {clearOrdersMutation.isPending ? 'Clearing...' : 'Clear All Order Data'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <span>Confirm Data Deletion</span>
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div>
                      <p>Are you sure you want to delete all order data? This action cannot be undone.</p>
                      
                      <div className="mt-3 p-3 bg-gray-50 rounded border">
                        <p className="text-sm font-medium">What will be deleted:</p>
                        <ul className="text-sm text-gray-600 mt-1 list-disc list-inside">
                          <li>All order records</li>
                          <li>Upload history</li>
                          <li>Processing cache</li>
                        </ul>
                      </div>
                      
                      <div className="mt-3 p-3 bg-green-50 rounded border">
                        <p className="text-sm font-medium text-green-800">What will be preserved:</p>
                        <ul className="text-sm text-green-600 mt-1 list-disc list-inside">
                          <li>Price entries</li>
                          <li>Supplier information</li>
                          <li>Supplier email addresses</li>
                          <li>System settings</li>
                        </ul>
                      </div>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => clearOrdersMutation.mutate()}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Yes, Clear All Data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Data Transparency Section */}
        <DataTransparency />
        
        {/* Data Upload Section with Tabs */}
        <Card className="border-2 border-blue-200 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center space-x-3 text-xl">
              <Upload className="h-6 w-6" />
              <span>Data Upload</span>
            </CardTitle>
            <CardDescription className="text-blue-100">
              Upload CSV/Excel files from different courier platforms
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <Tabs defaultValue="parcelx" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 h-14">
                <TabsTrigger 
                  value="parcelx" 
                  className="flex items-center space-x-2 text-base font-semibold data-[state=active]:bg-orange-500 data-[state=active]:text-white"
                >
                  <Package className="h-5 w-5" />
                  <span>Parcel X</span>
                  {orderCounts?.parcelx > 0 && (
                    <span className="ml-2 bg-orange-200 text-orange-800 text-xs px-2 py-0.5 rounded-full">
                      {orderCounts.parcelx.toLocaleString()}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="nimbus" 
                  className="flex items-center space-x-2 text-base font-semibold data-[state=active]:bg-cyan-500 data-[state=active]:text-white"
                >
                  <Cloud className="h-5 w-5" />
                  <span>Nimbus</span>
                  {orderCounts?.nimbus > 0 && (
                    <span className="ml-2 bg-cyan-200 text-cyan-800 text-xs px-2 py-0.5 rounded-full">
                      {orderCounts.nimbus.toLocaleString()}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Parcel X Tab Content */}
              <TabsContent value="parcelx" className="space-y-6">
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="bg-orange-100 p-2 rounded-lg">
                        <Package className="h-6 w-6 text-orange-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-orange-800">Parcel X Data Upload</h3>
                        <p className="text-sm text-orange-600">
                          Upload order data exported from Parcel X courier platform
                          {orderCounts?.parcelx > 0 && (
                            <span className="ml-2 font-medium">
                              ({orderCounts.parcelx.toLocaleString()} orders in database)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    
                    {/* Delete Parcel X Data Button */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="border-orange-300 text-orange-700 hover:bg-orange-100"
                          disabled={clearParcelXMutation.isPending || !orderCounts?.parcelx}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {clearParcelXMutation.isPending ? 'Deleting...' : 'Delete Parcel X Data'}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center space-x-2">
                            <Package className="h-5 w-5 text-orange-600" />
                            <span>Delete Parcel X Data</span>
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete all Parcel X order data? 
                            This will remove {orderCounts?.parcelx?.toLocaleString() || 0} orders.
                            Nimbus data will not be affected.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => clearParcelXMutation.mutate()}
                            className="bg-orange-600 hover:bg-orange-700"
                          >
                            Yes, Delete Parcel X Data
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                
            <FileUpload
              onFileUploaded={(data) => {
                    setParcelXFileData({ ...data, source: 'parcelx' });
                    setParcelXStep(2);
                  }}
                />
                
                {parcelXFileData && (
                  <Card className="border-2 border-orange-200">
                    <CardHeader className="bg-orange-500 text-white rounded-t-lg py-4">
                      <CardTitle className="flex items-center space-x-3 text-lg">
                        <Settings className="h-5 w-5" />
                        <span>Parcel X Column Mapping</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <ColumnMapping
                        fileData={parcelXFileData}
                        onMappingComplete={(mapping) => {
                          setParcelXColumnMapping(mapping);
                          setParcelXStep(3);
              }}
                        source="parcelx"
            />
          </CardContent>
        </Card>
                )}
              </TabsContent>

              {/* Nimbus Tab Content */}
              <TabsContent value="nimbus" className="space-y-6">
                <div className="bg-gradient-to-r from-cyan-50 to-sky-50 border border-cyan-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="bg-cyan-100 p-2 rounded-lg">
                        <Cloud className="h-6 w-6 text-cyan-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-cyan-800">Nimbus Data Upload</h3>
                        <p className="text-sm text-cyan-600">
                          Upload order data exported from Nimbus courier platform
                          {orderCounts?.nimbus > 0 && (
                            <span className="ml-2 font-medium">
                              ({orderCounts.nimbus.toLocaleString()} orders in database)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    
                    {/* Delete Nimbus Data Button */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="border-cyan-300 text-cyan-700 hover:bg-cyan-100"
                          disabled={clearNimbusMutation.isPending || !orderCounts?.nimbus}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {clearNimbusMutation.isPending ? 'Deleting...' : 'Delete Nimbus Data'}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center space-x-2">
                            <Cloud className="h-5 w-5 text-cyan-600" />
                            <span>Delete Nimbus Data</span>
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete all Nimbus order data? 
                            This will remove {orderCounts?.nimbus?.toLocaleString() || 0} orders.
                            Parcel X data will not be affected.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => clearNimbusMutation.mutate()}
                            className="bg-cyan-600 hover:bg-cyan-700"
                          >
                            Yes, Delete Nimbus Data
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                
                <FileUpload
                  onFileUploaded={(data) => {
                    setNimbusFileData({ ...data, source: 'nimbus' });
                    setNimbusStep(2);
                  }}
                />
                
                {nimbusFileData && (
                  <Card className="border-2 border-cyan-200">
                    <CardHeader className="bg-cyan-500 text-white rounded-t-lg py-4">
                      <CardTitle className="flex items-center space-x-3 text-lg">
                        <Settings className="h-5 w-5" />
                        <span>Nimbus Column Mapping</span>
              </CardTitle>
            </CardHeader>
                    <CardContent className="p-6">
              <ColumnMapping
                        fileData={nimbusFileData}
                onMappingComplete={(mapping) => {
                          setNimbusColumnMapping(mapping);
                          setNimbusStep(3);
                }}
                        source="nimbus"
              />
            </CardContent>
          </Card>
        )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
