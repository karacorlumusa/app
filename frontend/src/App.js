import React, { useState } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import { Scan, History, BarChart3, Menu } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { Toaster } from "./components/ui/toaster";
import BarcodeScanner from "./components/BarcodeScanner";
import BarcodeHistory from "./components/BarcodeHistory";
import Dashboard from "./components/Dashboard";

function App() {
  const [scannedBarcodes, setScannedBarcodes] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleScanComplete = (scanResult) => {
    const newBarcode = {
      id: Date.now().toString(),
      barcode: scanResult.barcode,
      type: scanResult.type,
      product: scanResult.product,
      scannedAt: new Date().toISOString(),
      location: 'Manuel Tarama'
    };
    
    setScannedBarcodes(prev => [newBarcode, ...prev]);
  };

  const Navigation = () => (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Scan className="h-8 w-8 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">Barkod Tarayıcı</h1>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            <Link to="/dashboard">
              <Button variant="ghost" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Panel
              </Button>
            </Link>
            <Link to="/scanner">
              <Button variant="ghost" className="flex items-center gap-2">
                <Scan className="h-4 w-4" />
                Tarayıcı
              </Button>
            </Link>
            <Link to="/history">
              <Button variant="ghost" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Geçmiş
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 space-y-2">
            <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start">
                <BarChart3 className="h-4 w-4 mr-2" />
                Panel
              </Button>
            </Link>
            <Link to="/scanner" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start">
                <Scan className="h-4 w-4 mr-2" />
                Tarayıcı
              </Button>
            </Link>
            <Link to="/history" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start">
                <History className="h-4 w-4 mr-2" />
                Geçmiş
              </Button>
            </Link>
          </div>
        )}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <BrowserRouter>
        <Navigation />
        
        <main className="container mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route 
              path="/dashboard" 
              element={<Dashboard scannedBarcodes={scannedBarcodes} />} 
            />
            <Route 
              path="/scanner" 
              element={<BarcodeScanner onScanComplete={handleScanComplete} />} 
            />
            <Route 
              path="/history" 
              element={<BarcodeHistory scannedBarcodes={scannedBarcodes} />} 
            />
          </Routes>
        </main>
        
        <Toaster />
      </BrowserRouter>
    </div>
  );
}

export default App;