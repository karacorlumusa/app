import React, { useState } from 'react';
import { 
  BarChart3, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Package,
  FileText,
  Download,
  Eye
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { mockSales, mockProducts } from '../mock/mockData';

const SalesReports = () => {
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [selectedSale, setSelectedSale] = useState(null);

  // Filter sales by date range
  const filteredSales = mockSales.filter(sale => {
    const saleDate = new Date(sale.date).toISOString().split('T')[0];
    return saleDate >= dateRange.start && saleDate <= dateRange.end;
  });

  // Calculate statistics
  const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
  const totalItemsSold = filteredSales.reduce((sum, sale) => 
    sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
  );
  const averageSaleValue = filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0;

  // Top selling products
  const productSales = {};
  filteredSales.forEach(sale => {
    sale.items.forEach(item => {
      if (!productSales[item.productId]) {
        productSales[item.productId] = {
          name: item.name,
          quantity: 0,
          revenue: 0
        };
      }
      productSales[item.productId].quantity += item.quantity;
      productSales[item.productId].revenue += item.totalPrice;
    });
  });

  const topProducts = Object.values(productSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // Sales by cashier
  const cashierSales = {};
  filteredSales.forEach(sale => {
    if (!cashierSales[sale.cashier]) {
      cashierSales[sale.cashier] = {
        count: 0,
        revenue: 0
      };
    }
    cashierSales[sale.cashier].count += 1;
    cashierSales[sale.cashier].revenue += sale.total;
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const SaleDetailModal = ({ sale, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>Satış Detayı - {sale.id}</CardTitle>
          <div className="text-sm text-gray-600">
            <p>Tarih: {formatDate(sale.date)}</p>
            <p>Kasiyer: {sale.cashier}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-3">Satılan Ürünler</h3>
            <div className="space-y-2">
              {sale.items.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-500">{item.barcode}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{item.quantity} x {formatCurrency(item.unitPrice)}</p>
                    <p className="text-lg font-bold">{formatCurrency(item.totalPrice)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Ara Toplam:</span>
                <span>{formatCurrency(sale.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>KDV:</span>
                <span>{formatCurrency(sale.taxAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span>TOPLAM:</span>
                <span>{formatCurrency(sale.total)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              Kapat
            </Button>
            <Button>
              <Download className="h-4 w-4 mr-2" />
              PDF İndir
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Satış Raporları</h1>
        <Button>
          <Download className="h-4 w-4 mr-2" />
          Rapor İndir
        </Button>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Başlangıç Tarihi</label>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Bitiş Tarihi</label>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
              />
            </div>
            <Button>Filtrele</Button>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              Toplam Ciro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-gray-500">{filteredSales.length} satış</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-600" />
              Satılan Ürün
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalItemsSold}</div>
            <p className="text-xs text-gray-500">Toplam adet</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              Ortalama Satış
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(averageSaleValue)}</div>
            <p className="text-xs text-gray-500">Satış başına</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              En Çok Satan Ürünler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topProducts.length === 0 ? (
                <p className="text-center text-gray-500 py-4">Veri bulunamadı</p>
              ) : (
                topProducts.map((product, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{product.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline">{product.quantity} adet</Badge>
                      <p className="text-xs text-gray-500 mt-1">{formatCurrency(product.revenue)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cashier Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Kasiyer Performansı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.keys(cashierSales).length === 0 ? (
                <p className="text-center text-gray-500 py-4">Veri bulunamadı</p>
              ) : (
                Object.entries(cashierSales).map(([cashier, stats]) => (
                  <div key={cashier} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{cashier}</p>
                      <p className="text-sm text-gray-500">{stats.count} satış</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(stats.revenue)}</p>
                      <p className="text-xs text-gray-500">
                        Ort: {formatCurrency(stats.revenue / stats.count)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Satış Listesi
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSales.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Seçilen tarih aralığında satış bulunamadı</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Satış ID</th>
                    <th className="text-left py-2">Tarih</th>
                    <th className="text-left py-2">Kasiyer</th>
                    <th className="text-left py-2">Ürün Sayısı</th>
                    <th className="text-left py-2">Toplam</th>
                    <th className="text-right py-2">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 font-mono">{sale.id}</td>
                      <td className="py-3">{formatDate(sale.date)}</td>
                      <td className="py-3">{sale.cashier}</td>
                      <td className="py-3">
                        {sale.items.reduce((sum, item) => sum + item.quantity, 0)} adet
                      </td>
                      <td className="py-3 font-bold">{formatCurrency(sale.total)}</td>
                      <td className="py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedSale(sale)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Detay
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sale Detail Modal */}
      {selectedSale && (
        <SaleDetailModal
          sale={selectedSale}
          onClose={() => setSelectedSale(null)}
        />
      )}
    </div>
  );
};

export default SalesReports;