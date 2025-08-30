import React from 'react';
import { PriceHSNManagement } from "@/components/price-hsn-management";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calculator, ArrowLeft } from "lucide-react";
import { Link } from 'wouter';

export default function PriceManagement() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-lg border-b-4 border-green-500">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <Link href="/">
                <Button variant="outline" size="sm" className="flex items-center space-x-2 hover:bg-green-50">
                  <ArrowLeft className="h-4 w-4" />
                  <span>Dashboard</span>
                </Button>
              </Link>
              <div className="border-l-2 border-gray-300 pl-6">
                <div className="flex items-center space-x-3">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <Calculator className="h-8 w-8 text-green-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">Price & HSN Management</h1>
                    <p className="text-green-600 font-medium">Manage Product Prices, HSN Codes & Bulk Operations</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Price Management Section */}
        <Card className="border-2 border-green-200 shadow-xl">
          <CardHeader className="bg-green-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center space-x-3 text-xl">
              <Calculator className="h-6 w-6" />
              <span>Price & HSN Management</span>
            </CardTitle>
            <CardDescription className="text-green-100">
              Upload and manage product prices with HSN codes
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <PriceHSNManagement />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}