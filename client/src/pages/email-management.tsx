import React from 'react';
import { EmailManagement } from "@/components/email-management";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, ArrowLeft } from "lucide-react";
import { Link } from 'wouter';

export default function EmailManagementPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
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
                    <Mail className="h-8 w-8 text-purple-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">Email Management</h1>
                    <p className="text-purple-600 font-medium">Manage Supplier Email Addresses</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <EmailManagement />
      </div>
    </div>
  );
}

