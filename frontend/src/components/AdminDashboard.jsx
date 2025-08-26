import React, { useState } from 'react';
import { 
  BarChart3, 
  Package, 
  ShoppingCart, 
  Users, 
  TrendingUp, 
  AlertTriangle,
  DollarSign,
  Box
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { mockProducts, mockSales } from '../mock/mockData';

const AdminDashboard = () => {
  const [timeRange, setTimeRange] = useState('today');

  // Calculate statistics
  const totalProducts = mockProducts.length;
  const totalStock = mockProducts.reduce((sum, product) => sum + product.stock, 0);
  const lowStockItems = mockProducts.filter(product => product.stock <= product.minStock);
  
  const todaySales = mockSales.filter(sale => {
    const saleDate = new Date(sale.date);
    const today = new Date();
    return saleDate.toDateString() === today.toDateString();
  });
  
  const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.total, 0);
  const todayItemsSold = todaySales.reduce((sum, sale) => 
    sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
  );

  // Top selling products (mock calculation)
  const topProducts = mockProducts
    .map(product => ({
      ...product,
      soldQuantity: Math.floor(Math.random() * 20) + 1
    }))
    .sort((a, b) => b.soldQuantity - a.soldQuantity)
    .slice(0, 5);

  // Recent low stock alerts
  const recentAlerts = lowStockItems.slice(0, 5);

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
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Admin Paneli</h1>
        <div className="flex items-center gap-2">
          <select 
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="today">Bugün</option>
            <option value="week">Bu Hafta</option>
            <option value="month">Bu Ay</option>
          </select>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-600" />
              Toplam Ürün
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
            <p className="text-xs text-gray-500">Aktif ürün sayısı</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Box className="h-4 w-4 text-green-600" />
              Toplam Stok
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStock}</div>
            <p className="text-xs text-gray-500">Adet cinsinden</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-purple-600" />
              Günlük Ciro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(todayRevenue)}</div>
            <p className="text-xs text-gray-500">Bugünkü satış</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Stok Uyarısı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{lowStockItems.length}</div>
            <p className="text-xs text-gray-500">Kritik seviye</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Çok Satan Ürünler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topProducts.map((product, index) => (
                <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">{product.soldQuantity} adet</Badge>
                    <p className="text-xs text-gray-500 mt-1">{formatCurrency(product.sellPrice)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Stok Uyarıları
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentAlerts.length === 0 ? (
                <p className="text-center text-gray-500 py-4">Stok uyarısı bulunmamaktadır</p>
              ) : (
                recentAlerts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.category}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="destructive">{product.stock} adet</Badge>
                      <p className="text-xs text-red-600 mt-1">Min: {product.minStock}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-green-600" />
            Son Satışlar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockSales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium">Satış #{sale.id}</p>
                  <p className="text-sm text-gray-500">Kasiyer: {sale.cashier}</p>
                  <p className="text-xs text-gray-400">{formatDate(sale.date)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">{formatCurrency(sale.total)}</p>
                  <p className="text-sm text-gray-500">
                    {sale.items.reduce((sum, item) => sum + item.quantity, 0)} ürün
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;