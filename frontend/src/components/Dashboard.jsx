import React from 'react';
import { BarChart3, Scan, History, TrendingUp, Package, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { mockBarcodes } from '../mock/mockData';

const Dashboard = ({ scannedBarcodes = [] }) => {
  // Combine mock data with newly scanned barcodes
  const allBarcodes = [...mockBarcodes, ...scannedBarcodes];
  
  // Calculate statistics
  const totalScans = allBarcodes.length;
  const todayScans = allBarcodes.filter(item => {
    const today = new Date().toDateString();
    return new Date(item.scannedAt).toDateString() === today;
  }).length;
  
  const uniqueProducts = new Set(allBarcodes.map(item => item.product)).size;
  
  const typeStats = allBarcodes.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});
  
  const locationStats = allBarcodes.reduce((acc, item) => {
    acc[item.location] = (acc[item.location] || 0) + 1;
    return acc;
  }, {});

  const recentScans = allBarcodes
    .sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt))
    .slice(0, 5);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
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

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Barkod Tarayıcı Kontrol Paneli</h1>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Toplam Tarama
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Scan className="h-5 w-5 text-blue-600" />
              <span className="text-2xl font-bold">{totalScans}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Bugünkü Taramalar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold">{todayScans}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Benzersiz Ürünler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-600" />
              <span className="text-2xl font-bold">{uniqueProducts}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Barkod Tipleri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-600" />
              <span className="text-2xl font-bold">{Object.keys(typeStats).length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Scans */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Son Taramalar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentScans.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  Henüz tarama yapılmadı
                </p>
              ) : (
                recentScans.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-xs font-mono bg-white px-2 py-1 rounded">
                          {item.barcode}
                        </code>
                        <Badge variant={getBadgeVariant(item.type)} className="text-xs">
                          {item.type}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium truncate">{item.product}</p>
                      <p className="text-xs text-gray-500">{formatDate(item.scannedAt)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Barkod Tipi Dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.keys(typeStats).length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  Veri bulunmamaktadır
                </p>
              ) : (
                Object.entries(typeStats)
                  .sort(([,a], [,b]) => b - a)
                  .map(([type, count]) => (
                    <div key={type} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Badge variant={getBadgeVariant(type)}>{type}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-gray-200 rounded-full h-2 w-20">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${(count / totalScans) * 100}%` 
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Location Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Konum İstatistikleri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.keys(locationStats).length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4 col-span-full">
                Konum verisi bulunmamaktadır
              </p>
            ) : (
              Object.entries(locationStats)
                .sort(([,a], [,b]) => b - a)
                .map(([location, count]) => (
                  <div key={location} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-medium">{location}</h3>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                    <div className="bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${(count / totalScans) * 100}%` 
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      %{Math.round((count / totalScans) * 100)} toplam
                    </p>
                  </div>
                ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;