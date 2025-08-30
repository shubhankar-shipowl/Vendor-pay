import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CloudUpload, FileText, Info } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface FileUploadProps {
  onFileUploaded: (data: any) => void;
}

export function FileUpload({ onFileUploaded }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [processingStage, setProcessingStage] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      setShowProgress(true);
      setFileSize(file.size);
      
      // Enhanced progress simulation with stages
      let progress = 0;
      let currentStage = 0;
      const stages = [
        { name: "Preparing file...", duration: 500, maxProgress: 20 },
        { name: "Uploading...", duration: 1000, maxProgress: 60 },
        { name: "Processing Excel data...", duration: 800, maxProgress: 85 },
        { name: "Analyzing columns...", duration: 400, maxProgress: 95 }
      ];
      
      const progressInterval = setInterval(() => {
        if (currentStage < stages.length) {
          const stage = stages[currentStage];
          setProcessingStage(stage.name);
          
          if (progress < stage.maxProgress) {
            const increment = (stage.maxProgress - progress) / (stage.duration / 100);
            progress = Math.min(progress + increment, stage.maxProgress);
            setUploadProgress(progress);
          } else {
            currentStage++;
          }
        }
      }, 100);

      // Add timeout for large files
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 minutes timeout
      
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        // Don't set Content-Type for FormData - browser will set it automatically with boundary
      });
      
      clearTimeout(timeoutId);

      clearInterval(progressInterval);
      setProcessingStage("Finalizing...");
      setUploadProgress(100);
      
      if (!response.ok) {
        // Check if response is JSON error
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json(); // Keep .json() for fetch calls
          throw new Error(errorData.error || errorData.message || response.statusText);
        } else {
          throw new Error(`Upload failed: ${response.statusText}`);
        }
      }
      
      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json(); // Keep .json() for fetch calls
      } else {
        const text = await response.text();
        console.warn('Non-JSON upload response:', text.substring(0, 200));
        
        // If we get HTML, it means Vite intercepted our API call
        if (text.includes('<!DOCTYPE html>')) {
          throw new Error('File upload failed: Server configuration issue');
        }
        throw new Error('Server returned non-JSON response for file upload');
      }
    },
    onSuccess: (data) => {
      const sizeInMB = data.size / (1024 * 1024);
      const sizeText = sizeInMB > 1 
        ? `${sizeInMB.toFixed(1)} MB` 
        : `${(data.size / 1024).toFixed(1)} KB`;
      
      toast({
        title: "File uploaded successfully",
        description: `${data.filename} (${sizeText}) - Ready for column mapping`
      });
      onFileUploaded(data);
      
      // Reset states
      setTimeout(() => {
        setShowProgress(false);
        setUploadProgress(0);
        setProcessingStage("");
        setFileSize(0);
      }, 1000);
    },
    onError: (error) => {
      let title = "Upload failed";
      let description = error.message;
      
      // Handle specific error cases
      if (error.name === 'AbortError') {
        title = "Upload timeout";
        description = "File upload took too long and was cancelled. Please try uploading a smaller file or check your internet connection.";
      } else if (error.message?.includes("too large") || error.message?.includes("413")) {
        title = "File too large";
        description = "Your file is too large for database storage. Try uploading a smaller file (under 10MB) or contact support for assistance.";
      } else if (error.message?.includes("Failed to fetch")) {
        title = "Connection error";
        description = "Could not connect to server. Please check your internet connection and try again.";
      }
      
      toast({
        title,
        description,
        variant: "destructive"
      });
      
      // Reset states
      setShowProgress(false);
      setUploadProgress(0);
      setProcessingStage("");
      setFileSize(0);
    }
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Validate file type
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!allowedTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please upload CSV or Excel files only",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (200MB limit)
    if (file.size > 200 * 1024 * 1024) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      toast({
        title: "File too large",
        description: `Please upload files smaller than 200MB. Current file: ${sizeMB}MB`,
        variant: "destructive"
      });
      return;
    }

    // Warn about large files (>20MB) that may have storage limitations
    const LARGE_FILE_WARNING_SIZE = 20 * 1024 * 1024; // 20MB
    if (file.size > LARGE_FILE_WARNING_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      toast({
        title: "Large file detected",
        description: `File size: ${sizeMB}MB. Large files are stored in memory and should be processed immediately after upload to avoid data loss on server restart.`,
        variant: "default"
      });
    }

    uploadMutation.mutate(file);
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <CloudUpload className="text-primary text-xl" />
          <h2 className="text-xl font-semibold text-gray-900">Data Upload</h2>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <Info className="h-4 w-4" />
          <span>Supports CSV and Excel files up to 200MB</span>
        </div>
      </div>

      {/* File Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 ${
          dragActive 
            ? 'border-primary bg-primary/5' 
            : 'border-gray-300 hover:border-primary'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        data-testid="file-drop-zone"
      >
        <div className="flex flex-col items-center space-y-4">
          <FileText className="h-16 w-16 text-gray-400" />
          <div>
            <p className="text-lg font-medium text-gray-700">Drop your CSV/Excel file here</p>
            <p className="text-sm text-gray-500 mt-1">or click to browse files</p>
          </div>
          <Button 
            onClick={openFileDialog}
            disabled={uploadMutation.isPending}
            data-testid="button-choose-file"
          >
            Choose File
          </Button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xls,.xlsx"
        onChange={handleFileInput}
        className="hidden"
      />

      {/* Enhanced Upload Progress */}
      {showProgress && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg" data-testid="upload-progress">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
              <span className="text-sm font-medium text-gray-900">{processingStage || "Processing..."}</span>
            </div>
            <span className="text-sm font-semibold text-primary">{Math.round(uploadProgress)}%</span>
          </div>
          <Progress value={uploadProgress} className="h-3 mb-2" />
          {fileSize > 0 && (
            <div className="flex justify-between items-center text-xs text-gray-600">
              <span>File size: {(fileSize / (1024 * 1024)).toFixed(1)} MB</span>
              <span>Fast processing enabled for large files</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
