import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import DataManagement from "@/pages/data-management";
import PriceManagement from "@/pages/price-management";
import Reports from "@/pages/reports";
import SupplierPerformance from "@/pages/supplier-performance";
import SupplierInformation from "@/pages/supplier-information";
import GSTInvoice from "@/pages/gst-invoice";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/data-management" component={DataManagement} />
      <Route path="/price-management" component={PriceManagement} />
      <Route path="/reports" component={Reports} />
      <Route path="/supplier-performance" component={SupplierPerformance} />
      <Route path="/supplier/:supplierName" component={SupplierInformation} />
      <Route path="/gst-invoice" component={GSTInvoice} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
