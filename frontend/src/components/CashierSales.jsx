import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ShoppingCart,
  Scan,
  Plus,
  Minus,
  Trash2,
  Calculator,
  Receipt,
  User,
  Package
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { productsAPI, salesAPI } from '../services/api';
import { useToast } from '../hooks/use-toast';

const CashierSales = ({ user }) => {
  const [cart, setCart] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [quantityInput, setQuantityInput] = useState(1);
  const [currentSale, setCurrentSale] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const barcodeInputRef = useRef(null);
  const { toast } = useToast();

  // Focus barcode input on component mount and after each scan
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [cart]);

  // Handle barcode input
  const handleBarcodeSubmit = async (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    setIsScanning(true);
    try {
      const product = await productsAPI.getProductByBarcode(barcodeInput.trim());
      if (product) {
        addToCart(product, quantityInput);
        setBarcodeInput('');
        setQuantityInput(1);
      } else {
        toast({
          title: "Ürün bulunamadı",
          description: `Barkod: ${barcodeInput}`,
          variant: "destructive"
        });
        setBarcodeInput('');
      }
    } catch (error) {
      console.error('Barcode scan error:', error);
      toast({
        title: "Hata",
        description: "Barkod taranırken hata oluştu",
        variant: "destructive"
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Add product to cart
  const addToCart = (product, quantity) => {
    if (product.stock < quantity) {
      toast({
        title: "Yetersiz stok",
        description: `Sadece ${product.stock} adet mevcut`,
        variant: "destructive"
      });
      return;
    }

    const existingItem = cart.find(item => item.product_id === product.id);

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity > product.stock) {
        toast({
          title: "Yetersiz stok",
          description: `Maksimum ${product.stock} adet ekleyebilirsiniz`,
          variant: "destructive"
        });
        return;
      }

      setCart(cart.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: newQuantity, total_price: newQuantity * product.sell_price }
          : item
      ));
    } else {
      const cartItem = {
        product_id: product.id,
        barcode: product.barcode,
        product_name: product.name,
        quantity: quantity,
        unit_price: product.sell_price,
        tax_rate: product.tax_rate,
        total_price: quantity * product.sell_price,
        available_stock: product.stock
      };
      setCart([...cart, cartItem]);
    }

    toast({
      title: "Ürün eklendi",
      description: `${product.name} (${quantity} adet)`,
    });
  };

  // Update item quantity
  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const item = cart.find(item => item.product_id === productId);
    if (item && newQuantity > item.available_stock) {
      toast({
        title: "Yetersiz stok",
        description: `Maksimum ${item.available_stock} adet`,
        variant: "destructive"
      });
      return;
    }

    setCart(cart.map(item =>
      item.product_id === productId
        ? { ...item, quantity: newQuantity, total_price: newQuantity * item.unit_price }
        : item
    ));
  };

  // Remove item from cart
  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
    setBarcodeInput('');
    setQuantityInput(1);
  };

  // Calculate totals (VAT-inclusive pricing):
  // - item.unit_price and item.total_price are gross (KDV dahil)
  // - derive net and tax from gross so we don't add KDV on top again
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const totals = cart.reduce(
    (acc, item) => {
      const gross = item.total_price || 0; // quantity * unit_price (KDV dahil)
      const rate = ((item.tax_rate ?? 0) / 100);
      const net = rate > 0 ? gross / (1 + rate) : gross;
      const tax = gross - net;
      acc.subtotal += net;
      acc.tax += tax;
      acc.total += gross;
      return acc;
    },
    { subtotal: 0, tax: 0, total: 0 }
  );
  const subtotal = round2(totals.subtotal);
  const taxAmount = round2(totals.tax);
  const total = round2(totals.total);

  // Process sale
  const processSale = async () => {
    if (cart.length === 0) {
      toast({
        title: "Sepet boş",
        description: "Satış yapmak için sepete ürün ekleyin",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      const saleData = {
        items: cart.map(item => ({
          product_id: item.product_id,
          barcode: item.barcode,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate
        }))
      };

      const sale = await salesAPI.createSale(saleData);

      setCurrentSale(sale);
      clearCart();

      toast({
        title: "Satış tamamlandı",
        description: `Toplam: ${formatCurrency(sale.total)}`,
      });

    } catch (error) {
      console.error('Sale processing error:', error);
      toast({
        title: "Satış hatası",
        description: error.response?.data?.detail || "Satış işlemi başarısız",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount);
  };

  const printReceipt = () => {
    // In a real application, this would send to printer
    toast({
      title: "Fiş yazdırılıyor",
      description: "Fiş yazıcıya gönderildi",
    });
    setCurrentSale(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-screen max-h-screen">
      {/* Left: Barcode Scanner & Product Search */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scan className="h-5 w-5" />
              Barkod Okuyucu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
              <div className="flex-1">
                <Input
                  ref={barcodeInputRef}
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Barkod okutun veya yazın..."
                  className="text-lg h-12"
                  disabled={isScanning}
                />
              </div>
              <div className="w-24">
                <Input
                  type="number"
                  min="1"
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(parseInt(e.target.value) || 1)}
                  placeholder="Adet"
                  className="h-12"
                  disabled={isScanning}
                />
              </div>
              <Button type="submit" size="lg" disabled={isScanning}>
                {isScanning ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Shopping Cart */}
        <Card className="flex-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Sepet ({cart.length} ürün)
            </CardTitle>
            {cart.length > 0 && (
              <Button variant="outline" size="sm" onClick={clearCart}>
                <Trash2 className="h-4 w-4 mr-2" />
                Temizle
              </Button>
            )}
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <Alert>
                <Package className="h-4 w-4" />
                <AlertDescription>
                  Sepet boş. Barkod okutarak ürün ekleyin.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.product_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.product_name}</p>
                      <p className="text-xs text-gray-500">{item.barcode}</p>
                      <p className="text-sm font-bold text-blue-600">{formatCurrency(item.unit_price)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>

                      <span className="w-12 text-center font-bold">{item.quantity}</span>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromCart(item.product_id)}
                      >
                        <Trash2 className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>

                    <div className="text-right ml-4">
                      <p className="font-bold">{formatCurrency(item.total_price)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right: Sale Summary & Actions */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Kasiyer Bilgisi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{user.full_name}</p>
            <p className="text-sm text-gray-500">{user.username}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Satış Özeti
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Ara Toplam:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>

              <div className="flex justify-between">
                <span>KDV:</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>

              <div className="border-t pt-2">
                <div className="flex justify-between font-bold text-lg">
                  <span>TOPLAM:</span>
                  <span className="text-green-600">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            <Button
              onClick={processSale}
              disabled={cart.length === 0 || isProcessing}
              className="w-full h-12 text-lg"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  İşleniyor...
                </>
              ) : (
                <>
                  <span className="mr-2 text-lg" aria-hidden>₺</span>
                  Satışı Tamamla
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Sale Receipt Modal (rendered in portal to avoid DOM reconciliation issues) */}
      {currentSale &&
        createPortal(
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <CardTitle className="text-green-600">Satış Tamamlandı!</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Satış No: #{currentSale.id?.slice?.(-8) || '-'}</p>
                  <p className="text-sm text-gray-600">
                    {currentSale.created_at ? new Date(currentSale.created_at).toLocaleString('tr-TR') : ''}
                  </p>
                  <p className="text-sm text-gray-600">Kasiyer: {user.full_name}</p>
                </div>

                <div className="border rounded-lg p-4 bg-gray-50">
                  <div className="space-y-1">
                    {currentSale.items?.map((item, index) => (
                      <div key={`${item.product_id || index}-${index}`} className="flex justify-between text-sm">
                        <span>{item.product_name} x{item.quantity}</span>
                        <span>{formatCurrency(item.total_price)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t mt-2 pt-2 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Ara Toplam:</span>
                      <span>{formatCurrency(currentSale.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>KDV:</span>
                      <span>{formatCurrency(currentSale.tax_amount)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>TOPLAM:</span>
                      <span>{formatCurrency(currentSale.total)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={printReceipt} className="flex-1">
                    <Receipt className="h-4 w-4 mr-2" />
                    Fiş Yazdır
                  </Button>
                  <Button variant="outline" onClick={() => setCurrentSale(null)}>
                    Kapat
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>,
          document.body
        )}
    </div>
  );
};

export default CashierSales;