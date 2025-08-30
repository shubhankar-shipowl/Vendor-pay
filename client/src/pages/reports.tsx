import React from 'react';
import { ReportsSection } from "@/components/reports-section";
import { PayoutSummary } from "@/components/payout-summary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, TrendingUp, ArrowLeft } from "lucide-react";
import { Link } from 'wouter';

export default function Reports() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-lg border-b-4 border-purple-500">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <Link href="/">
                <Button variant="outline" size="sm" className="flex items-center space-x-2 hover:bg-purple-50">
                  <ArrowLeft className="h-4 w-4" />
                  <span>Dashboard</span>
                </Button>
              </Link>
              <div className="border-l-2 border-gray-300 pl-6">
                <div className="flex items-center space-x-3">
                  <div className="bg-purple-100 p-2 rounded-lg">
                    <FileText className="h-8 w-8 text-purple-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
                    <p className="text-purple-600 font-medium">Generate Reports & Export Data</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Reports Section */}
        <Card className="border-2 border-purple-200 shadow-xl">
          <CardHeader className="bg-purple-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center space-x-3 text-xl">
              <FileText className="h-6 w-6" />
              <span>Reports & Exports</span>
            </CardTitle>
            <CardDescription className="text-purple-100">
              Generate and download various reports
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <ReportsSection />
          </CardContent>
        </Card>

        {/* Final Payout Summary */}
        <Card className="border-2 border-orange-200 shadow-xl">
          <CardHeader className="bg-orange-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center space-x-3 text-xl">
              <TrendingUp className="h-6 w-6" />
              <span>Final Payout Summary</span>
            </CardTitle>
            <CardDescription className="text-orange-100">
              Complete payout calculations and summaries
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <PayoutSummary />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}