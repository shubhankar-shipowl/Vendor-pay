import React, { useState } from 'react';
import { DataTransparency } from "@/components/data-transparency";
import { FileUpload } from "@/components/file-upload";
import { ColumnMapping } from "@/components/column-mapping";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, Upload, Settings, ArrowLeft, Trash2, AlertTriangle } from "lucide-react";
import { Link } from 'wouter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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

export default function DataManagement() {
  const [currentStep, setCurrentStep] = useState(1);
  const [fileData, setFileData] = useState<any>(null);
  const [columnMapping, setColumnMapping] = useState<any>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      return response; // Fetch already parses JSON, no need for .json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/missing-price-entries'] });
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
                    Price entries and supplier information will be preserved.
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
        
        {/* Data Upload Section */}
        <Card className="border-2 border-blue-200 shadow-xl">
          <CardHeader className="bg-blue-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center space-x-3 text-xl">
              <Upload className="h-6 w-6" />
              <span>Data Upload</span>
            </CardTitle>
            <CardDescription className="text-blue-100">
              Upload CSV/Excel files for processing
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <FileUpload
              onFileUploaded={(data) => {
                setFileData(data);
                setCurrentStep(2);
              }}
            />
          </CardContent>
        </Card>

        {/* Column Mapping Section */}
        {fileData && (
          <Card className="border-2 border-green-200 shadow-xl">
            <CardHeader className="bg-green-600 text-white rounded-t-lg">
              <CardTitle className="flex items-center space-x-3 text-xl">
                <Settings className="h-6 w-6" />
                <span>Column Mapping</span>
              </CardTitle>
              <CardDescription className="text-green-100">
                Map your data columns to system fields
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <ColumnMapping
                fileData={fileData}
                onMappingComplete={(mapping) => {
                  setColumnMapping(mapping);
                  setCurrentStep(3);
                }}
                currentStep={currentStep}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}