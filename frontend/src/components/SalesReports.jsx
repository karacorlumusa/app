import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart3,
  Calendar,
  TrendingUp,
  Package,
  FileText,
  Download,
  Eye
} from 'lucide-react';
import TurkishLira from './icons/TurkishLira';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { salesAPI, dashboardAPI, usersAPI } from '../services/api';
import { useToast } from '../hooks/use-toast';

const SalesReports = () => {
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [cashierPerf, setCashierPerf] = useState([]);
  const [usersMap, setUsersMap] = useState({}); // id -> display name
  const { toast } = useToast();

  const toISOStart = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toISOString();
  };
  const toISOEnd = (dateStr) => {
    const d = new Date(dateStr + 'T23:59:59');
    return d.toISOString();
  };

  const fetchSales = async () => {
    setLoading(true);
    try {
      const params = {
        start_date: toISOStart(dateRange.start),
        end_date: toISOEnd(dateRange.end)
      };
      const data = await salesAPI.getSales(params);
      setSales(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('fetchSales error', err);
      toast({ title: 'Rapor hatası', description: 'Satışlar alınamadı', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadIrsaliye = async () => {
    try {
      const startISO = toISOStart(dateRange.start);
      const endISO = toISOEnd(dateRange.end);
      const blob = await salesAPI.downloadIrsaliyePDF({ start_date: startISO, end_date: endISO });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `irsaliye_${dateRange.start}_${dateRange.end}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('İrsaliye PDF indirilemedi', err);
      toast({ title: 'PDF indirilemedi', description: 'İrsaliye oluşturma sırasında hata oluştu', variant: 'destructive' });
    }
  };

  const fetchCashierPerformance = async () => {
    try {
      const perf = await dashboardAPI.getCashierPerformance();
      setCashierPerf(Array.isArray(perf) ? perf : []);
    } catch {
      // optional; ignore silently
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await usersAPI.getUsers();
      const list = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
      const map = {};
      list.forEach(u => {
        const name = (u.full_name && u.full_name.trim()) ? u.full_name : u.username || u.id;
        if (u.id) map[u.id] = name;
      });
      setUsersMap(map);
    } catch {
      // ignore; fall back to showing IDs
    }
  };

  useEffect(() => {
    fetchSales();
    fetchCashierPerformance();
    fetchUsers();
  }, []);

  const filteredSales = sales; // already filtered by API

  // Calculate statistics
  const totalRevenue = useMemo(() => filteredSales.reduce((sum, sale) => sum + (sale.total || 0), 0), [filteredSales]);
  const totalItemsSold = useMemo(
    () => filteredSales.reduce((sum, sale) => sum + (sale.items || []).reduce((s, i) => s + (i.quantity || 0), 0), 0),
    [filteredSales]
  );
  const averageSaleValue = filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0;

  // Top selling products (derived)
  const topProducts = useMemo(() => {
    const map = new Map();
    filteredSales.forEach(sale => {
      (sale.items || []).forEach(item => {
        const key = item.product_id;
        const prev = map.get(key) || { name: item.product_name, quantity: 0, revenue: 0 };
        prev.quantity += item.quantity || 0;
        prev.revenue += item.total_price || (item.unit_price || 0) * (item.quantity || 0);
        prev.name = item.product_name || prev.name;
        map.set(key, prev);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  }, [filteredSales]);

  // Cashier performance (API result if available)
  const cashierSales = useMemo(() => {
    if (cashierPerf.length > 0) {
      // Convert to map cashier_name -> {count, revenue}
      const obj = {};
      cashierPerf.forEach(row => {
        obj[row.cashier_name] = { count: row.sales_count, revenue: row.total_revenue };
      });
      return obj;
    }
    // Fallback: derive unknown names using cashier_id
    const obj = {};
    filteredSales.forEach(sale => {
      const key = sale.cashier_id || 'Bilinmiyor';
      if (!obj[key]) obj[key] = { count: 0, revenue: 0 };
      obj[key].count += 1;
      obj[key].revenue += sale.total || 0;
    });
    return obj;
  }, [cashierPerf, filteredSales]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Export helpers
  const handleExportCSV = () => {
    const header = [
      'Urunler', 'Tarih', 'Kasiyer', 'UrunAdedi', 'AraToplam', 'KDV', 'Toplam'
    ];
    const rows = filteredSales.map(sale => {
      const cashierName = usersMap[sale.cashier_id] || sale.cashier_id || '';
      const productNames = (sale.items || [])
        .map(i => i?.product_name || i?.barcode || i?.product_id)
        .filter(Boolean)
        .join(', ');
      return [
        productNames,
        new Date(sale.created_at).toISOString(),
        cashierName,
        (sale.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0),
        (sale.subtotal ?? 0).toString().replace('.', ','),
        (sale.tax_amount ?? 0).toString().replace('.', ','),
        (sale.total ?? 0).toString().replace('.', ',')
      ];
    });
    const csv = [header, ...rows].map(r => r.map(v => `\"${String(v).replace(/\"/g, '\"\"')}\"`).join(';')).join('\r\n');
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `satis_raporu_${dateRange.start}_${dateRange.end}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const SaleDetailModal = ({ sale, onClose }) => {
    const cashierName = usersMap[sale.cashier_id] || sale.cashier_id || '';
    const handleDownloadPDF = () => {
      const COMPANY_NAME = process.env.REACT_APP_COMPANY_NAME || 'Malatya Avize Dünyası';
      const COMPANY_ADDRESS = process.env.REACT_APP_COMPANY_ADDRESS || 'Malatya, Türkiye';
      const title = `Satış Fişi - ${COMPANY_NAME} - ${sale.id}`;
      const rows = (sale.items || []).map(i => `
        <tr>
          <td>${i.product_name}</td>
          <td style="text-align:right;">${i.quantity}</td>
          <td style="text-align:right;">${formatCurrency(i.unit_price)}</td>
          <td style="text-align:right;">${formatCurrency(i.total_price)}</td>
        </tr>`).join('');
      const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
      const taxMap = {};
      (sale.items || []).forEach(i => {
        const rate = Number(i.tax_rate) || 0;
        const net = (Number(i.unit_price) || 0) * (Number(i.quantity) || 0);
        const tax = round2(net * (rate / 100));
        taxMap[rate] = round2((taxMap[rate] || 0) + tax);
      });
      const taxRates = Object.keys(taxMap).map(r => Number(r)).sort((a, b) => b - a);
      const breakdownRows = taxRates.map(r => `
        <tr><th>KDV (%${r})</th><td>${formatCurrency(taxMap[r])}</td></tr>
      `).join('');
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
          <div><strong>Tarih:</strong> ${formatDate(sale.created_at)}</div>
          <div><strong>Kasiyer:</strong> ${cashierName}</div>
        </div>
    <table>
          <thead>
            <tr>
  <th>Ürün</th><th>Adet</th><th>Birim (KDV Hariç)</th><th>Toplam (KDV Dahil)</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="totals">
          <table>
            <tr><th>Ara Toplam</th><td>${formatCurrency(sale.subtotal)}</td></tr>
            ${breakdownRows}
            ${taxRates.length > 1 ? `<tr><th>KDV Toplam</th><td>${formatCurrency(sale.tax_amount)}</td></tr>` : ''}
            <tr><th>TOPLAM</th><td><strong>${formatCurrency(sale.total)}</strong></td></tr>
          </table>
        </div>
        <div style="clear:both"></div>
        <div class="stamp">Firma Kaşesi / İmza</div>
        <div class="footer-note">Bu fiş ${COMPANY_NAME} tarafından düzenlenmiştir. İade/değişim işlemlerinde fiş ve kaşe ibrazı gereklidir.</div>
        <script>window.onload=()=>{window.print(); setTimeout(()=>window.close(),500)}</script>
        </body></html>`;
      const w = window.open('', '_blank');
      if (w) {
        w.document.open();
        w.document.write(html);
        w.document.close();
      }
    };

    return createPortal(
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <CardHeader>
            <CardTitle>Satış Detayı - {sale.id}</CardTitle>
            <div className="text-sm text-gray-600">
              <p>Tarih: {formatDate(sale.created_at)}</p>
              <p>Kasiyer: {usersMap[sale.cashier_id] || sale.cashier_id || '—'}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-medium mb-3">Satılan Ürünler</h3>
              <div className="space-y-2">
                {(sale.items || []).map((item, index) => (
                  <div key={`${item.product_id || index}-${index}`} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      {/* Barkod gizlendi: İrsaliye/fişte barkod gösterilmeyecek */}
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{item.quantity} x {formatCurrency(item.unit_price)}</p>
                      <p className="text-lg font-bold">{formatCurrency(item.total_price)}</p>
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
                  <span>{formatCurrency(sale.tax_amount)}</span>
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
              <Button onClick={handleDownloadPDF}>
                <Download className="h-4 w-4 mr-2" />
                PDF İndir
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>,
      document.body
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">Satış Raporları</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadIrsaliye} disabled={loading}>
            <Download className="h-4 w-4 mr-2" />
            İrsaliye (PDF)
          </Button>
          <Button onClick={handleExportCSV} disabled={loading || filteredSales.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            CSV İndir
          </Button>
        </div>
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
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Bitiş Tarihi</label>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              />
            </div>
            <Button onClick={fetchSales} disabled={loading}>
              {loading ? 'Yükleniyor...' : 'Filtrele'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <TurkishLira className="h-4 w-4 text-green-600" />
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
          {loading ? (
            <p className="text-center text-gray-500 py-8">Yükleniyor…</p>
          ) : filteredSales.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Seçilen tarih aralığında satış bulunamadı</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Ürün(ler)</th>
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
                      <td className="py-3">
                        {(() => {
                          const names = (sale.items || []).map(i => i?.product_name || i?.barcode || i?.product_id).filter(Boolean);
                          if (names.length === 0) return '—';
                          if (names.length === 1) return names[0];
                          return `${names[0]} +${names.length - 1}`;
                        })()}
                      </td>
                      <td className="py-3">{formatDate(sale.created_at)}</td>
                      <td className="py-3">{usersMap[sale.cashier_id] || sale.cashier_id || '—'}</td>
                      <td className="py-3">
                        {(sale.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0)} adet
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