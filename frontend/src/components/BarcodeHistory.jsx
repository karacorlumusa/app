import React, { useState } from 'react';
import { History, Search, Trash2, Calendar, Package, MapPin, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { mockBarcodes } from '../mock/mockData';

const BarcodeHistory = ({ scannedBarcodes = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  
  // Combine mock data with any newly scanned barcodes
  const allBarcodes = [...mockBarcodes, ...scannedBarcodes];

  // Filter barcodes based on search and type
  const filteredBarcodes = allBarcodes.filter(item => {
    const matchesSearch = 
      item.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || item.type === filterType;
    
    return matchesSearch && matchesType;
  });

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getBadgeVariant = (type) => {
    switch (type) {
      case 'EAN-13':
        return 'default';
      case 'UPC-A':
        return 'secondary';
      case 'Code 128':
        return 'outline';
      case 'QR Code':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const uniqueTypes = [...new Set(allBarcodes.map(item => item.type))];

  const clearHistory = () => {
    // In the mock version, we'll just show an alert
    // In the full version, this will clear the database
    alert('Geçmiş temizleme özelliği backend entegrasyonu ile aktif olacak');
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Tarama Geçmişi
            <Badge variant="outline" className="ml-auto">
              {filteredBarcodes.length} kayıt
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Barkod, ürün adı veya konum ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tüm Tipler</option>
                {uniqueTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              
              <Button 
                onClick={clearHistory}
                variant="outline" 
                size="sm"
                className="whitespace-nowrap"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Temizle
              </Button>
            </div>
          </div>

          {/* Results */}
          {filteredBarcodes.length === 0 ? (
            <Alert>
              <Package className="h-4 w-4" />
              <AlertDescription>
                {allBarcodes.length === 0 
                  ? "Henüz barkod taraması yapılmadı."
                  : "Arama kriterlerinize uygun sonuç bulunamadı."
                }
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {filteredBarcodes.map((item) => (
                <Card key={item.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                            {item.barcode}
                          </code>
                          <Badge variant={getBadgeVariant(item.type)}>
                            {item.type}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Package className="h-4 w-4" />
                          <span className="font-medium">{item.product}</span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(item.scannedAt)}
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {item.location}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(item.barcode)}
                        >
                          Kopyala
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BarcodeHistory;