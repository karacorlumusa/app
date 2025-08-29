import React, { useEffect, useRef, useState } from 'react';
import { Search, TrendingUp, Barcode } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { useToast } from '../hooks/use-toast';
import { productsAPI, stockAPI } from '../services/api';

const CashierStock = () => {
    const { toast } = useToast();
    const [barcode, setBarcode] = useState('');
    const [product, setProduct] = useState(null);
    const [qty, setQty] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const debounceRef = useRef();

    const handleFind = async () => {
        const term = barcode.trim();
        if (!term) return;
        setLoading(true);
        try {
            // Try exact barcode first
            const p = await productsAPI.getProductByBarcode(term);
            if (p) {
                setProduct(p);
                setQty('');
                setResults([]);
                return;
            }
        } catch {
            // ignore, fallback to name search
        }
        try {
            // Fallback: use the first match from name search if any
            if (results && results.length > 0) {
                selectProduct(results[0]);
            } else {
                // Query backend once if results are empty
                const list = await productsAPI.getProducts({ search: term, limit: 10 });
                if (Array.isArray(list) && list.length > 0) {
                    selectProduct(list[0]);
                } else {
                    setProduct(null);
                    toast({ title: 'Ürün bulunamadı', description: 'Barkod veya isim ile eşleşen ürün yok', variant: 'destructive' });
                }
            }
        } catch (err) {
            toast({ title: 'Hata', description: 'Ürün sorgulanamadı', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const selectProduct = (p) => {
        setProduct(p);
        setQty('');
        setResults([]);
    };

    const handleSearchChange = (e) => {
        const v = e.target.value;
        setBarcode(v);
        setProduct(null);
        setResults([]);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        // Start searching after 2+ chars
        if (v.trim().length >= 2) {
            setSearching(true);
            debounceRef.current = setTimeout(async () => {
                try {
                    const list = await productsAPI.getProducts({ search: v.trim(), limit: 10 });
                    setResults(Array.isArray(list) ? list : []);
                } catch {
                    setResults([]);
                } finally {
                    setSearching(false);
                }
            }, 300);
        } else {
            setSearching(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!product) return;
        const q = parseInt(qty, 10);
        if (!q || q <= 0) {
            toast({ title: 'Geçersiz miktar', description: 'Lütfen 1 veya daha büyük bir miktar girin', variant: 'destructive' });
            return;
        }
        setSubmitting(true);
        try {
            await stockAPI.createMovement({
                product_id: product.id,
                type: 'in',
                quantity: q,
                // Kasıyer fiyat belirleyemez: unit_price/supplier gönderilmiyor
                note: 'Kasiyer stok girişi'
            });
            toast({ title: 'Stok girişi yapıldı', description: `${product.name}: ${q} adet eklendi` });
            // UI'da anında güncelle
            setProduct({ ...product, stock: (product.stock || 0) + q });
            setQty('');
            setBarcode('');
        } catch (err) {
            toast({ title: 'Hata', description: 'Stok girişi başarısız', variant: 'destructive' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Stok Girişi (Kasiyer)</h1>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="relative md:col-span-2">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Barkod veya ürün adı yazın"
                                value={barcode}
                                onChange={handleSearchChange}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleFind(); }}
                                className="pl-10"
                                autoFocus
                            />
                            {/* Results dropdown */}
                            {!product && (results.length > 0) && (
                                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow max-h-64 overflow-auto z-10">
                                    {results.map((r, idx) => (
                                        <button
                                            type="button"
                                            key={`${r.id}-${idx}`}
                                            className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between"
                                            onClick={() => selectProduct(r)}
                                        >
                                            <div>
                                                <div className="font-medium text-sm">{r.name}</div>
                                                <div className="text-xs text-gray-500">{r.category} • {r.brand}</div>
                                            </div>
                                            <div className="text-xs text-gray-600">Stok: {r.stock}</div>
                                        </button>
                                    ))}
                                    {searching && (
                                        <div className="px-3 py-2 text-xs text-gray-500">Aranıyor…</div>
                                    )}
                                </div>
                            )}
                        </div>
                        <Button onClick={handleFind} disabled={loading}>
                            <Barcode className="h-4 w-4 mr-2" />
                            Ürünü Bul
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {!product ? (
                <Alert>
                    <AlertDescription>
                        Barkodu girip Enter’a basın veya "Ürünü Bul" düğmesine tıklayın.
                    </AlertDescription>
                </Alert>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>{product.name}</CardTitle>
                        <p className="text-sm text-gray-500">{product.category} - {product.brand}</p>
                        <div className="flex items-center gap-2 mt-2">
                            <Badge variant={product.stock <= (product.min_stock ?? 0) ? 'destructive' : 'default'}>
                                Mevcut Stok: {product.stock}
                            </Badge>
                            <Badge variant="outline">Min: {product.min_stock}</Badge>
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">{product.barcode}</code>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div>
                                <label className="block text-sm font-medium mb-1">Miktar</label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={qty}
                                    onChange={(e) => setQty(e.target.value)}
                                    placeholder="Adet"
                                    required
                                />
                            </div>
                            <div className="md:col-span-2 flex gap-2">
                                <Button type="submit" disabled={submitting} className="flex-1">
                                    <TrendingUp className="h-4 w-4 mr-2" />
                                    Stok Girişi Yap
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default CashierStock;
