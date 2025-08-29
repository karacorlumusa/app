import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  AlertTriangle,
  Filter,
  Download,
  Upload
} from 'lucide-react';
import { Printer } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { productsAPI } from '../services/api';
import JsBarcode from 'jsbarcode';
import { useToast } from '../hooks/use-toast';

const ProductManagement = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    loadProducts();
  }, [searchTerm, categoryFilter, stockFilter]);

  const loadProducts = async () => {
    try {
      setLoading(true);

      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (stockFilter === 'low') params.low_stock = true;

      const data = await productsAPI.getProducts(params);
      setProducts(data);

      // Extract unique categories
      const uniqueCategories = [...new Set(data.map(p => p.category))];
      setCategories(uniqueCategories);

    } catch (error) {
      console.error('Failed to load products:', error);
      toast({
        title: "Hata",
        description: "Ürünler yüklenemedi",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount);
  };

  const calculateProfitMargin = (buyPrice, sellPrice) => {
    return ((sellPrice - buyPrice) / buyPrice * 100).toFixed(1);
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setShowAddForm(true);
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setShowAddForm(true);
  };

  const handleDeleteProduct = async (product) => {
    if (window.confirm(`"${product.name}" ürününü silmek istediğinizden emin misiniz?`)) {
      try {
        await productsAPI.deleteProduct(product.id);
        toast({
          title: "Ürün silindi",
          description: "Ürün başarıyla silindi.",
        });
        loadProducts();
      } catch (error) {
        toast({
          title: "Hata",
          description: "Ürün silinirken hata oluştu",
          variant: "destructive"
        });
      }
    }
  };

  const printProductBarcode = (product) => {
    if (!product?.barcode) {
      toast({ title: 'Barkod yok', description: 'Bu üründe barkod bulunmuyor', variant: 'destructive' });
      return;
    }
    // Build SVG markup with JsBarcode into a detached SVG element
    const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    try {
      JsBarcode(tempSvg, String(product.barcode), {
        format: 'CODE128',
        lineColor: '#000',
        width: 2,
        height: 60,
        displayValue: true,
        font: 'monospace',
        fontSize: 14,
        textMargin: 2,
        margin: 8
      });
    } catch (e) {
      console.warn('Barcode render failed', e);
      toast({ title: 'Barkod oluşturulamadı', description: 'Yazdırma sırasında hata oluştu', variant: 'destructive' });
      return;
    }
    const win = window.open('', 'PRINT', 'height=600,width=400');
    if (!win) return;
    const style = `
      <style>
        @page { size: auto; margin: 8mm; }
        body { font-family: Arial, sans-serif; }
        .label { display: flex; flex-direction: column; align-items: center; }
        .name { font-size: 14px; font-weight: 600; margin-bottom: 6px; text-align: center; }
        .price { font-size: 12px; margin-top: 4px; }
        svg { width: 280px; height: auto; }
      </style>
    `;
    const name = product.name || '';
    const price = product.sell_price ? `${formatCurrency(product.sell_price)}` : '';
    win.document.write(`<!DOCTYPE html><html><head><title>Barkod Yazdır</title>${style}</head><body>`);
    win.document.write(`<div class="label">`);
    win.document.write(`<div class="name">${name}</div>`);
    win.document.write(tempSvg.outerHTML);
    if (price) {
      win.document.write(`<div class="price">${price}</div>`);
    }
    win.document.write(`</div></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 100);
  };

  const ProductForm = ({ product, onClose }) => {
    const [formData, setFormData] = useState(product || {
      barcode: '',
      name: '',
      category: '',
      brand: '',
      stock: 0,
      min_stock: 0,
      buy_price: 0,
      sell_price: 0,
      tax_rate: 18,
      supplier: ''
    });
    const [saving, setSaving] = useState(false);
    const existingBarcodes = useMemo(() => new Set(products.map(p => String(p.barcode))), [products]);
    const barcodeRef = useRef(null);
    const lastStrongSetRef = useRef(0); // paste/generate sonrası kısa süreli değişiklik kilidi

    const handleBarcodeChange = (e) => {
      const v = e.target.value;
      // Son güçlü setten (paste/generate) hemen sonra gelen boşaltma olaylarını yok say
      if (v === '' && Date.now() - lastStrongSetRef.current < 600) return;
      setFormData(prev => ({ ...prev, barcode: v }));
    };
    const handleBarcodePaste = (e) => {
      try {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
        lastStrongSetRef.current = Date.now();
        const v = String(text).trim();
        setFormData(prev => ({ ...prev, barcode: v }));
        // Move caret to end after render
        setTimeout(() => {
          const el = barcodeRef.current;
          if (el && typeof el.setSelectionRange === 'function') {
            const len = v.length;
            try { el.setSelectionRange(len, len); } catch { }
          }
        }, 0);
      } catch {
        // Fallback: let default paste proceed
      }
    };

    const handleGenerateBarcode = async () => {
      try {
        // Prefer backend-generated unique barcode (server enforces uniqueness)
        const code = await productsAPI.generateBarcode();
        if (!code) throw new Error('Barkod alınamadı');
        // Update state (controlled input)
        const codeStr = String(code);
        setFormData(prev => ({ ...prev, barcode: codeStr }));
        // Also reflect immediately in the input for visual feedback
        requestAnimationFrame(() => {
          const el = barcodeRef.current;
          if (el) {
            el.value = codeStr;
            el.focus();
            try { el.setSelectionRange(codeStr.length, codeStr.length); } catch { }
          }
        });
        lastStrongSetRef.current = Date.now();
        // Best-effort: also copy to clipboard
        try { await navigator.clipboard.writeText(codeStr); } catch { }
        toast({ title: 'Barkod oluşturuldu', description: codeStr });
      } catch (err) {
        // Fallback to client-side generator if backend not available
        const random2 = Math.floor(Math.random() * 90 + 10);
        const ms = Date.now().toString().slice(-9);
        let candidate = `869${ms}${random2}`;
        let attempts = 0;
        while (existingBarcodes.has(candidate) && attempts < 5) {
          const r = Math.floor(Math.random() * 9000 + 1000);
          candidate = `869${Date.now().toString().slice(-8)}${r}`;
          attempts++;
        }
        const codeStr = String(candidate);
        setFormData(prev => ({ ...prev, barcode: codeStr }));
        requestAnimationFrame(() => {
          const el = barcodeRef.current;
          if (el) {
            el.value = codeStr;
            el.focus();
            try { el.setSelectionRange(codeStr.length, codeStr.length); } catch { }
          }
        });
        lastStrongSetRef.current = Date.now();
        try { await navigator.clipboard.writeText(codeStr); } catch { }
        toast({ title: 'Barkod oluşturuldu (yerel)', description: codeStr });
      }
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      setSaving(true);

      try {
        if (product) {
          // Edit existing product
          await productsAPI.updateProduct(product.id, formData);
          toast({
            title: "Ürün güncellendi",
            description: "Ürün bilgileri başarıyla güncellendi.",
          });
        } else {
          // Add new product
          await productsAPI.createProduct(formData);
          toast({
            title: "Ürün eklendi",
            description: "Yeni ürün başarıyla eklendi.",
          });
        }

        onClose();
        loadProducts();
      } catch (error) {
        console.error('Save error:', error);
        toast({
          title: "Hata",
          description: error.response?.data?.detail || "Ürün kaydedilemedi",
          variant: "destructive"
        });
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <CardHeader>
            <CardTitle>{product ? 'Ürün Düzenle' : 'Yeni Ürün Ekle'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Barkod</label>
                  <div className="flex gap-2">
                    <Input
                      ref={barcodeRef}
                      type="text"
                      autoComplete="off"
                      name="barcode"
                      value={formData.barcode}
                      onChange={handleBarcodeChange}
                      onPaste={handleBarcodePaste}
                      placeholder="Barkod numarası"
                      required
                      className="flex-1"
                    />
                    {!product && (
                      <Button type="button" variant="secondary" onClick={handleGenerateBarcode} title="Barkod oluştur ve alana yapıştır">
                        Barkod Oluştur
                      </Button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Ürün Adı</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ürün adı"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Kategori</label>
                  <Input
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Kategori"
                    list="categories"
                    required
                  />
                  <datalist id="categories">
                    {categories.map((category, idx) => (
                      <option key={`${category || 'empty'}-${idx}`} value={category} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Marka</label>
                  <Input
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="Marka adı"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Stok Miktarı</label>
                  <Input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                    placeholder="Stok adedi"
                    min="0"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Minimum Stok</label>
                  <Input
                    type="number"
                    value={formData.min_stock}
                    onChange={(e) => setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })}
                    placeholder="Minimum stok adedi"
                    min="0"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Alış Fiyatı (₺)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.buy_price}
                    onChange={(e) => setFormData({ ...formData, buy_price: parseFloat(e.target.value) || 0 })}
                    placeholder="Alış fiyatı"
                    min="0"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Satış Fiyatı (KDV Dahil) (₺)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.sell_price}
                    onChange={(e) => setFormData({ ...formData, sell_price: parseFloat(e.target.value) || 0 })}
                    placeholder="Satış fiyatı (KDV dahil)"
                    min="0"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">Bu alan KDV dahil fiyatı temsil eder.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">KDV Oranı (%)</label>
                  <select
                    value={formData.tax_rate}
                    onChange={(e) => setFormData({ ...formData, tax_rate: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>%1</option>
                    <option value={8}>%8</option>
                    <option value={18}>%18</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Tedarikçi</label>
                  <Input
                    value={formData.supplier || ''}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    placeholder="Tedarikçi adı"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button type="button" variant="outline" onClick={onClose}>
                  İptal
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Kaydediliyor...' : (product ? 'Güncelle' : 'Ekle')}
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
        <h1 className="text-3xl font-bold">Ürün Yönetimi</h1>
        <Button onClick={handleAddProduct}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Ürün
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Ürün adı, barkod veya marka ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tüm Kategoriler</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>

            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tüm Stoklar</option>
              <option value="low">Düşük Stok</option>
              <option value="normal">Normal Stok</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Products List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Ürünler ({products.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : products.length === 0 ? (
            <Alert>
              <Package className="h-4 w-4" />
              <AlertDescription>
                Filtrelere uygun ürün bulunamadı.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Ürün</th>
                    <th className="text-left py-2">Barkod</th>
                    <th className="text-left py-2">Stok</th>
                    <th className="text-left py-2">Alış Fiyatı</th>
                    <th className="text-left py-2">Satış Fiyatı (KDV Dahil)</th>
                    <th className="text-left py-2">Kar Marjı</th>
                    <th className="text-right py-2">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, idx) => (
                    <tr key={`${product.id}-${idx}`} className="border-b hover:bg-gray-50">
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
                        <div className="flex items-center gap-2">
                          <span className={product.stock <= product.min_stock ? 'text-red-600 font-bold' : ''}>
                            {product.stock}
                          </span>
                          {product.stock <= product.min_stock && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </td>
                      <td className="py-3">{formatCurrency(product.buy_price)}</td>
                      <td className="py-3">{formatCurrency(product.sell_price)}</td>
                      <td className="py-3">
                        <Badge variant="outline">
                          %{calculateProfitMargin(product.buy_price, product.sell_price)}
                        </Badge>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditProduct(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteProduct(product)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => printProductBarcode(product)}
                            title="Barkodu Yazdır"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <ProductForm
          product={editingProduct}
          onClose={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
};

export default ProductManagement;