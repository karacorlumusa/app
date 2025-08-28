import React, { useEffect, useState } from 'react';
import {
  Package,
  Plus,
  TrendingUp,
  TrendingDown,
  Search,
  AlertTriangle
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { useToast } from '../hooks/use-toast';
import { productsAPI } from '../services/api';

const StockManagement = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showStockForm, setShowStockForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchTerm) params.search = searchTerm;
      const data = await productsAPI.getProducts(params);
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Stok ürünleri yüklenemedi:', err);
      toast({ title: 'Hata', description: 'Stok ürünleri yüklenemedi', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    const term = searchTerm.toLowerCase();
    return (
      product.name?.toLowerCase().includes(term) ||
      String(product.barcode || '').includes(searchTerm) ||
      product.brand?.toLowerCase().includes(term)
    );
  });

  const lowStockProducts = products.filter((product) => product.stock <= (product.min_stock ?? 0));

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount);
  };

  const StockEntryForm = ({ product, onClose }) => {
    const [entryType, setEntryType] = useState('in'); // 'in' for stock in, 'out' for stock out
    const [quantity, setQuantity] = useState('');
    const [unitPrice, setUnitPrice] = useState(product?.buy_price ?? '');
    const [supplier, setSupplier] = useState(product?.supplier || '');
    const [note, setNote] = useState('');

    const handleSubmit = (e) => {
      e.preventDefault();

      if (!quantity || quantity <= 0) {
        toast({
          title: "Geçersiz miktar",
          description: "Lütfen geçerli bir miktar girin",
          variant: "destructive"
        });
        return;
      }

      const quantityNum = parseInt(quantity);
      const newStock = entryType === 'in'
        ? (product.stock || 0) + quantityNum
        : Math.max(0, (product.stock || 0) - quantityNum);

      try {
        // Persist by updating the product stock (and optionally buy price/supplier on stock-in)
        const payload = {
          stock: newStock,
        };
        if (entryType === 'in') {
          if (unitPrice !== '' && !Number.isNaN(parseFloat(unitPrice))) {
            payload.buy_price = parseFloat(unitPrice);
          }
          if (supplier) payload.supplier = supplier;
        }
        await productsAPI.updateProduct(product.id, payload);

        toast({
          title: entryType === 'in' ? 'Stok girişi yapıldı' : 'Stok çıkışı yapıldı',
          description: `${product.name}: ${quantityNum} adet ${entryType === 'in' ? 'eklendi' : 'çıkarıldı'}`,
        });

        await loadProducts();
        onClose();
      } catch (err) {
        console.error('Stok güncellenemedi:', err);
        toast({ title: 'Hata', description: 'Stok güncellenemedi', variant: 'destructive' });
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Stok Hareketi</CardTitle>
            <p className="text-sm text-gray-600">{product.name}</p>
            <p className="text-xs text-gray-500">Mevcut Stok: {product.stock} adet</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">İşlem Tipi</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={entryType === 'in' ? 'default' : 'outline'}
                    onClick={() => setEntryType('in')}
                    className="flex-1"
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Stok Girişi
                  </Button>
                  <Button
                    type="button"
                    variant={entryType === 'out' ? 'default' : 'outline'}
                    onClick={() => setEntryType('out')}
                    className="flex-1"
                  >
                    <TrendingDown className="h-4 w-4 mr-2" />
                    Stok Çıkışı
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Miktar</label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Adet girin"
                  required
                />
              </div>

              {entryType === 'in' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Birim Alış Fiyatı (₺)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value)}
                      placeholder="Alış fiyatı"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Tedarikçi</label>
                    <Input
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                      placeholder="Tedarikçi adı"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Not</label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="İsteğe bağlı not"
                />
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                  İptal
                </Button>
                <Button type="submit" className="flex-1">
                  {entryType === 'in' ? 'Giriş Yap' : 'Çıkış Yap'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Stok Yönetimi</h1>
      </div>

      {/* Stock Alerts */}
      {lowStockProducts.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{lowStockProducts.length} ürün</strong> kritik stok seviyesinde!
          </AlertDescription>
        </Alert>
      )}

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Ürün adı, barkod veya marka ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Stok Listesi ({filteredProducts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <Alert>
              <Package className="h-4 w-4" />
              <AlertDescription>
                Arama kriterinize uygun ürün bulunamadı.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Ürün</th>
                    <th className="text-left py-2">Barkod</th>
                    <th className="text-left py-2">Mevcut Stok</th>
                    <th className="text-left py-2">Min. Stok</th>
                    <th className="text-left py-2">Durum</th>
                    <th className="text-left py-2">Alış Fiyatı</th>
                    <th className="text-right py-2">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const stockStatus = product.stock <= (product.min_stock ?? 0) ? 'critical' : 'normal';

                    return (
                      <tr key={product.id} className="border-b hover:bg-gray-50">
                        <td className="py-3">
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-gray-500">{product.category} - {product.brand}</p>
                          </div>
                        </td>
                        <td className="py-3">
                          <code className="text-sm bg-gray-100 px-2 py-1 rounded">{product.barcode}</code>
                        </td>
                        <td className="py-3">
                          <span className={`font-bold ${stockStatus === 'critical' ? 'text-red-600' : 'text-green-600'}`}>
                            {product.stock} adet
                          </span>
                        </td>
                        <td className="py-3">{product.min_stock} adet</td>
                        <td className="py-3">
                          <Badge variant={stockStatus === 'critical' ? 'destructive' : 'default'}>
                            {stockStatus === 'critical' ? 'Kritik' : 'Normal'}
                          </Badge>
                        </td>
                        <td className="py-3">{formatCurrency(product.buy_price || 0)}</td>
                        <td className="py-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedProduct(product);
                              setShowStockForm(true);
                            }}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Stok Hareketi
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stock Entry Form */}
      {showStockForm && selectedProduct && (
        <StockEntryForm
          product={selectedProduct}
          onClose={() => {
            setShowStockForm(false);
            setSelectedProduct(null);
          }}
        />
      )}
    </div>
  );
};

export default StockManagement;