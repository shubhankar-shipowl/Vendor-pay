import React, { useState, useEffect } from 'react';
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, Database, AlertTriangle } from "lucide-react";

interface ProcessingProgressProps {
  fileId: string;
  onComplete?: (success: boolean, errorMessage?: string) => void;
  onCancel?: () => void;
}

interface ProgressData {
  status: 'processing' | 'completed' | 'error';
  currentBatch: number;
  totalBatches: number;
  totalRecords: number;
  processedRecords: number;
  percentage: number;
  message: string;
  errorMessage?: string;
}

export function ProcessingProgress({ fileId, onComplete, onCancel }: ProcessingProgressProps) {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const pollProgress = async () => {
      try {
        const response = await fetch(`/api/files/${fileId}/progress`);
        if (response.ok) {
          const progressData = await response.json();
          setProgress(progressData);
          
          if (progressData.status === 'completed') {
            setIsPolling(false);
            onComplete?.(true);
          } else if (progressData.status === 'error') {
            setIsPolling(false);
            onComplete?.(false, progressData.errorMessage || progressData.message);
          }
        } else if (response.status === 404) {
          // Progress not found, stop polling
          setIsPolling(false);
          onComplete?.(false);
        }
      } catch (error) {
        console.error('Failed to fetch progress:', error);
      }
    };

    if (isPolling) {
      // Poll immediately, then every 1 second
      pollProgress();
      intervalId = setInterval(pollProgress, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fileId, isPolling, onComplete]);

  if (!progress) {
    return (
      <Card className="border-2 border-blue-200 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-3 text-blue-700">
            <Clock className="h-6 w-6 animate-spin" />
            <span>Preparing to Process...</span>
          </CardTitle>
          <CardDescription>
            Setting up data processing pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={0} className="w-full h-3" />
          <p className="text-sm text-gray-600 mt-2">Initializing...</p>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = () => {
    switch (progress.status) {
      case 'processing':
        return <Database className="h-6 w-6 animate-pulse text-blue-600" />;
      case 'completed':
        return <CheckCircle className="h-6 w-6 text-green-600" />;
      case 'error':
        return <AlertTriangle className="h-6 w-6 text-red-600" />;
      default:
        return <Clock className="h-6 w-6 text-gray-600" />;
    }
  };

  const getStatusColor = () => {
    switch (progress.status) {
      case 'processing':
        return 'border-blue-200 bg-blue-50';
      case 'completed':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getProgressColor = () => {
    switch (progress.status) {
      case 'processing':
        return 'bg-blue-600';
      case 'completed':
        return 'bg-green-600';
      case 'error':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };

  return (
    <Card className={`border-2 shadow-lg ${getStatusColor()}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getStatusIcon()}
            <span className={progress.status === 'completed' ? 'text-green-700' : 
                           progress.status === 'error' ? 'text-red-700' : 'text-blue-700'}>
              {progress.status === 'processing' ? 'Processing Data...' : 
               progress.status === 'completed' ? 'Processing Complete!' : 'Processing Failed'}
            </span>
          </div>
          {progress.status === 'processing' && onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </CardTitle>
        <CardDescription>
          {progress.status === 'processing' ? 
            `Processing ${progress.totalRecords.toLocaleString()} records in batches` :
           progress.status === 'completed' ?
            `Successfully processed ${progress.totalRecords.toLocaleString()} records` :
            'An error occurred during processing'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Progress</span>
            <span className={`font-bold ${progress.status === 'completed' ? 'text-green-600' : 
                                         progress.status === 'error' ? 'text-red-600' : 'text-blue-600'}`}>
              {progress.percentage}%
            </span>
          </div>
          <Progress 
            value={progress.percentage} 
            className="w-full h-4" 
          />
          <style jsx>{`
            .progress-bar {
              background-color: ${getProgressColor()};
            }
          `}</style>
        </div>

        {/* Progress Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="text-gray-600">Current Batch</div>
            <div className="font-semibold">
              {progress.currentBatch} / {progress.totalBatches}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-gray-600">Records Processed</div>
            <div className="font-semibold">
              {progress.processedRecords.toLocaleString()} / {progress.totalRecords.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Status Message */}
        <div className="p-3 rounded-lg bg-white border border-gray-200">
          <div className="text-sm text-gray-700">
            <strong>Status:</strong> {progress.message}
          </div>
        </div>

        {/* Estimated Time (only show during processing) */}
        {progress.status === 'processing' && progress.percentage > 0 && (
          <div className="text-xs text-gray-500 text-center">
            Processing large datasets... This may take several minutes
          </div>
        )}

        {/* Success Message */}
        {progress.status === 'completed' && (
          <div className="p-3 rounded-lg bg-green-100 border border-green-200">
            <div className="text-sm text-green-800 flex items-center space-x-2">
              <CheckCircle className="h-4 w-4" />
              <span>Data processing completed successfully! You can now view your data in the dashboard.</span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {progress.status === 'error' && (
          <div className="p-3 rounded-lg bg-red-100 border border-red-200">
            <div className="text-sm text-red-800 flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Processing failed. Please check your file format and try again.</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}