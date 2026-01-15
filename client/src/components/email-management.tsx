import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Upload, Download, Trash2, CheckCircle2, XCircle, AlertCircle, Shield, ShieldCheck, ShieldAlert } from "lucide-react";
import * as XLSX from 'xlsx';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export function EmailManagement() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all supplier emails
  const { data: emails = [], isLoading } = useQuery({
    queryKey: ['/api/supplier-emails'],
    retry: 3,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch all suppliers for validation
  const { data: suppliers = [] } = useQuery({
    queryKey: ['/api/suppliers'],
    retry: 3,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch Gmail authorization status
  const { data: gmailStatus, refetch: refetchGmailStatus } = useQuery({
    queryKey: ['/api/gmail/status'],
    retry: 2,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
  });

  // Delete email mutation
  const deleteEmailMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/supplier-emails/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/supplier-emails'] });
      toast({
        title: "Success",
        description: "Email deleted successfully",
        variant: "default",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete email",
        variant: "destructive",
      });
    },
  });

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      const validExtensions = ['.xlsx', '.xls', '.csv'];
      const fileExtension = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'));
      
      if (!validExtensions.includes(fileExtension)) {
        toast({
          title: "Invalid File",
          description: "Please upload an Excel file (.xlsx, .xls) or CSV file",
          variant: "destructive",
        });
        return;
      }
      
      setFile(selectedFile);
    }
  };

  // Handle file upload and processing
  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "No File Selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress('Reading file...');

    try {
      // Read the file
      const fileData = await file.arrayBuffer();
      const workbook = XLSX.read(fileData, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[];

      if (data.length < 2) {
        throw new Error('File must contain at least a header row and one data row');
      }

      // Get headers (first row)
      const headers = data[0].map((h: any) => String(h || '').toLowerCase().trim());
      
      // Find email and name column indices
      const emailIndex = headers.findIndex((h: string) => 
        h.includes('email') || h === 'email'
      );
      const nameIndex = headers.findIndex((h: string) => 
        h.includes('name') || h === 'name' || h.includes('supplier')
      );

      if (emailIndex === -1) {
        throw new Error('Email column not found. Please ensure your file has an "email" column.');
      }

      if (nameIndex === -1) {
        throw new Error('Name column not found. Please ensure your file has a "name" column.');
      }

      setUploadProgress('Processing data...');

      // Process rows (skip header)
      const emailData: { email: string; supplierName: string }[] = [];
      const supplierNames = new Set((suppliers as any[]).map((s: any) => s.name.toLowerCase()));

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const email = String(row[emailIndex] || '').trim();
        const supplierName = String(row[nameIndex] || '').trim();

        if (!email || !supplierName) {
          continue; // Skip empty rows
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          console.warn(`Invalid email format: ${email}, skipping row ${i + 1}`);
          continue;
        }

        // Check if supplier exists
        if (!supplierNames.has(supplierName.toLowerCase())) {
          console.warn(`Supplier not found: ${supplierName}, skipping row ${i + 1}`);
          continue;
        }

        emailData.push({ email, supplierName });
      }

      if (emailData.length === 0) {
        throw new Error('No valid email data found. Please check your file format.');
      }

      setUploadProgress(`Uploading ${emailData.length} emails...`);

      // Upload to server
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/supplier-emails/bulk-upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        let errorData: any = { error: 'Upload failed' };
        
        if (contentType && contentType.includes('application/json')) {
          try {
            errorData = await response.json();
          } catch (e) {
            console.error('Failed to parse error response:', e);
          }
        } else {
          // If not JSON, read as text to see what we got
          const text = await response.text();
          console.error('Non-JSON error response:', text.substring(0, 200));
          errorData = { 
            error: `Server error (${response.status}): ${response.statusText}`,
            details: text.includes('<!DOCTYPE') ? 'Server returned HTML error page' : text.substring(0, 100)
          };
        }
        
        throw new Error(errorData.message || errorData.error || `Upload failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        await queryClient.invalidateQueries({ queryKey: ['/api/supplier-emails'] });
        toast({
          title: "Success",
          description: `Successfully uploaded ${result.processedCount || emailData.length} email(s)!`,
          variant: "default",
        });
        setFile(null);
        setUploadProgress('');
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error: any) {
      console.error('Email upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || 'Failed to upload emails. Please try again.',
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  // Export emails to Excel
  const handleExport = () => {
    const worksheetData = [
      ['Email', 'Supplier Name'],
      ...((emails || []) as any[]).map((email: any) => [
        email.email,
        email.supplierName,
      ]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Supplier Emails');

    // Set column widths
    worksheet['!cols'] = [
      { width: 30 }, // Email
      { width: 30 }, // Supplier Name
    ];

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `Supplier_Emails_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Download template or database Excel file
  const handleDownloadTemplate = () => {
    const hasData = emails && emails.length > 0;
    
    const worksheetData = hasData
      ? [
          ['Email', 'Supplier Name'],
          ...((emails || []) as any[]).map((email: any) => [
            email.email,
            email.supplierName,
          ]),
        ]
      : [
          ['Email', 'Supplier Name'],
          ['example@supplier.com', 'Example Supplier Name'],
        ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Supplier Emails');

    // Set column widths
    worksheet['!cols'] = [
      { width: 30 }, // Email
      { width: 30 }, // Supplier Name
    ];

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = hasData
      ? `Supplier_Emails_${new Date().toISOString().split('T')[0]}.xlsx`
      : `Supplier_Emails_Template.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Handle Gmail authorization
  const handleGmailAuth = () => {
    // Force a full page navigation to the backend API endpoint
    // Using relative path to stay on the same host/port
    window.location.href = '/api/gmail/auth';
  };

  const isGmailAuthenticated = (gmailStatus as any)?.authenticated === true;

  return (
    <div className="space-y-6">
      {/* Gmail Authorization Status */}
      <Card className="border-2 border-blue-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-t-lg">
          <CardTitle className="flex items-center space-x-3">
            <Shield className="h-6 w-6" />
            <span>Gmail API Authorization</span>
          </CardTitle>
          <CardDescription className="text-blue-100">
            Authorize Gmail API access to enable label management and advanced email features
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {isGmailAuthenticated ? (
            <Alert className="bg-green-50 border-green-200">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              <AlertDescription className="text-green-800">
                <div className="flex items-center justify-between">
                  <div>
                    <strong>Gmail API is authorized</strong>
                    <p className="text-sm text-green-700 mt-1">
                      You can now use Gmail labels when sending emails. Tokens are stored securely.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm('Are you sure you want to revoke Gmail authorization? You will need to re-authorize to use Gmail features.')) {
                        apiRequest('/api/gmail/revoke', { method: 'POST' })
                          .then(() => {
                            refetchGmailStatus();
                            toast({
                              title: "Authorization Revoked",
                              description: "Gmail authorization has been revoked successfully",
                              variant: "default",
                            });
                          })
                          .catch((error: any) => {
                            toast({
                              title: "Error",
                              description: error.message || "Failed to revoke authorization",
                              variant: "destructive",
                            });
                          });
                      }
                    }}
                    className="ml-4 border-green-300 text-green-700 hover:bg-green-100"
                  >
                    Revoke Access
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="bg-yellow-50 border-yellow-200">
              <ShieldAlert className="h-5 w-5 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <div className="flex items-center justify-between">
                  <div>
                    <strong>Gmail API is not authorized</strong>
                    <p className="text-sm text-yellow-700 mt-1">
                      Authorize Gmail API to enable label management and advanced email features. 
                      You'll be redirected to Google to grant permissions.
                    </p>
                  </div>
                  <Button
                    onClick={handleGmailAuth}
                    className="ml-4 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Authorize Gmail
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Upload Section */}
      <Card className="border-2 border-purple-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-lg">
          <CardTitle className="flex items-center space-x-3">
            <Upload className="h-6 w-6" />
            <span>Upload Supplier Emails</span>
          </CardTitle>
          <CardDescription className="text-purple-100">
            Upload an Excel file with email and name columns. The name column should match supplier names.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-file" className="text-sm font-medium">
              Select Excel/CSV File
            </Label>
            <div className="flex items-center space-x-4">
              <Input
                id="email-file"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                disabled={isUploading}
                className="flex-1"
              />
              <Button
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isUploading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Uploading...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Upload className="h-4 w-4" />
                    <span>Upload</span>
                  </div>
                )}
              </Button>
            </div>
            {uploadProgress && (
              <p className="text-sm text-purple-600">{uploadProgress}</p>
            )}
            {file && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Selected file: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(2)} KB)
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>File Format Requirements:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>File must contain an "email" column</li>
                <li>File must contain a "name" column (matching supplier names)</li>
                <li>Email addresses must be valid format</li>
                <li>Supplier names must match existing suppliers in the system</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Email List Section */}
      <Card className="border-2 border-purple-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-3">
                <Mail className="h-6 w-6" />
                <span>Supplier Emails ({(emails || []).length})</span>
              </CardTitle>
              <CardDescription className="text-purple-100">
                Manage supplier email addresses
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={handleExport}
                variant="outline"
                className="bg-white text-purple-600 hover:bg-purple-50"
                disabled={!emails || emails.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button
                onClick={handleDownloadTemplate}
                variant="outline"
                className="bg-white text-purple-600 hover:bg-purple-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Email Database
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading emails...</p>
            </div>
          ) : !emails || emails.length === 0 ? (
            <div className="p-8 text-center">
              <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No emails found</p>
              <p className="text-gray-500 text-sm mt-2">Upload an Excel file to add supplier emails</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier Name</TableHead>
                    <TableHead>Email Address</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((emails || []) as any[]).map((email: any) => (
                    <TableRow key={email.id}>
                      <TableCell className="font-medium">{email.supplierName}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Mail className="h-4 w-4 text-purple-600" />
                          <span>{email.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {email.createdAt
                          ? new Date(email.createdAt).toLocaleDateString()
                          : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete the email for ${email.supplierName}?`)) {
                              deleteEmailMutation.mutate(email.id);
                            }
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

