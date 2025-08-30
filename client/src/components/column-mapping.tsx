import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Table2, Wand2, Info, CheckCircle, MinusCircle, AlertCircle } from "lucide-react";
import { detectColumnMapping } from "@/lib/csv-parser";
import { ProcessingProgress } from "./processing-progress";

interface ColumnMappingProps {
  fileData: any;
  onMappingComplete: (mapping: any, processedData: any) => void;
}

export function ColumnMapping({ fileData, onMappingComplete }: ColumnMappingProps) {
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [requiredMappings] = useState([
    { key: 'supplierName', label: 'SupplierName', required: true },
    { key: 'awbNo', label: 'AWB No', required: true },
    { key: 'productName', label: 'ProductName', required: true },
    { key: 'status', label: 'Status', required: true }
  ]);
  
  const [optionalMappings] = useState([
    { key: 'orderAccount', label: 'Order Account', required: false },
    { key: 'courier', label: 'Courier', required: false },
    { key: 'qty', label: 'Qty', required: false },
    { key: 'channelOrderDate', label: 'Channel Order Date', required: false },
    { key: 'orderDate', label: 'Order Date', required: false },
    { key: 'deliveredDate', label: 'Delivered Date', required: false },
    { key: 'currency', label: 'Currency', required: false }
  ]);

  const { toast } = useToast();

  useEffect(() => {
    if (fileData?.headers) {
      const autoMapping = detectColumnMapping(fileData.headers);
      setMapping(autoMapping);
    }
  }, [fileData]);

  const saveMappingMutation = useMutation({
    mutationFn: async (mappingData: any) => {
      return await apiRequest(`/api/files/${fileData.fileId}/mapping`, {
        method: 'POST',
        body: JSON.stringify(mappingData)
      });
    }
  });

  const processDataMutation = useMutation({
    mutationFn: async () => {
      setIsProcessing(true);
      return await apiRequest(`/api/files/${fileData.fileId}/process`, {
        method: 'POST',
        body: JSON.stringify({})
      });
    },
    onSuccess: (data) => {
      // Don't immediately show success - let the progress component handle it
      // setIsProcessing will be set to false by the progress component
    },
    onError: (error: any) => {
      setIsProcessing(false);
      
      // Handle specific error cases with better messaging
      let title = "Processing failed";
      let description = "There was an error processing your data. Please try again.";
      
      // Check if it's a file session expired error (410 status)
      if (error?.status === 410 || error?.message?.includes("session expired") || error?.message?.includes("reupload")) {
        title = "File Session Expired";
        description = "Your uploaded file is no longer available due to server restart. Please re-upload your file and process it immediately.";
      } else if (error?.message) {
        // Use the specific error message from the server
        description = error.message;
      }
      
      toast({
        title,
        description,
        variant: "destructive"
      });
      console.error("Data processing error:", error);
    }
  });

  const handleMappingChange = (field: string, column: string) => {
    setMapping(prev => ({
      ...prev,
      [field]: column === "none" ? "" : column
    }));
  };

  const autoMapColumns = () => {
    if (fileData?.headers) {
      const autoMapping = detectColumnMapping(fileData.headers);
      setMapping(autoMapping);
      toast({
        title: "Auto-mapping applied",
        description: "Column mappings have been automatically detected"
      });
    }
  };

  const resetMapping = () => {
    setMapping({});
    toast({
      title: "Mapping reset",
      description: "All column mappings have been cleared"
    });
  };

  const processMapping = async () => {
    // Validate required mappings
    const missingRequired = requiredMappings.filter(field => !mapping[field.key]);
    if (missingRequired.length > 0) {
      toast({
        title: "Missing required mappings",
        description: `Please map: ${missingRequired.map(f => f.label).join(', ')}`,
        variant: "destructive"
      });
      return;
    }

    // Save mapping first
    await saveMappingMutation.mutateAsync(mapping);
    
    // Then process data
    processDataMutation.mutate();
  };

  const getMappingStatus = (field: any) => {
    const isMapped = !!mapping[field.key];
    if (field.required && isMapped) {
      return <CheckCircle className="h-4 w-4 text-success" />;
    } else if (field.required && !isMapped) {
      return <AlertCircle className="h-4 w-4 text-error" />;
    } else if (!field.required && isMapped) {
      return <CheckCircle className="h-4 w-4 text-success" />;
    } else {
      return <MinusCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const requiredMappedCount = requiredMappings.filter(field => mapping[field.key]).length;
  const isProcessingReady = requiredMappedCount === requiredMappings.length;

  const handleProcessingComplete = (success: boolean, errorMessage?: string) => {
    setIsProcessing(false);
    if (success) {
      toast({
        title: "Processing Complete",
        description: "Your data has been successfully processed and is now available in the dashboard.",
      });
      onMappingComplete(mapping, { success: true });
    } else {
      let title = "Processing Failed";
      let description = errorMessage || "There was an error processing your data. Please try again.";
      
      // Handle specific error cases
      if (errorMessage?.includes("session expired") || errorMessage?.includes("reupload")) {
        title = "File Session Expired";
        description = "Your uploaded file is no longer available due to server restart. Please re-upload your file and process it immediately.";
      }
      
      toast({
        title,
        description,
        variant: "destructive"
      });
    }
  };

  const handleCancelProcessing = () => {
    setIsProcessing(false);
    toast({
      title: "Processing Cancelled",
      description: "Data processing has been cancelled.",
      variant: "destructive"
    });
  };

  // Show progress component when processing
  if (isProcessing) {
    return (
      <ProcessingProgress
        fileId={fileData.fileId}
        onComplete={handleProcessingComplete}
        onCancel={handleCancelProcessing}
      />
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Table2 className="text-primary text-xl" />
          <h2 className="text-xl font-semibold text-gray-900">Column Mapping</h2>
        </div>
        <Button
          variant="outline"
          onClick={autoMapColumns}
          data-testid="button-auto-map"
        >
          <Wand2 className="h-4 w-4 mr-1" />
          Auto-map columns
        </Button>
      </div>

      {/* Mapping Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Required Mappings */}
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900 flex items-center">
            <AlertCircle className="h-4 w-4 text-error mr-2" />
            Required Mappings
          </h3>
          
          {requiredMappings.map((field) => (
            <div key={field.key} className="flex items-center space-x-3" data-testid={`mapping-${field.key}`}>
              <label className="w-32 text-sm font-medium text-gray-700">
                {field.label}
              </label>
              <Select
                value={mapping[field.key] || "none"}
                onValueChange={(value) => handleMappingChange(field.key, value)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select column..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select column...</SelectItem>
                  {fileData?.headers?.filter((header: string) => header && header.trim() !== '').map((header: string, index: number) => (
                    <SelectItem key={`required-${header}-${index}`} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {getMappingStatus(field)}
            </div>
          ))}
        </div>

        {/* Optional Mappings */}
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900">Optional Mappings</h3>
          
          {optionalMappings.map((field) => (
            <div key={field.key} className="flex items-center space-x-3" data-testid={`mapping-${field.key}`}>
              <label className="w-32 text-sm font-medium text-gray-700">
                {field.label}
              </label>
              <Select
                value={mapping[field.key] || "none"}
                onValueChange={(value) => handleMappingChange(field.key, value)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select column..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select column...</SelectItem>
                  {fileData?.headers?.filter((header: string) => header && header.trim() !== '').map((header: string, index: number) => (
                    <SelectItem key={`optional-${header}-${index}`} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {getMappingStatus(field)}
            </div>
          ))}
        </div>
      </div>

      {/* Mapping Actions */}
      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Info className="h-4 w-4 text-primary" />
          <span data-testid="text-mapping-status">
            {requiredMappedCount} required mappings completed
          </span>
        </div>
        <div className="flex space-x-3">
          <Button 
            variant="outline" 
            onClick={resetMapping}
            data-testid="button-reset-mapping"
          >
            Reset
          </Button>
          <Button 
            onClick={processMapping}
            disabled={!isProcessingReady || processDataMutation.isPending || isProcessing}
            data-testid="button-process-data"
          >
            {processDataMutation.isPending || isProcessing ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Starting...</span>
              </div>
            ) : (
              "Process Data"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
