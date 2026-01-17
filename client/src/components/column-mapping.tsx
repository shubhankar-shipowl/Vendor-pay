import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Table2, Wand2, Info, CheckCircle, MinusCircle, AlertCircle } from "lucide-react";
import { detectColumnMapping, detectNimbusColumnMapping } from "@/lib/csv-parser";
import { ProcessingProgress } from "./processing-progress";

interface ColumnMappingProps {
  fileData: any;
  onMappingComplete: (mapping: any, processedData: any) => void;
  source?: 'parcelx' | 'nimbus';
}

// Parcel X mapping labels (exact match to Parcel X columns)
const parcelXRequiredMappings = [
  { key: 'supplierName', label: 'SupplierName', hint: 'Pickup Warehouse' },
  { key: 'awbNo', label: 'AWB No', hint: 'WayBill Num' },
  { key: 'productName', label: 'ProductName', hint: 'Product Name' },
  { key: 'status', label: 'Status', hint: 'Status' }
];

const parcelXOptionalMappings = [
  { key: 'orderAccount', label: 'Order Account', hint: 'Order Account' },
  { key: 'courier', label: 'Courier', hint: 'Fulfilled By' },
  { key: 'qty', label: 'Qty', hint: 'Product Qty' },
  { key: 'channelOrderDate', label: 'Channel Order Date', hint: 'Channel Order Date' },
  { key: 'orderDate', label: 'Order Date', hint: 'Channel Order Date' },
  { key: 'deliveredDate', label: 'Delivered Date', hint: 'Delivered Date' },
  { key: 'rtsDate', label: 'RTS Date', hint: 'RTS Date' },
  { key: 'currency', label: 'Currency', hint: 'Currency' }
];

// Nimbus mapping labels
const nimbusRequiredMappings = [
  { key: 'supplierName', label: 'Supplier Name', hint: 'Warehouse Name' },
  { key: 'awbNo', label: 'AWB No', hint: 'AWB Number' },
  { key: 'productName', label: 'Product Name', hint: 'Product(1)' },
  { key: 'status', label: 'Status', hint: 'Tracking Status' }
];

const nimbusOptionalMappings = [
  { key: 'orderAccount', label: 'Order Account', hint: 'Store Name' },
  { key: 'courier', label: 'Courier', hint: 'Courier' },
  { key: 'qty', label: 'Qty', hint: 'Quantity' },
  { key: 'channelOrderDate', label: 'Channel Order Date', hint: 'Order Date' },
  { key: 'orderDate', label: 'Order Date', hint: 'Shipment Date' },
  { key: 'deliveredDate', label: 'Delivered Date', hint: 'Delivery Date' },
  { key: 'rtsDate', label: 'RTS Date', hint: 'RTO Delivered Date' },
  { key: 'currency', label: 'Currency', hint: 'Currency' }
];

export function ColumnMapping({ fileData, onMappingComplete, source = 'parcelx' }: ColumnMappingProps) {
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Select mappings based on source
  const requiredMappings = source === 'nimbus' ? nimbusRequiredMappings : parcelXRequiredMappings;
  const optionalMappings = source === 'nimbus' ? nimbusOptionalMappings : parcelXOptionalMappings;

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (fileData?.headers) {
      // Use source-specific mapping detection
      const autoMapping = source === 'nimbus' 
        ? detectNimbusColumnMapping(fileData.headers)
        : detectColumnMapping(fileData.headers);
      setMapping(autoMapping);
    }
  }, [fileData, source]);

  const saveMappingMutation = useMutation({
    mutationFn: async (mappingData: any) => {
      return await apiRequest(`/api/files/${fileData.fileId}/mapping`, {
        method: 'POST',
        body: JSON.stringify({ ...mappingData, source })
      });
    }
  });

  const processDataMutation = useMutation({
    mutationFn: async () => {
      setIsProcessing(true);
      const response = await apiRequest(`/api/files/${fileData.fileId}/process`, {
        method: 'POST',
        body: JSON.stringify({ source })
      });
      return response;
    },
    onSuccess: (data) => {
      // Processing started - keep isProcessing true, progress component will handle completion
    },
    onError: (error: any) => {
      setIsProcessing(false);
      
      let title = "Processing failed";
      let description = "There was an error processing your data. Please try again.";
      
      if (error?.status === 410 || error?.message?.includes("session expired") || error?.message?.includes("reupload")) {
        title = "File Session Expired";
        description = "Your uploaded file is no longer available due to server restart. Please re-upload your file and process it immediately.";
      } else if (error?.message) {
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
      const autoMapping = source === 'nimbus'
        ? detectNimbusColumnMapping(fileData.headers)
        : detectColumnMapping(fileData.headers);
      setMapping(autoMapping);
      toast({
        title: "Auto-mapping applied",
        description: `Column mappings have been automatically detected for ${source === 'nimbus' ? 'Nimbus' : 'Parcel X'}`
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

  const processMapping = () => {
    const missingRequired = requiredMappings.filter(field => !mapping[field.key]);
    if (missingRequired.length > 0) {
      toast({
        title: "Missing required mappings",
        description: `Please map: ${missingRequired.map(f => f.label).join(', ')}`,
        variant: "destructive"
      });
      return;
    }

    // Start saving mapping immediately (non-blocking)
    saveMappingMutation.mutate(mapping, {
      onSuccess: () => {
        // Then process data after mapping is saved
    processDataMutation.mutate();
      },
      onError: (error: any) => {
        toast({
          title: "Failed to save mapping",
          description: error?.message || "Could not save column mapping",
          variant: "destructive"
        });
      }
    });
  };

  const getMappingStatus = (field: any) => {
    const isMapped = !!mapping[field.key];
    if (isMapped) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (requiredMappings.some(r => r.key === field.key)) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    } else {
      return <MinusCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const requiredMappedCount = requiredMappings.filter(field => mapping[field.key]).length;
  const isProcessingReady = requiredMappedCount === requiredMappings.length;

  const handleProcessingComplete = async (success: boolean, errorMessage?: string) => {
    setIsProcessing(false);
    if (success) {
      // CRITICAL: Invalidate all order-related queries to refresh dashboard data
      await queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/orders/count-by-source'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/missing-price-entries'] });
      
      toast({
        title: "Processing Complete",
        description: `Your ${source === 'nimbus' ? 'Nimbus' : 'Parcel X'} data has been successfully processed. Dashboard will refresh automatically.`,
      });
      onMappingComplete(mapping, { success: true, source });
    } else {
      let title = "Processing Failed";
      let description = errorMessage || "There was an error processing your data. Please try again.";
      
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

  if (isProcessing) {
    return (
      <ProcessingProgress
        fileId={fileData.fileId}
        onComplete={handleProcessingComplete}
        onCancel={handleCancelProcessing}
      />
    );
  }

  const sourceColor = source === 'nimbus' ? 'cyan' : 'orange';
  const sourceName = source === 'nimbus' ? 'Nimbus' : 'Parcel X';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Table2 className={`text-${sourceColor}-600 text-xl`} />
          <h2 className="text-xl font-semibold text-gray-900">Column Mapping</h2>
          <Badge variant="outline" className={`bg-${sourceColor}-50 text-${sourceColor}-700 border-${sourceColor}-200`}>
            {sourceName}
          </Badge>
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

      {/* Column Mapping Reference */}
      <div className={`bg-${sourceColor}-50 border border-${sourceColor}-200 rounded-lg p-4 mb-6`}>
        <h4 className={`font-medium text-${sourceColor}-800 mb-2`}>Expected {sourceName} Columns:</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          {requiredMappings.map(m => (
            <div key={m.key} className={`text-${sourceColor}-700`}>
              <span className="font-medium">{m.label}:</span> {m.hint}
            </div>
          ))}
        </div>
      </div>

      {/* Mapping Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Required Mappings */}
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900 flex items-center">
            <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
            Required Mappings
          </h3>
          
          {requiredMappings.map((field) => (
            <div key={field.key} className="flex items-center space-x-3" data-testid={`mapping-${field.key}`}>
              <div className="w-36">
                <label className="text-sm font-medium text-gray-700 block">
                {field.label}
              </label>
                <span className="text-xs text-gray-500">{field.hint}</span>
              </div>
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
              <div className="w-36">
                <label className="text-sm font-medium text-gray-700 block">
                {field.label}
              </label>
                <span className="text-xs text-gray-500">{field.hint}</span>
              </div>
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
          <Info className="h-4 w-4 text-blue-500" />
          <span data-testid="text-mapping-status">
            {requiredMappedCount}/{requiredMappings.length} required mappings completed
          </span>
        </div>
        <div className="flex space-x-3">
          <Button 
            variant="outline" 
            onClick={resetMapping}
            disabled={saveMappingMutation.isPending || processDataMutation.isPending || isProcessing}
            data-testid="button-reset-mapping"
          >
            Reset
          </Button>
          <Button 
            onClick={processMapping}
            disabled={!isProcessingReady || saveMappingMutation.isPending || processDataMutation.isPending || isProcessing}
            className={source === 'nimbus' ? 'bg-cyan-600 hover:bg-cyan-700' : 'bg-orange-600 hover:bg-orange-700'}
            data-testid="button-process-data"
          >
            {saveMappingMutation.isPending ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Saving...</span>
              </div>
            ) : processDataMutation.isPending || isProcessing ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Starting...</span>
              </div>
            ) : (
              `Process ${sourceName} Data`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
