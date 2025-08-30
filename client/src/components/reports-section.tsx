import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  FileDown, 
  Users, 
  FileSpreadsheet, 
  XCircle, 
  ArrowRightLeft, 
  AlertTriangle, 
  List,
  Calendar,
  DollarSign
} from "lucide-react";

export function ReportsSection() {
  const [periodFrom, setPeriodFrom] = useState("2024-01-01");
  const [periodTo, setPeriodTo] = useState("2024-12-31");
  const [currency, setCurrency] = useState("all");
  const [minAmount, setMinAmount] = useState("");
  
  const { toast } = useToast();

  const handleExport = (reportType: string) => {
    toast({
      title: "Export started",
      description: `Generating ${reportType} report...`
    });
    
    // In a real implementation, this would trigger the actual export
    const currencyParam = currency === 'all' ? '' : currency;
    window.open(`/api/export/${reportType}?periodFrom=${periodFrom}&periodTo=${periodTo}&currency=${currencyParam}&minAmount=${minAmount}`);
  };

  const reportCards = [
    {
      id: 'supplier-summary',
      title: 'Supplier Payout Summary',
      description: 'Consolidated payouts by supplier with currency breakdown',
      icon: Users,
      stats: '47 suppliers, ₹12,45,680',
      color: 'text-primary',
      bgColor: 'bg-primary'
    },
    {
      id: 'payout-sheet',
      title: 'Payout Export Sheet',
      description: 'Detailed line-level data for payable orders',
      icon: FileSpreadsheet,
      stats: '2,156 payable orders',
      color: 'text-green-600',
      bgColor: 'bg-green-600'
    },
    {
      id: 'cancelled-orders',
      title: 'Cancelled Orders',
      description: 'Orders removed from payout calculations',
      icon: XCircle,
      stats: '183 cancelled orders',
      color: 'text-red-600',
      bgColor: 'bg-red-600'
    },
    {
      id: 'reconciliation-log',
      title: 'Reconciliation Log',
      description: 'RTS/RTO status changes and reversals',
      icon: ArrowRightLeft,
      stats: '42 reconciliation entries',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-600'
    },
    {
      id: 'exceptions',
      title: 'Exceptions',
      description: 'Data validation issues and missing information',
      icon: AlertTriangle,
      stats: '8 exceptions found',
      color: 'text-orange-600',
      bgColor: 'bg-orange-600'
    },
    {
      id: 'line-details',
      title: 'Line-Level Details',
      description: 'Complete transaction details with calculations',
      icon: List,
      stats: 'All processed records',
      color: 'text-gray-600',
      bgColor: 'bg-gray-600'
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
      <div className="flex items-center space-x-3 mb-6">
        <FileDown className="text-primary text-xl" />
        <h2 className="text-xl font-semibold text-gray-900">Reports & Exports</h2>
      </div>

      {/* Report Filters */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1">Period From</Label>
            <Input
              type="date"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
              data-testid="input-period-from"
            />
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1">Period To</Label>
            <Input
              type="date"
              value={periodTo}
              onChange={(e) => setPeriodTo(e.target.value)}
              data-testid="input-period-to"
            />
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1">Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger data-testid="select-currency">
                <SelectValue placeholder="All Currencies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Currencies</SelectItem>
                <SelectItem value="INR">INR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1">Min Amount</Label>
            <Input
              type="number"
              placeholder="0"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              data-testid="input-min-amount"
            />
          </div>
        </div>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportCards.map((report) => (
          <Card key={report.id} className="border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center space-x-3">
                <report.icon className={`${report.color} text-lg`} />
                <span className="font-medium text-gray-900">{report.title}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">{report.description}</p>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500" data-testid={`stats-${report.id}`}>
                  {report.stats}
                </span>
                <Button
                  size="sm"
                  className={report.bgColor}
                  onClick={() => handleExport(report.id)}
                  data-testid={`button-export-${report.id}`}
                >
                  <FileDown className="h-3 w-3 mr-1" />
                  Export
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
