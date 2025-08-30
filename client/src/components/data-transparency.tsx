import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Database, Users, Package, TrendingUp, Search, Filter, Eye, Download } from "lucide-react";

export function DataTransparency() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("all");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");

  // Fetch all data
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['/api/orders'],
    refetchInterval: 30000
  });

  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery({
    queryKey: ['/api/suppliers'],
    refetchInterval: 30000
  });

  const { data: priceEntries = [], isLoading: priceLoading } = useQuery({
    queryKey: ['/api/price-entries'],
    refetchInterval: 30000
  });

  const { data: dashboardStats } = useQuery({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 30000
  });

  // Create enriched orders data with supplier names
  const enrichedOrders = orders.map(order => {
    const supplier = suppliers.find(s => s.id === order.supplierId);
    return {
      ...order,
      supplierName: supplier?.name || 'Unknown Supplier'
    };
  });

  // Create enriched price entries with supplier names
  const enrichedPriceEntries = priceEntries.map(entry => {
    const supplier = suppliers.find(s => s.id === entry.supplierId);
    return {
      ...entry,
      supplierName: supplier?.name || 'Unknown Supplier'
    };
  });

  // Filter functions
  const filteredOrders = enrichedOrders.filter(order => {
    const matchesSearch = order.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.supplierName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.awbNo?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSupplier = selectedSupplier === "all" || order.supplierName === selectedSupplier;
    const matchesStatus = orderStatusFilter === "all" || order.status?.toLowerCase() === orderStatusFilter.toLowerCase();
    return matchesSearch && matchesSupplier && matchesStatus;
  });

  const filteredPriceEntries = enrichedPriceEntries.filter(entry => {
    const matchesSearch = entry.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         entry.supplierName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSupplier = selectedSupplier === "all" || entry.supplierName === selectedSupplier;
    return matchesSearch && matchesSupplier;
  });

  // Aggregate data for supplier overview
  const supplierStats = suppliers.map(supplier => {
    const supplierOrders = enrichedOrders.filter(order => order.supplierId === supplier.id);
    const supplierPrices = enrichedPriceEntries.filter(entry => entry.supplierId === supplier.id);
    const uniqueProducts = new Set(supplierOrders.map(order => order.productName)).size;
    const deliveredOrders = supplierOrders.filter(order => order.status?.toLowerCase() === 'delivered').length;
    const rtoOrders = supplierOrders.filter(order => order.status?.toLowerCase() === 'rto').length;
    const rtsOrders = supplierOrders.filter(order => order.status?.toLowerCase() === 'rts').length;

    return {
      ...supplier,
      totalOrders: supplierOrders.length,
      uniqueProducts,
      priceEntriesCount: supplierPrices.length,
      deliveredOrders,
      rtoOrders,
      rtsOrders,
      ordersWithoutPrices: uniqueProducts - supplierPrices.length
    };
  });

  // Product analysis
  const productStats = {};
  enrichedOrders.forEach(order => {
    const key = `${order.supplierName}-${order.productName}`;
    if (!productStats[key]) {
      productStats[key] = {
        supplierName: order.supplierName,
        productName: order.productName,
        totalOrders: 0,
        delivered: 0,
        rto: 0,
        rts: 0,
        hasPrice: enrichedPriceEntries.some(pe => 
          pe.supplierId === order.supplierId && 
          pe.productName === order.productName
        )
      };
    }
    productStats[key].totalOrders++;
    if (order.status?.toLowerCase() === 'delivered') productStats[key].delivered++;
    if (order.status?.toLowerCase() === 'rto') productStats[key].rto++;
    if (order.status?.toLowerCase() === 'rts') productStats[key].rts++;
  });

  const productStatsArray = Object.values(productStats);

  if (ordersLoading || suppliersLoading || priceLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>Database Transparency</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">Loading data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Eye className="h-5 w-5" />
            <span>Complete Database Transparency</span>
          </CardTitle>
          <CardDescription>
            View all stored data with complete transparency - suppliers, orders, pricing, and analytics
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{dashboardStats?.totalOrders || 0}</div>
                <div className="text-sm text-muted-foreground">Total Orders</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-green-600" />
              <div>
                <div className="text-2xl font-bold">{suppliers.length}</div>
                <div className="text-sm text-muted-foreground">Suppliers</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              <div>
                <div className="text-2xl font-bold">{priceEntries.length}</div>
                <div className="text-sm text-muted-foreground">Price Entries</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Database className="h-4 w-4 text-orange-600" />
              <div>
                <div className="text-2xl font-bold">{productStatsArray.length}</div>
                <div className="text-sm text-muted-foreground">Unique Products</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <Input
                placeholder="Search products, suppliers, AWB numbers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
                data-testid="input-search"
              />
            </div>
            <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
              <SelectTrigger className="w-48" data-testid="select-supplier">
                <SelectValue placeholder="Filter by supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                {suppliers.map(supplier => (
                  <SelectItem key={supplier.id} value={supplier.name}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
              <SelectTrigger className="w-48" data-testid="select-status">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="rto">RTO</SelectItem>
                <SelectItem value="rts">RTS</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Main Data Tables */}
      <Tabs defaultValue="suppliers" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="suppliers" data-testid="tab-suppliers">Suppliers Overview</TabsTrigger>
          <TabsTrigger value="orders" data-testid="tab-orders">Orders Data</TabsTrigger>
          <TabsTrigger value="pricing" data-testid="tab-pricing">Pricing Data</TabsTrigger>
          <TabsTrigger value="products" data-testid="tab-products">Product Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="suppliers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Supplier Performance Overview</CardTitle>
              <CardDescription>Complete supplier-wise breakdown with order counts and pricing status</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier Name</TableHead>
                    <TableHead>Total Orders</TableHead>
                    <TableHead>Unique Products</TableHead>
                    <TableHead>Price Entries</TableHead>
                    <TableHead>Missing Prices</TableHead>
                    <TableHead>Delivered</TableHead>
                    <TableHead>RTO</TableHead>
                    <TableHead>RTS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierStats.map(supplier => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">{supplier.name}</TableCell>
                      <TableCell>
                        <Badge variant={supplier.totalOrders > 0 ? "default" : "secondary"}>
                          {supplier.totalOrders}
                        </Badge>
                      </TableCell>
                      <TableCell>{supplier.uniqueProducts}</TableCell>
                      <TableCell>
                        <Badge variant={supplier.priceEntriesCount > 0 ? "default" : "destructive"}>
                          {supplier.priceEntriesCount}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={supplier.ordersWithoutPrices > 0 ? "destructive" : "default"}>
                          {supplier.ordersWithoutPrices}
                        </Badge>
                      </TableCell>
                      <TableCell>{supplier.deliveredOrders}</TableCell>
                      <TableCell>{supplier.rtoOrders}</TableCell>
                      <TableCell>{supplier.rtsOrders}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Orders Database</CardTitle>
              <CardDescription>All orders with supplier mapping and status ({filteredOrders.length} of {orders.length} shown)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>AWB No</TableHead>
                      <TableHead>Order Account</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Order Date</TableHead>
                      <TableHead>Delivered Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.slice(0, 100).map(order => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-xs">{order.awbNo}</TableCell>
                        <TableCell className="text-sm text-blue-600">{order.orderAccount || 'N/A'}</TableCell>
                        <TableCell className="font-medium">{order.supplierName}</TableCell>
                        <TableCell className="max-w-48 truncate" title={order.productName}>
                          {order.productName}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              order.status?.toLowerCase() === 'delivered' ? 'default' : 
                              order.status?.toLowerCase() === 'rto' ? 'destructive' : 
                              order.status?.toLowerCase() === 'rts' ? 'secondary' : 'outline'
                            }
                          >
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{order.qty}</TableCell>
                        <TableCell>{order.orderDate ? new Date(order.orderDate).toLocaleDateString() : '-'}</TableCell>
                        <TableCell>{order.deliveredDate ? new Date(order.deliveredDate).toLocaleDateString() : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredOrders.length > 100 && (
                  <div className="text-center py-4 text-muted-foreground">
                    Showing first 100 of {filteredOrders.length} orders. Use filters to narrow down results.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pricing Database</CardTitle>
              <CardDescription>All price entries with supplier mapping ({filteredPriceEntries.length} entries)</CardDescription>
            </CardHeader>
            <CardContent>
              {priceEntries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="font-medium mb-2">No Price Entries Found</h3>
                  <p>Upload and configure price entries to see pricing data here.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead>HSN</TableHead>
                      <TableHead>Effective From</TableHead>
                      <TableHead>Effective To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPriceEntries.map(entry => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">{entry.supplierName}</TableCell>
                        <TableCell>{entry.productName}</TableCell>
                        <TableCell className="font-mono">{entry.price}</TableCell>
                        <TableCell>{entry.currency}</TableCell>
                        <TableCell>{entry.hsn}</TableCell>
                        <TableCell>{entry.effectiveFrom ? new Date(entry.effectiveFrom).toLocaleDateString() : '-'}</TableCell>
                        <TableCell>{entry.effectiveTo ? new Date(entry.effectiveTo).toLocaleDateString() : 'Active'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Product Analysis</CardTitle>
              <CardDescription>Supplier-product combinations with order counts and pricing status</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Total Orders</TableHead>
                    <TableHead>Delivered</TableHead>
                    <TableHead>RTO</TableHead>
                    <TableHead>RTS</TableHead>
                    <TableHead>Price Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productStatsArray
                    .filter(product => {
                      const matchesSearch = product.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                           product.supplierName?.toLowerCase().includes(searchTerm.toLowerCase());
                      const matchesSupplier = selectedSupplier === "all" || product.supplierName === selectedSupplier;
                      return matchesSearch && matchesSupplier;
                    })
                    .sort((a, b) => b.totalOrders - a.totalOrders)
                    .map((product, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{product.supplierName}</TableCell>
                      <TableCell className="max-w-64 truncate" title={product.productName}>
                        {product.productName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.totalOrders}</Badge>
                      </TableCell>
                      <TableCell>{product.delivered}</TableCell>
                      <TableCell>{product.rto}</TableCell>
                      <TableCell>{product.rts}</TableCell>
                      <TableCell>
                        <Badge variant={product.hasPrice ? "default" : "destructive"}>
                          {product.hasPrice ? "Price Set" : "Missing Price"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}