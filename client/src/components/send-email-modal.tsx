import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Mail, Send, Loader2, X, Plus } from "lucide-react";
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Attachment = {
  filename: string;
  content: string; // base64 string without data URI prefix
  contentType?: string;
};

interface SendEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payoutSummary: any;
  payoutOrders: any[];
  selectedSuppliers: string[];
  dateRange: string;
  initialSubject?: string;
  initialContent?: string;
  attachments?: Attachment[];
}

export function SendEmailModal({
  open,
  onOpenChange,
  payoutSummary,
  payoutOrders,
  selectedSuppliers,
  dateRange,
  initialSubject,
  initialContent,
  attachments,
}: SendEmailModalProps) {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [recipients, setRecipients] = useState<string>('');
  const [cc, setCc] = useState<string>('');
  const [labels, setLabels] = useState<string[]>([]);
  const [newLabelInput, setNewLabelInput] = useState<string>('');
  const [previousOpenState, setPreviousOpenState] = useState(false);
  const labelsManuallyModified = useRef(false);
  const ccManuallyModified = useRef(false);
  const { toast } = useToast();

  // Default CC email
  const DEFAULT_CC_EMAIL = 'akash@shipowl.io';

  // Fetch supplier emails
  const { data: supplierEmails = [] } = useQuery({
    queryKey: ['/api/supplier-emails'],
    retry: 3,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch existing Gmail labels
  const { data: gmailLabels = [], isLoading: gmailLabelsLoading, error: gmailLabelsError } = useQuery({
    queryKey: ['/api/gmail/labels'],
    enabled: open,
    retry: 2,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
    onError: (error: any) => {
      console.warn('⚠️ Could not fetch Gmail labels. Gmail API may not be configured. Labels feature will be disabled.');
      console.warn('Error details:', error);
    },
  });

  // Get email addresses for selected suppliers
  const getRecipientEmails = (): string[] => {
    const emails: string[] = [];
    const emailMap = new Map((supplierEmails as any[]).map((e: any) => [e.supplierName.toLowerCase(), e.email]));
    
    selectedSuppliers.forEach(supplier => {
      const email = emailMap.get(supplier.toLowerCase());
      if (email) {
        emails.push(email);
      }
    });
    
    return emails;
  };

  // Reset labels and CC only when modal opens (not when other data changes)
  useEffect(() => {
    const isOpening = open && !previousOpenState;
    if (isOpening) {
      // Reset labels to empty when modal opens - user can add labels as needed
      console.log('🔄 Modal opening - resetting labels to empty');
      setLabels([]);
      setNewLabelInput('');
      labelsManuallyModified.current = false; // Reset the flag when modal opens
      
      // Set default CC email when modal opens (will be reset on close)
      console.log('🔄 Modal opening - setting default CC email');
      setCc(DEFAULT_CC_EMAIL);
      ccManuallyModified.current = false; // Reset the flag when modal opens
    } else if (!open) {
      // Reset flags when modal closes so defaults are set again next time
      ccManuallyModified.current = false;
    }
    setPreviousOpenState(open);
  }, [open, previousOpenState]);

  // Generate default email content when modal opens or data changes
  useEffect(() => {
    if (open && payoutSummary) {
      // Subject: use initialSubject if provided, else default payout subject
      const defaultSubject = initialSubject
        ? initialSubject
        : `Payout Summary - ${payoutSummary.supplier} - ${dateRange}`;
      setSubject(defaultSubject);

      // Content: use initialContent if provided, else generated payout content
      const defaultContent = initialContent
        ? initialContent
        : generateEmailContent(payoutSummary, payoutOrders, selectedSuppliers, dateRange);
      setContent(defaultContent);

      // Set default recipients from supplier emails
      const defaultRecipients = getRecipientEmails();
      setRecipients(defaultRecipients.join(', '));
    }
  }, [open, payoutSummary, payoutOrders, selectedSuppliers, dateRange, supplierEmails, initialSubject, initialContent]);

  // Helper function to format date with ordinal suffix (1st, 2nd, 3rd, etc.)
  const getOrdinalSuffix = (day: number): string => {
    if (day > 3 && day < 21) return 'TH';
    switch (day % 10) {
      case 1: return 'ST';
      case 2: return 'ND';
      case 3: return 'RD';
      default: return 'TH';
    }
  };

  // Helper function to format date range (e.g., "21ST NOV TO 30 NOV")
  const formatDateRange = (dateFrom: string, dateTo: string): string => {
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    
    try {
      const fromDate = new Date(dateFrom);
      const toDate = new Date(dateTo);
      
      const fromDay = fromDate.getDate();
      const fromMonth = monthNames[fromDate.getMonth()];
      const toDay = toDate.getDate();
      const toMonth = monthNames[toDate.getMonth()];
      
      const fromSuffix = getOrdinalSuffix(fromDay);
      const toSuffix = getOrdinalSuffix(toDay);
      
      if (fromMonth === toMonth) {
        return `${fromDay}${fromSuffix} ${fromMonth} TO ${toDay}${toSuffix} ${toMonth}`;
      } else {
        return `${fromDay}${fromSuffix} ${fromMonth} TO ${toDay}${toSuffix} ${toMonth}`;
      }
    } catch (error) {
      // Fallback to original format if parsing fails
      return `${dateFrom} TO ${dateTo}`;
    }
  };

  // Generate UTR number (you can customize this logic)
  const generateUTRNumber = (): string => {
    // Generate a random UTR-like number
    // Format: PC + 15 digits
    const randomDigits = Math.floor(Math.random() * 1000000000000000).toString().padStart(15, '0');
    return `PC${randomDigits}`;
  };

  // Generate email content with payout details
  const generateEmailContent = (
    summary: any,
    orders: any[],
    suppliers: string[],
    range: string
  ): string => {
    const supplierList = suppliers.length === 1 ? suppliers[0] : suppliers.join(', ');
    const totalAmount = (parseFloat(String(summary.totalPreGstAmount)) || 0).toFixed(2);
    
    // Extract date range from summary or use the provided range
    let dateRangeFormatted = '';
    if (summary.dateRange) {
      const dateMatch = summary.dateRange.match(/(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/i);
      if (dateMatch) {
        dateRangeFormatted = formatDateRange(dateMatch[1], dateMatch[2]);
      } else {
        // Try to parse from range string
        const parts = range.split(' to ');
        if (parts.length === 2) {
          dateRangeFormatted = formatDateRange(parts[0].trim(), parts[1].trim());
        }
      }
    }
    
    // If we couldn't parse, use a fallback
    if (!dateRangeFormatted && range) {
      const parts = range.split(' to ');
      if (parts.length === 2) {
        dateRangeFormatted = formatDateRange(parts[0].trim(), parts[1].trim());
      }
    }
    
    // Fallback to original format if all parsing fails
    if (!dateRangeFormatted) {
      dateRangeFormatted = range || summary.dateRange || 'N/A';
    }
    
    const utrNumber = generateUTRNumber();
    const orderCount = summary.deliveriesCount || orders.length || 0;
    const totalUnits = summary.totalDeliveredQty || orders.reduce((sum: number, o: any) => sum + (o.deliveredQty || 0), 0);
    const uniqueProducts = summary.uniqueProducts || new Set(orders.map((o: any) => o.productName)).size;
    
    return `Dear ${supplierList},

A payment of ₹${totalAmount} has been processed via NEFT for the delivery period from ${dateRangeFormatted}.

The UTR number for this transaction is ${utrNumber}

For this period, there were ${orderCount} orders, totaling ${totalUnits} units of ${uniqueProducts} unique product${uniqueProducts !== 1 ? 's' : ''}.

Thanks,
Dhwani Maheshwari`;
  };

  // Parse recipients from the input string (comma or newline separated)
  const parseRecipients = (recipientString: string): string[] => {
    return recipientString
      .split(/[,\n]/)
      .map(email => email.trim())
      .filter(email => email.length > 0);
  };

  // Validate email addresses
  const validateEmails = (emails: string[]): { valid: string[]; invalid: string[] } => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const valid: string[] = [];
    const invalid: string[] = [];

    emails.forEach(email => {
      if (emailRegex.test(email)) {
        valid.push(email);
      } else {
        invalid.push(email);
      }
    });

    return { valid, invalid };
  };

  const parsedRecipients = parseRecipients(recipients);
  const { valid: validEmails, invalid: invalidEmails } = validateEmails(parsedRecipients);
  const hasValidEmails = validEmails.length > 0;

  const parsedCc = parseRecipients(cc);
  const { valid: validCc } = validateEmails(parsedCc);

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      if (!hasValidEmails) {
        throw new Error('Please enter at least one valid email address');
      }

      // Get labels to send - ensure we only send what the user sees
      // Filter out empty labels and create a fresh array to avoid any state issues
      const labelsToSend = [...labels]
        .filter(label => label && typeof label === 'string' && label.trim().length > 0)
        .map(label => label.trim());
      
      console.log('📧 Sending email with labels:', labelsToSend);
      console.log('📧 Current labels state:', labels);
      console.log('📧 Labels count:', labelsToSend.length);
      
      return apiRequest('/api/supplier-emails/send', {
        method: 'POST',
        body: JSON.stringify({
          to: validEmails,
          cc: validCc,
          subject,
          content,
          supplierNames: selectedSuppliers,
          payoutSummary,
          dateRange,
          payoutOrders: payoutOrders, // Include payout orders for Excel attachment
          labels: labelsToSend, // Include only non-empty labels
          attachments: attachments && attachments.length > 0 ? attachments : undefined,
        }),
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Email Sent",
        description: `Successfully sent email to ${validEmails.length} recipient(s)${data?.attachmentIncluded ? ' with payout data attachment' : ''}`,
        variant: "default",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Email",
        description: error.message || "An error occurred while sending the email",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Mail className="h-5 w-5" />
            <span>Send Payout Summary Email</span>
          </DialogTitle>
          <DialogDescription>
            Send the calculated payout summary to selected supplier(s)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Recipients */}
          <div>
            <Label htmlFor="email-recipients">Recipients</Label>
            <Textarea
              id="email-recipients"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="Enter email addresses separated by commas or new lines"
              className="mt-2 min-h-[80px] font-mono text-sm"
            />
            <div className="mt-2 space-y-1">
              {hasValidEmails && (
                <p className="text-sm text-green-700">
                  ✓ {validEmails.length} valid email address(es)
                </p>
              )}
              {invalidEmails.length > 0 && (
                <p className="text-sm text-red-600">
                  ⚠️ {invalidEmails.length} invalid email address(es): {invalidEmails.join(', ')}
                </p>
              )}
              {!hasValidEmails && recipients.trim() && (
                <Alert className="mt-2">
                  <AlertDescription>
                    ⚠️ Please enter at least one valid email address
                  </AlertDescription>
                </Alert>
              )}
              {!recipients.trim() && (
                <Alert className="mt-2">
                  <AlertDescription>
                    ℹ️ No email addresses found for selected suppliers. You can manually add email addresses above.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          {/* CC */}
          <div>
            <Label htmlFor="email-cc">CC (optional)</Label>
            <Textarea
              id="email-cc"
              value={cc}
              onChange={(e) => {
                setCc(e.target.value);
                ccManuallyModified.current = true; // Mark as manually modified
              }}
              placeholder="Enter CC email addresses separated by commas or new lines"
              className="mt-2 min-h-[60px] font-mono text-sm"
            />
            {validCc.length > 0 && (
              <p className="mt-1 text-sm text-green-700">
                ✓ {validCc.length} valid CC email address(es)
              </p>
            )}
            {cc.trim() === DEFAULT_CC_EMAIL && (
              <p className="mt-1 text-xs text-gray-500 italic">
                Default CC email. You can edit or remove it.
              </p>
            )}
          </div>

          {/* Subject */}
          <div>
            <Label htmlFor="email-subject">Subject</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="mt-2"
            />
          </div>

          {/* Gmail Labels */}
          <div>
            <Label>Gmail Label</Label>
            <div className="mt-2 space-y-3">
              {/* Dropdown for existing Gmail labels */}
              <Select
                onValueChange={(value) => {
                  if (!labels.includes(value)) {
                    const updatedLabels = [...labels, value];
                    console.log(`🏷️ Selected Gmail label "${value}". Current labels:`, updatedLabels);
                    setLabels(updatedLabels);
                    labelsManuallyModified.current = true;
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={gmailLabelsLoading ? 'Loading labels...' : 'Select a label'} />
                </SelectTrigger>
                <SelectContent>
                  {gmailLabels && gmailLabels.length > 0 ? (
                    gmailLabels.map((label: any) => (
                      <SelectItem key={label.id || label.name} value={label.name}>
                        {label.name}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-2 text-sm text-gray-500">
                      {gmailLabelsLoading ? 'Loading labels...' : 'No labels found in Gmail'}
                    </div>
                  )}
                </SelectContent>
              </Select>

              {/* Display selected labels as chips */}
              <div className="flex flex-wrap gap-2">
                {labels.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No labels added</p>
                ) : (
                  labels.map((label, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="px-3 py-1 text-sm flex items-center gap-2"
                    >
                      {label}
                      <button
                        type="button"
                        onClick={() => {
                          const newLabels = labels.filter((_, i) => i !== index);
                          console.log(`🗑️ Removing label "${label}". Remaining labels:`, newLabels);
                          setLabels(newLabels);
                          labelsManuallyModified.current = true;
                        }}
                        className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                        aria-label={`Remove ${label} label`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>
              {labels.length > 0 && (
                <p className="text-xs text-gray-500">
                  Labels to be applied: {labels.join(', ')}
                </p>
              )}

              {/* Optional: manual label creation */}
              <div className="flex gap-2">
                <Input
                  value={newLabelInput}
                  onChange={(e) => setNewLabelInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newLabelInput.trim()) {
                      e.preventDefault();
                      const trimmedLabel = newLabelInput.trim();
                      if (!labels.includes(trimmedLabel)) {
                        const updatedLabels = [...labels, trimmedLabel];
                        console.log(`➕ Creating new label "${trimmedLabel}". Current labels:`, updatedLabels);
                        setLabels(updatedLabels);
                        setNewLabelInput('');
                        labelsManuallyModified.current = true;
                      } else {
                        toast({
                          title: 'Label already exists',
                          description: `The label "${trimmedLabel}" is already added`,
                          variant: 'default',
                        });
                      }
                    }
                  }}
                  placeholder="Or create a new label"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (newLabelInput.trim()) {
                      const trimmedLabel = newLabelInput.trim();
                      if (!labels.includes(trimmedLabel)) {
                        const updatedLabels = [...labels, trimmedLabel];
                        console.log(`➕ Creating new label "${trimmedLabel}". Current labels:`, updatedLabels);
                        setLabels(updatedLabels);
                        setNewLabelInput('');
                        labelsManuallyModified.current = true;
                      } else {
                        toast({
                          title: 'Label already exists',
                          description: `The label "${trimmedLabel}" is already added`,
                          variant: 'default',
                        });
                      }
                    }
                  }}
                  disabled={!newLabelInput.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div>
            <Label htmlFor="email-content">Email Content</Label>
            <Textarea
              id="email-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Email content"
              className="mt-2 min-h-[400px] font-mono text-sm"
            />
          </div>

          {/* Payout Summary Preview */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h4 className="font-semibold mb-3">Payout Summary Preview</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Total Deliveries</p>
                <p className="font-bold text-lg">{payoutSummary?.deliveriesCount || 0}</p>
              </div>
              <div>
                <p className="text-gray-600">Total Amount</p>
                <p className="font-bold text-lg text-green-600">
                  ₹{(parseFloat(String(payoutSummary?.totalPostGstAmount)) || 0).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Before GST</p>
                <p className="font-bold text-lg">
                  ₹{(parseFloat(String(payoutSummary?.totalPreGstAmount)) || 0).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-gray-600">GST Amount</p>
                <p className="font-bold text-lg text-orange-600">
                  ₹{(parseFloat(String(payoutSummary?.totalGstAmount)) || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => sendEmailMutation.mutate()}
            disabled={!hasValidEmails || !subject.trim() || !content.trim() || sendEmailMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {sendEmailMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

