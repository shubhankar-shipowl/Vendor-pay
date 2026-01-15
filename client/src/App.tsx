import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "./hooks/use-auth";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import DataManagement from "@/pages/data-management";
import PriceManagement from "@/pages/price-management";
import EmailManagement from "@/pages/email-management";
import Reports from "@/pages/reports";
import SupplierPerformance from "@/pages/supplier-performance";
import SupplierInformation from "@/pages/supplier-information";
import GSTInvoice from "@/pages/gst-invoice";

// Protected route wrapper
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to={`/login?redirect=${encodeURIComponent(location)}`} />;
  }

  return <Component />;
}

function Router() {
  const [location] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  // Exclude API routes from client-side routing
  // API routes should be handled by the backend server
  // If we're on an API route, redirect to backend (port 3001) if needed
  // API routes should be handled by the backend server
  if (location.startsWith('/api/')) {
    return null;
  }

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        {() => (isAuthenticated ? <Dashboard /> : <Redirect to="/login" />)}
      </Route>
      <Route path="/data-management">
        {() => <ProtectedRoute component={DataManagement} />}
      </Route>
      <Route path="/price-management">
        {() => <ProtectedRoute component={PriceManagement} />}
      </Route>
      <Route path="/email-management">
        {() => <ProtectedRoute component={EmailManagement} />}
      </Route>
      <Route path="/reports">
        {() => <ProtectedRoute component={Reports} />}
      </Route>
      <Route path="/supplier-performance">
        {() => <ProtectedRoute component={SupplierPerformance} />}
      </Route>
      <Route path="/supplier/:supplierName">
        {() => <ProtectedRoute component={SupplierInformation} />}
      </Route>
      <Route path="/gst-invoice">
        {() => <ProtectedRoute component={GSTInvoice} />}
      </Route>
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
