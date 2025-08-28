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
  // Kasiyer yardım paneli: son okutulan ürün bilgisi (alış fiyatı, satış fiyatı)
  const [lastScannedInfo, setLastScannedInfo] = useState(null); // { name, buy_price, sell_price }
  const [revealCost, setRevealCost] = useState(false);
  const [showHelper, setShowHelper] = useState(false); // varsayılan gizli
  const barcodeInputRef = useRef(null);
  const { toast } = useToast();

  // Focus barcode input on component mount and after each scan
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [cart]);

  // Kısayol: Alt+M ile kasiyer yardım panelini aç/kapat
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        setShowHelper((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Handle barcode input
  const handleBarcodeSubmit = async (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    setIsScanning(true);
    try {
      const product = await productsAPI.getProductByBarcode(barcodeInput.trim());
      if (product) {
        addToCart(product, quantityInput);
        // Kasiyer yardım paneline son okutulan ürünün maliyetini aktar
        setLastScannedInfo({
          name: product.name,
          buy_price: product.buy_price,
          sell_price: product.sell_price
        });
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
          ? {
            ...item,
            quantity: newQuantity,
            unit_price: product.sell_price,
            buy_price: product.buy_price,
            total_price: newQuantity * product.sell_price
          }
          : item
      ));
      // Güncel eklenen/okutulan ürün bilgisi (kasiyer yardım paneli için)
      setLastScannedInfo({ name: product.name, buy_price: product.buy_price, sell_price: product.sell_price });
    } else {
      const cartItem = {
        product_id: product.id,
        barcode: product.barcode,
        product_name: product.name,
        quantity: quantity,
        unit_price: product.sell_price,
        buy_price: product.buy_price,
        tax_rate: product.tax_rate,
        total_price: quantity * product.sell_price,
        available_stock: product.stock
      };
      setCart([...cart, cartItem]);
      // Yeni ürün eklendiğinde kasiyer yardım panelini güncelle
      setLastScannedInfo({ name: product.name, buy_price: product.buy_price, sell_price: product.sell_price });
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
    if (!currentSale) return;

    const COMPANY_NAME = process.env.REACT_APP_COMPANY_NAME || 'Malatya Avize Dünyası';
    const COMPANY_ADDRESS = process.env.REACT_APP_COMPANY_ADDRESS || 'Malatya, Türkiye';
    const formatDate = (dateString) => {
      if (!dateString) return '';
      return new Date(dateString).toLocaleDateString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    };

    const rows = (currentSale.items || []).map(i => `
      <tr>
        <td>${i.product_name}</td>
        <td style="text-align:right;">${i.quantity}</td>
        <td style="text-align:right;">${formatCurrency(i.unit_price)}</td>
        <td style="text-align:right;">${formatCurrency(i.total_price)}</td>
      </tr>`).join('');

    const title = `Satış Fişi - ${COMPANY_NAME} - ${currentSale.id || ''}`;
    const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"/>
      <title>${title}</title>
      <style>
        :root{--ink:#111;--muted:#555;--line:#ccc;--bg:#f5f5f5;--brand:#111}
        *{box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:var(--ink)}
        h1{font-size:18px;margin:0 0 8px}
        .meta{font-size:12px;color:var(--muted);margin-bottom:12px}
        .header{display:flex;align-items:center;gap:16px;border-bottom:2px solid var(--ink);padding-bottom:10px;margin-bottom:12px}
        .logo{width:54px;height:54px;display:flex;align-items:center;justify-content:center;border:1px solid var(--ink);border-radius:6px}
        .company h1{font-size:20px;margin:0}
        .company .addr{font-size:12px;color:var(--muted)}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th,td{border:1px solid var(--line);padding:6px;font-size:12px}
        th{background:var(--bg);text-align:left}
        .totals{margin-top:12px;float:right}
        .totals table{width:auto}
        .stamp{margin-top:28px;border:2px dashed var(--muted);border-radius:8px;padding:12px;width:220px;text-align:center;color:var(--muted)}
        .footer-note{margin-top:12px;font-size:11px;color:var(--muted)}
        @media print{body{padding:0 16px}}
      </style></head><body>
      <div class="header">
        <div class="logo" aria-hidden="true">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2c-3 0-5 2.5-5 5.5 0 1.7.8 3.2 2 4.2V14a3 3 0 0 0 2 2.83V20h2v-3.17A3 3 0 0 0 15 14v-2.3c1.2-1 2-2.5 2-4.2C17 4.5 15 2 12 2Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
            <circle cx="12" cy="8" r="1.8" fill="currentColor"/>
          </svg>
        </div>
        <div class="company">
          <h1>${COMPANY_NAME}</h1>
          <div class="addr">${COMPANY_ADDRESS}</div>
        </div>
      </div>
      <div class="meta">
        <div><strong>Belge:</strong> Satış Fişi</div>
        <div><strong>Tarih:</strong> ${formatDate(currentSale.created_at)}</div>
        <div><strong>Kasiyer:</strong> ${user.full_name}</div>
      </div>
      <table>
        <thead>
          <tr><th>Ürün</th><th>Adet</th><th>Birim</th><th>Toplam</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals">
        <table>
          <tr><th>Ara Toplam</th><td>${formatCurrency(currentSale.subtotal)}</td></tr>
          <tr><th>KDV</th><td>${formatCurrency(currentSale.tax_amount)}</td></tr>
          <tr><th>TOPLAM</th><td><strong>${formatCurrency(currentSale.total)}</strong></td></tr>
        </table>
      </div>
      <div style="clear:both"></div>
      <div class="stamp">Firma Kaşesi / İmza</div>
      <div class="footer-note">Bu fiş ${COMPANY_NAME} tarafından düzenlenmiştir. İade/değişim işlemlerinde fiş ve kaşe ibrazı gereklidir.</div>
      <script>window.onload=()=>{window.print(); setTimeout(()=>window.close(), 500)}</script>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    }
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
                  <div
                    key={item.product_id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer"
                    onClick={() => {
                      // Sadece bilgiyi güncelle; görünürlük kullanıcı kontrolünde kalsın
                      setLastScannedInfo({ name: item.product_name, buy_price: item.buy_price, sell_price: item.unit_price });
                    }}
                  >
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
        <Card onDoubleClick={() => setShowHelper((v) => !v)}>
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

        {/* Kasiyer Yardım: Müşteriye belli etmeden maliyet görüntüleme (varsayılan gizli) */}
        {showHelper && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-600">
                  <Calculator className="h-4 w-4" />
                  Kasiyer Yardım
                </span>
                <Button size="sm" variant="outline" onClick={() => setRevealCost(v => !v)} title="Maliyeti göster/gizle">
                  {revealCost ? 'Gizle' : 'Göster'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lastScannedInfo ? (
                <div className="text-xs space-y-1">
                  <div className="text-gray-500">Son Ürün:</div>
                  <div className="font-medium truncate" title={lastScannedInfo.name}>{lastScannedInfo.name}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">M:</span>
                    <span className="font-semibold">
                      {revealCost && (lastScannedInfo.buy_price ?? 0) > 0 ? (
                        formatCurrency(lastScannedInfo.buy_price)
                      ) : (
                        '•••'
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-500">
                    <span>Satış:</span>
                    <span>{formatCurrency(lastScannedInfo.sell_price || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-500">
                    <span>Marj:</span>
                    <span>
                      {(() => {
                        const b = Number(lastScannedInfo.buy_price) || 0;
                        const s = Number(lastScannedInfo.sell_price) || 0;
                        if (b <= 0 || s <= 0) return '—';
                        const pct = ((s - b) / b) * 100;
                        return `%${pct.toFixed(1)}`;
                      })()}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">Not: Bu bölüm müşteriye açıklanmaz. (Alt+M ile aç/kapat)</p>
                </div>
              ) : (
                <p className="text-xs text-gray-500">Barkod okutulduğunda maliyet burada görünecek.</p>
              )}
            </CardContent>
          </Card>
        )}

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