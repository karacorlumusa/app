import React, { useState, useRef, useEffect } from 'react';
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
import { mockProducts, simulateBarcodeScan } from '../mock/mockData';
import { useToast } from '../hooks/use-toast';

const CashierSales = ({ user }) => {
  const [cart, setCart] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [quantityInput, setQuantityInput] = useState(1);
  const [currentSale, setCurrentSale] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const barcodeInputRef = useRef(null);
  const { toast } = useToast();

  // Focus barcode input on component mount and after each scan
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [cart]);

  // Handle barcode input
  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const product = simulateBarcodeScan(barcodeInput.trim());
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

    const existingItem = cart.find(item => item.productId === product.id);
    
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
        item.productId === product.id
          ? { ...item, quantity: newQuantity, totalPrice: newQuantity * product.sellPrice }
          : item
      ));
    } else {
      const cartItem = {
        productId: product.id,
        barcode: product.barcode,
        name: product.name,
        unitPrice: product.sellPrice,
        quantity: quantity,
        totalPrice: quantity * product.sellPrice,
        taxRate: product.taxRate,
        availableStock: product.stock
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

    const item = cart.find(item => item.productId === productId);
    if (item && newQuantity > item.availableStock) {
      toast({
        title: "Yetersiz stok",
        description: `Maksimum ${item.availableStock} adet`,
        variant: "destructive"
      });
      return;
    }

    setCart(cart.map(item =>
      item.productId === productId
        ? { ...item, quantity: newQuantity, totalPrice: newQuantity * item.unitPrice }
        : item
    ));
  };

  // Remove item from cart
  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
    setBarcodeInput('');
    setQuantityInput(1);
  };

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const taxAmount = cart.reduce((sum, item) => sum + (item.totalPrice * item.taxRate / 100), 0);
  const total = subtotal + taxAmount;

  // Process sale
  const processSale = () => {
    if (cart.length === 0) {
      toast({
        title: "Sepet boş",
        description: "Satış yapmak için sepete ürün ekleyin",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    // Simulate processing delay
    setTimeout(() => {
      const saleData = {
        id: `S${Date.now()}`,
        date: new Date().toISOString(),
        cashier: user.fullName,
        items: cart,
        subtotal,
        taxAmount,
        total
      };

      setCurrentSale(saleData);
      clearCart();
      setIsProcessing(false);

      toast({
        title: "Satış tamamlandı",
        description: `Toplam: ${formatCurrency(total)}`,
      });
    }, 1500);
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
                />
              </div>
              <Button type="submit" size="lg">
                <Plus className="h-4 w-4" />
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
                  <div key={item.productId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.barcode}</p>
                      <p className="text-sm font-bold text-blue-600">{formatCurrency(item.unitPrice)}</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      
                      <span className="w-12 text-center font-bold">{item.quantity}</span>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromCart(item.productId)}
                      >
                        <Trash2 className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                    
                    <div className="text-right ml-4">
                      <p className="font-bold">{formatCurrency(item.totalPrice)}</p>
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
            <p className="font-medium">{user.fullName}</p>
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
                  <Receipt className="h-5 w-5 mr-2" />
                  Satışı Tamamla
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Sale Receipt Modal */}
      {currentSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-green-600">Satış Tamamlandı!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Satış No: {currentSale.id}</p>
                <p className="text-sm text-gray-600">
                  {new Date(currentSale.date).toLocaleString('tr-TR')}
                </p>
                <p className="text-sm text-gray-600">Kasiyer: {currentSale.cashier}</p>
              </div>
              
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="space-y-1">
                  {currentSale.items.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>{item.name} x{item.quantity}</span>
                      <span>{formatCurrency(item.totalPrice)}</span>
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
                    <span>{formatCurrency(currentSale.taxAmount)}</span>
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
        </div>
      )}
    </div>
  );
};

export default CashierSales;