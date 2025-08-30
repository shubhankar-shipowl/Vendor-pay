import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Building2, CheckCheck, Clock, Eye } from "lucide-react";

export function PayoutSummary() {
  const [selectedSupplier, setSelectedSupplier] = useState("");

  // Mock data for demonstration - in real app this would come from API
  const mockSummaryData = {
    totalPayout: "₹12,45,680.50",
    suppliersCount: 47,
    deliveredOrders: 2156,
    lastUpdated: "2 minutes ago"
  };

  const mockTopSuppliers = [
    {
      id: "sup-001",
      name: "Supplier ABC Ltd",
      initials: "ABC",
      totalOrders: 324,
      deliveredCount: 298,
      rtsCount: 26,
      netPayable: "₹2,84,560.50",
      currency: "INR",
      bgColor: "bg-primary"
    },
    {
      id: "sup-002", 
      name: "XYZ Electronics",
      initials: "XYZ",
      totalOrders: 289,
      deliveredCount: 267,
      rtsCount: 22,
      netPayable: "₹2,45,890.25",
      currency: "INR",
      bgColor: "bg-green-600"
    },
    {
      id: "sup-003",
      name: "Global Tech Solutions", 
      initials: "GT",
      totalOrders: 245,
      deliveredCount: 231,
      rtsCount: 14,
      netPayable: "₹1,98,750.00",
      currency: "INR",
      bgColor: "bg-purple-600"
    }
  ];

  const handleViewSupplierDetails = (supplierId: string) => {
    setSelectedSupplier(supplierId);
    // In real app, this would navigate to detailed supplier view
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <DollarSign className="text-primary text-xl" />
          <h2 className="text-xl font-semibold text-gray-900">Final Payout Summary</h2>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Clock className="h-4 w-4" />
          <span data-testid="text-last-updated">Last updated: {mockSummaryData.lastUpdated}</span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="p-6 bg-green-50 border-green-200">
          <CardContent className="p-0">
            <div className="text-center">
              <DollarSign className="mx-auto h-8 w-8 text-green-600 mb-2" />
              <p className="text-2xl font-bold text-green-900" data-testid="text-total-payout">
                {mockSummaryData.totalPayout}
              </p>
              <p className="text-sm text-green-700">Total Payable (INR)</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="p-6 bg-blue-50 border-blue-200">
          <CardContent className="p-0">
            <div className="text-center">
              <Building2 className="mx-auto h-8 w-8 text-blue-600 mb-2" />
              <p className="text-2xl font-bold text-blue-900" data-testid="text-suppliers-count">
                {mockSummaryData.suppliersCount}
              </p>
              <p className="text-sm text-blue-700">Suppliers to Pay</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="p-6 bg-purple-50 border-purple-200">
          <CardContent className="p-0">
            <div className="text-center">
              <CheckCheck className="mx-auto h-8 w-8 text-purple-600 mb-2" />
              <p className="text-2xl font-bold text-purple-900" data-testid="text-delivered-orders-summary">
                {mockSummaryData.deliveredOrders}
              </p>
              <p className="text-sm text-purple-700">Delivered Orders</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Suppliers Table */}
      <div>
        <h3 className="font-medium text-gray-900 mb-4">Top Suppliers by Payout</h3>
        <div className="overflow-hidden border border-gray-200 rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Supplier</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Delivered</TableHead>
                <TableHead>RTS/RTO</TableHead>
                <TableHead>Net Payable</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockTopSuppliers.map((supplier) => (
                <TableRow key={supplier.id} className="hover:bg-gray-50">
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 ${supplier.bgColor} text-white rounded-full flex items-center justify-center text-sm font-medium`}>
                        {supplier.initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900" data-testid={`text-supplier-name-${supplier.id}`}>
                          {supplier.name}
                        </p>
                        <p className="text-xs text-gray-500">{supplier.id.toUpperCase()}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell data-testid={`text-total-orders-${supplier.id}`}>{supplier.totalOrders}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      {supplier.deliveredCount}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-red-600 border-red-600">
                      {supplier.rtsCount}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold" data-testid={`text-net-payable-${supplier.id}`}>
                    {supplier.netPayable}
                  </TableCell>
                  <TableCell className="text-gray-600">{supplier.currency}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewSupplierDetails(supplier.id)}
                      data-testid={`button-view-details-${supplier.id}`}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
