import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { useToast } from '../hooks/use-toast';
import { financeAPIBackend as financeAPIBackend, financeAPI as financeAPILocal, financeLocalStore } from '../services/api';
import { Plus, Filter, Calendar, Search, Trash2, Edit, Wallet, ArrowDownCircle, ArrowUpCircle, Download, Printer } from 'lucide-react';

const currency = (n) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n || 0);

const Finance = ({ user }) => {
    const { toast } = useToast();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [filters, setFilters] = useState({ type: 'all', start_date: '', end_date: '', search: '' });
    const [usingLocal, setUsingLocal] = useState(false);
    const [migrateOffer, setMigrateOffer] = useState({ show: false, count: 0 });
    const [migrating, setMigrating] = useState(false);

    const buildParams = (f) => {
        const p = {};
        if (f.type && f.type !== 'all') p.type = f.type;
        if (f.start_date) p.start_date = new Date(f.start_date).toISOString();
        if (f.end_date) {
            // include full day end by adding one day minus a second
            const d = new Date(f.end_date);
            d.setHours(23, 59, 59, 999);
            p.end_date = d.toISOString();
        }
        if (f.search && f.search.trim()) p.search = f.search.trim();
        return p;
    };

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const params = buildParams(filters);
            try {
                const list = await financeAPIBackend.getTransactions(params);
                const arr = Array.isArray(list) ? list : [];
                setItems(arr);
                setUsingLocal(false);
                // If backend is empty but local has records, offer migration
                const localCount = (financeLocalStore.list() || []).length;
                setMigrateOffer({ show: arr.length === 0 && localCount > 0, count: localCount });
            } catch (err) {
                // If backend route missing or server unavailable, fallback to local
                const is404 = err?.response?.status === 404;
                if (!is404) throw err;
                const list = await financeAPILocal.getTransactions(filters);
                setItems(Array.isArray(list) ? list : []);
                setUsingLocal(true);
                setMigrateOffer({ show: false, count: 0 });
            }
        } catch (e) {
            console.error(e);
            toast({ title: 'Hata', description: 'Kayıtlar alınamadı', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [filters, toast]);

    useEffect(() => { load(); }, [load]);

    const summary = useMemo(() => {
        const income = items.filter(i => i.type === 'income').reduce((s, i) => s + (Number(i.amount) || 0), 0);
        const expense = items.filter(i => i.type === 'expense').reduce((s, i) => s + (Number(i.amount) || 0), 0);
        return { income, expense, net: income - expense };
    }, [items]);

    const Form = ({ initial, onClose }) => {
        const [data, setData] = useState(initial || {
            type: 'expense', // expense | income
            amount: '',
            date: new Date().toISOString().slice(0, 10),
            category: '',
            description: '',
            person: '',
        });
        const [saving, setSaving] = useState(false);

        const save = async (e) => {
            e.preventDefault();
            if (!data.amount || Number(data.amount) <= 0) {
                toast({ title: 'Tutar gerekli', variant: 'destructive' });
                return;
            }
            setSaving(true);
            try {
                const payload = {
                    ...data,
                    amount: Number(data.amount),
                    created_by: user?.id,
                    created_by_name: user?.full_name,
                    // normalize date to ISO with 00:00 local for consistency
                    date: data.date ? new Date(data.date).toISOString() : new Date().toISOString(),
                };
                try {
                    if (initial?.id) {
                        await financeAPIBackend.updateTransaction(initial.id, payload);
                    } else {
                        await financeAPIBackend.createTransaction(payload);
                    }
                    setUsingLocal(false);
                } catch (err) {
                    const is404 = err?.response?.status === 404;
                    if (!is404) throw err;
                    // Fallback for older backend
                    if (initial?.id) {
                        await financeAPILocal.updateTransaction(initial.id, payload);
                    } else {
                        await financeAPILocal.createTransaction(payload);
                    }
                    setUsingLocal(true);
                }
                toast({ title: initial?.id ? 'Kayıt güncellendi' : 'Kayıt eklendi' });
                onClose();
                load();
            } catch (err) {
                console.error(err);
                toast({ title: 'Hata', description: 'Kayıt kaydedilemedi', variant: 'destructive' });
            } finally {
                setSaving(false);
            }
        };

        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-xl">
                    <CardHeader>
                        <CardTitle>{initial ? 'Gelir/Gider Düzenle' : 'Yeni Gelir/Gider'}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={save} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Tür</label>
                                    <select value={data.type} onChange={(e) => setData({ ...data, type: e.target.value })} className="w-full border rounded px-3 py-2">
                                        <option value="expense">Gider</option>
                                        <option value="income">Gelir</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Tutar (₺)</label>
                                    <Input type="number" step="0.01" min="0" value={data.amount} onChange={(e) => setData({ ...data, amount: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Tarih</label>
                                    <Input type="date" value={data.date} onChange={(e) => setData({ ...data, date: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Kategori</label>
                                    <Input value={data.category} onChange={(e) => setData({ ...data, category: e.target.value })} placeholder="Örn: Yemek, Fatura, Yakıt" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium mb-1">Açıklama</label>
                                    <Input value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} placeholder="Açıklama" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium mb-1">Kişi</label>
                                    <Input value={data.person} onChange={(e) => setData({ ...data, person: e.target.value })} placeholder="Kim yaptı?" />
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button type="button" variant="outline" onClick={onClose}>İptal</Button>
                                <Button type="submit" disabled={saving}>{saving ? 'Kaydediliyor...' : (initial ? 'Güncelle' : 'Ekle')}</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    };

    const buildPrintableHtml = () => {
        const escape = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const fmtDate = (d) => d ? new Date(d).toLocaleString('tr-TR') : '';
        const nowStr = new Date().toLocaleString('tr-TR');
        const company = 'Malatya Avize Dünyası';
        const typeLabel = filters.type === 'income' ? 'Gelir' : (filters.type === 'expense' ? 'Gider' : 'Tümü');
        const rangeLabel = [filters.start_date, filters.end_date].filter(Boolean).length
            ? `${filters.start_date || '-'} → ${filters.end_date || '-'}`
            : 'Tüm Zamanlar';
        const searchLabel = filters.search ? `; Arama: \"${escape(filters.search)}\"` : '';

        const rowsHtml = items.map(i => `
                    <tr>
                        <td>${fmtDate(i.date)}</td>
                        <td>${i.type === 'income' ? 'Gelir' : 'Gider'}</td>
                        <td style="text-align:right">${currency(i.amount)}</td>
                        <td>${escape(i.category || '')}</td>
                        <td>${escape((i.description || '').replace(/\n|\r/g, ' '))}</td>
                        <td>${escape(i.person || '')}</td>
                        <td>${escape(i.created_by_name || '')}</td>
                    </tr>
                `).join('');

        const style = `
                    <style>
                        @page { size: A4; margin: 15mm; }
                        body { font-family: Arial, sans-serif; color: #111; }
                        .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 12px; }
                        .brand { font-size: 18px; font-weight: 700; }
                        .meta { font-size: 12px; color:#555; }
                        .summary { display:flex; gap:16px; margin: 12px 0 16px; }
                        .summary .card { border:1px solid #ddd; padding:10px 12px; border-radius:8px; }
                        .summary .label { font-size:12px; color:#555; }
                        .summary .value { font-size:16px; font-weight:700; }
                        table { width:100%; border-collapse: collapse; }
                        th, td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 12px; }
                        th { text-align:left; background:#fafafa; border-top:1px solid #eee; }
                        tfoot td { font-weight:700; }
                    </style>
                `;

        const html = `<!DOCTYPE html><html><head><title>Gelir-Gider Döküman</title>${style}</head><body>
                    <div class=\"header\">
                        <div>
                            <div class=\"brand\">${company}</div>
                            <div class=\"meta\">Gelir / Gider Dökümanı</div>
                        </div>
                        <div class=\"meta\" style=\"text-align:right\">
                            <div>Tarih: ${nowStr}</div>
                            <div>Filtre: ${typeLabel}, Aralık: ${rangeLabel}${searchLabel}</div>
                            <div>Toplam Kayıt: ${items.length}</div>
                        </div>
                    </div>
                    <div class=\"summary\">
                        <div class=\"card\"><div class=\"label\">Gelir</div><div class=\"value\">${currency(summary.income)}</div></div>
                        <div class=\"card\"><div class=\"label\">Gider</div><div class=\"value\">${currency(summary.expense)}</div></div>
                        <div class=\"card\"><div class=\"label\">Net</div><div class=\"value\">${currency(summary.net)}</div></div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style=\"width:120px\">Tarih</th>
                                <th style=\"width:70px\">Tür</th>
                                <th style=\"width:100px; text-align:right\">Tutar</th>
                                <th style=\"width:120px\">Kategori</th>
                                <th>Açıklama</th>
                                <th style=\"width:120px\">Kişi</th>
                                <th style=\"width:150px\">Oluşturan</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml || '<tr><td colspan=\\"7\\" style=\\"text-align:center; padding:24px 0; color:#777\\">Kayıt yok</td></tr>'}
                        </tbody>
                    </table>
                </body></html>`;
        return html;
    };

    const ensureHtml2Pdf = () => new Promise((resolve, reject) => {
        if (window.html2pdf) return resolve(window.html2pdf);
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = () => resolve(window.html2pdf);
        script.onerror = () => reject(new Error('html2pdf yüklenemedi'));
        document.body.appendChild(script);
    });

    const exportPDF = async () => {
        try {
            await ensureHtml2Pdf();

            // Build a real fragment (no <html>/<body>) so html2pdf can capture reliably
            const escape = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            const fmtDate = (d) => d ? new Date(d).toLocaleString('tr-TR') : '';
            const nowStr = new Date().toLocaleString('tr-TR');
            const company = 'Malatya Avize Dünyası';
            const typeLabel = filters.type === 'income' ? 'Gelir' : (filters.type === 'expense' ? 'Gider' : 'Tümü');
            const rangeLabel = [filters.start_date, filters.end_date].filter(Boolean).length
                ? `${filters.start_date || '-'} → ${filters.end_date || '-'}`
                : 'Tüm Zamanlar';
            const searchLabel = filters.search ? `; Arama: \"${escape(filters.search)}\"` : '';

            const rowsHtml = items.map(i => `
                            <tr>
                                <td>${fmtDate(i.date)}</td>
                                <td>${i.type === 'income' ? 'Gelir' : 'Gider'}</td>
                                <td style="text-align:right">${currency(i.amount)}</td>
                                <td>${escape(i.category || '')}</td>
                                <td>${escape((i.description || '').replace(/\n|\r/g, ' '))}</td>
                                <td>${escape(i.person || '')}</td>
                                <td>${escape(i.created_by_name || '')}</td>
                            </tr>
                        `).join('');

            const css = `
                            @page { size: A4; margin: 15mm; }
                            body { font-family: Arial, sans-serif; color: #111; }
                            .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 12px; }
                            .brand { font-size: 18px; font-weight: 700; }
                            .meta { font-size: 12px; color:#555; }
                            .summary { display:flex; gap:16px; margin: 12px 0 16px; }
                            .summary .card { border:1px solid #ddd; padding:10px 12px; border-radius:8px; }
                            .summary .label { font-size:12px; color:#555; }
                            .summary .value { font-size:16px; font-weight:700; }
                            table { width:100%; border-collapse: collapse; }
                            th, td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 12px; }
                            th { text-align:left; background:#fafafa; border-top:1px solid #eee; }
                            tfoot td { font-weight:700; }
                        `;

            const wrapper = document.createElement('div');
            wrapper.style.position = 'fixed';
            wrapper.style.left = '-99999px';
            wrapper.style.top = '0';
            wrapper.style.width = '794px';
            const styleEl = document.createElement('style');
            styleEl.textContent = css;
            const contentEl = document.createElement('div');
            contentEl.innerHTML = `
                            <div class="header">
                                <div>
                                    <div class="brand">${company}</div>
                                    <div class="meta">Gelir / Gider Dökümanı</div>
                                </div>
                                <div class="meta" style="text-align:right">
                                    <div>Tarih: ${nowStr}</div>
                                    <div>Filtre: ${typeLabel}, Aralık: ${rangeLabel}${searchLabel}</div>
                                    <div>Toplam Kayıt: ${items.length}</div>
                                </div>
                            </div>
                            <div class="summary">
                                <div class="card"><div class="label">Gelir</div><div class="value">${currency(summary.income)}</div></div>
                                <div class="card"><div class="label">Gider</div><div class="value">${currency(summary.expense)}</div></div>
                                <div class="card"><div class="label">Net</div><div class="value">${currency(summary.net)}</div></div>
                            </div>
                            <table>
                                <thead>
                                    <tr>
                                        <th style="width:120px">Tarih</th>
                                        <th style="width:70px">Tür</th>
                                        <th style="width:100px; text-align:right">Tutar</th>
                                        <th style="width:120px">Kategori</th>
                                        <th>Açıklama</th>
                                        <th style="width:120px">Kişi</th>
                                        <th style="width:150px">Oluşturan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rowsHtml || '<tr><td colspan="7" style="text-align:center; padding:24px 0; color:#777">Kayıt yok</td></tr>'}
                                </tbody>
                            </table>
                        `;
            wrapper.appendChild(styleEl);
            wrapper.appendChild(contentEl);
            document.body.appendChild(wrapper);

            const opt = {
                margin: [15, 15, 15, 15],
                filename: 'gelir-gider.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            await window.html2pdf().set(opt).from(wrapper).save();
            document.body.removeChild(wrapper);
        } catch (err) {
            console.error(err);
            toast({ title: 'Hata', description: 'PDF indirilemedi', variant: 'destructive' });
        }
    };

    const printDocument = () => {
        const escape = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const fmtDate = (d) => d ? new Date(d).toLocaleString('tr-TR') : '';
        const now = new Date();
        const nowStr = now.toLocaleString('tr-TR');
        const company = 'Malatya Avize Dünyası';
        const typeLabel = filters.type === 'income' ? 'Gelir' : (filters.type === 'expense' ? 'Gider' : 'Tümü');
        const rangeLabel = [filters.start_date, filters.end_date].filter(Boolean).length
            ? `${filters.start_date || '-'} → ${filters.end_date || '-'}`
            : 'Tüm Zamanlar';
        const searchLabel = filters.search ? `; Arama: "${escape(filters.search)}"` : '';

        const rowsHtml = items.map(i => `
                    <tr>
                        <td>${fmtDate(i.date)}</td>
                        <td>${i.type === 'income' ? 'Gelir' : 'Gider'}</td>
                        <td style="text-align:right">${currency(i.amount)}</td>
                        <td>${escape(i.category || '')}</td>
                        <td>${escape((i.description || '').replace(/\n|\r/g, ' '))}</td>
                        <td>${escape(i.person || '')}</td>
                        <td>${escape(i.created_by_name || '')}</td>
                    </tr>
                `).join('');

        const style = `
                    <style>
                        @page { size: A4; margin: 15mm; }
                        body { font-family: Arial, sans-serif; color: #111; }
                        .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 12px; }
                        .brand { font-size: 18px; font-weight: 700; }
                        .meta { font-size: 12px; color:#555; }
                        .summary { display:flex; gap:16px; margin: 12px 0 16px; }
                        .summary .card { border:1px solid #ddd; padding:10px 12px; border-radius:8px; }
                        .summary .label { font-size:12px; color:#555; }
                        .summary .value { font-size:16px; font-weight:700; }
                        table { width:100%; border-collapse: collapse; }
                        th, td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 12px; }
                        th { text-align:left; background:#fafafa; border-top:1px solid #eee; }
                        tfoot td { font-weight:700; }
                    </style>
                `;

        const html = `<!DOCTYPE html><html><head><title>Gelir-Gider Döküman</title>${style}</head><body>
                    <div class="header">
                        <div>
                            <div class="brand">${company}</div>
                            <div class="meta">Gelir / Gider Dökümanı</div>
                        </div>
                        <div class="meta" style="text-align:right">
                            <div>Tarih: ${nowStr}</div>
                            <div>Filtre: ${typeLabel}, Aralık: ${rangeLabel}${searchLabel}</div>
                            <div>Toplam Kayıt: ${items.length}</div>
                        </div>
                    </div>
                    <div class="summary">
                        <div class="card"><div class="label">Gelir</div><div class="value">${currency(summary.income)}</div></div>
                        <div class="card"><div class="label">Gider</div><div class="value">${currency(summary.expense)}</div></div>
                        <div class="card"><div class="label">Net</div><div class="value">${currency(summary.net)}</div></div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width:120px">Tarih</th>
                                <th style="width:70px">Tür</th>
                                <th style="width:100px; text-align:right">Tutar</th>
                                <th style="width:120px">Kategori</th>
                                <th>Açıklama</th>
                                <th style="width:120px">Kişi</th>
                                <th style="width:150px">Oluşturan</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml || '<tr><td colspan="7" style="text-align:center; padding:24px 0; color:#777">Kayıt yok</td></tr>'}
                        </tbody>
                    </table>
                </body></html>`;

        const win = window.open('', 'PRINT', 'height=800,width=1024');
        if (!win) return;
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 100);
    };

    const migrateLocalToBackend = async () => {
        try {
            const local = financeLocalStore.list() || [];
            if (!local.length) { setMigrateOffer({ show: false, count: 0 }); return; }
            setMigrating(true);
            // Import sequentially to keep it simple
            for (const t of local) {
                const payload = {
                    type: t.type,
                    amount: Number(t.amount) || 0,
                    date: t.date ? new Date(t.date).toISOString() : new Date().toISOString(),
                    category: t.category || '',
                    description: t.description || '',
                    person: t.person || ''
                };
                await financeAPIBackend.createTransaction(payload);
            }
            financeLocalStore.clear();
            setMigrateOffer({ show: false, count: 0 });
            toast({ title: 'Yerel kayıtlar içe aktarıldı' });
            load();
        } catch (e) {
            console.error(e);
            toast({ title: 'Hata', description: 'İçe aktarma başarısız', variant: 'destructive' });
        } finally {
            setMigrating(false);
        }
    };

    return (
        <div className="space-y-6">
            {migrateOffer.show && (
                <Alert>
                    <AlertDescription>
                        Tarayıcıda {migrateOffer.count} yerel Gelir/Gider kaydı var. Sunucuya aktarmak ister misin?
                        <Button className="ml-3" size="sm" onClick={migrateLocalToBackend} disabled={migrating}>
                            {migrating ? 'Aktarılıyor...' : 'İçe aktar'}
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Gelir / Gider</h1>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={printDocument}><Printer className="h-4 w-4 mr-2" />Yazdır</Button>
                    <Button variant="outline" onClick={exportPDF}><Download className="h-4 w-4 mr-2" />PDF İndir</Button>
                    <Button onClick={() => { setEditing(null); setShowForm(true); }}><Plus className="h-4 w-4 mr-2" />Yeni Kayıt</Button>
                </div>
            </div>

            {/* Backend-only mode: no local fallback banner needed */}

            <Card>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                            <label className="block text-sm font-medium mb-1">Tür</label>
                            <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} className="w-full border rounded px-3 py-2">
                                <option value="all">Tümü</option>
                                <option value="income">Gelir</option>
                                <option value="expense">Gider</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Başlangıç</label>
                            <Input type="date" value={filters.start_date} onChange={(e) => setFilters({ ...filters, start_date: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Bitiş</label>
                            <Input type="date" value={filters.end_date} onChange={(e) => setFilters({ ...filters, end_date: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Ara</label>
                            <Input placeholder="kategori, açıklama, kişi..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader><CardTitle className="text-green-700 flex items-center gap-2"><ArrowDownCircle className="h-5 w-5" /> Gelir</CardTitle></CardHeader>
                    <CardContent className="text-2xl font-bold">{currency(summary.income)}</CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-red-700 flex items-center gap-2"><ArrowUpCircle className="h-5 w-5" /> Gider</CardTitle></CardHeader>
                    <CardContent className="text-2xl font-bold">{currency(summary.expense)}</CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-blue-700 flex items-center gap-2"><Wallet className="h-5 w-5" /> Net</CardTitle></CardHeader>
                    <CardContent className="text-2xl font-bold">{currency(summary.net)}</CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Hareketler ({items.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
                    ) : items.length === 0 ? (
                        <Alert><AlertDescription>Kayıt bulunamadı.</AlertDescription></Alert>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-2">Tarih</th>
                                        <th className="text-left py-2">Tür</th>
                                        <th className="text-left py-2">Tutar</th>
                                        <th className="text-left py-2">Kategori</th>
                                        <th className="text-left py-2">Açıklama</th>
                                        <th className="text-left py-2">Kişi</th>
                                        <th className="text-left py-2">Oluşturan</th>
                                        <th className="text-right py-2">İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((i) => (
                                        <tr key={i.id} className="border-b hover:bg-gray-50">
                                            <td className="py-2">{i.date ? new Date(i.date).toLocaleString('tr-TR') : ''}</td>
                                            <td className="py-2">
                                                <Badge variant={i.type === 'income' ? 'default' : 'destructive'}>
                                                    {i.type === 'income' ? 'Gelir' : 'Gider'}
                                                </Badge>
                                            </td>
                                            <td className="py-2">{currency(i.amount)}</td>
                                            <td className="py-2">{i.category}</td>
                                            <td className="py-2">{i.description}</td>
                                            <td className="py-2">{i.person}</td>
                                            <td className="py-2">{i.created_by_name}</td>
                                            <td className="py-2 text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <Button variant="ghost" size="sm" onClick={() => { setEditing(i); setShowForm(true); }}><Edit className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="sm" onClick={async () => {
                                                        try {
                                                            await financeAPIBackend.deleteTransaction(i.id);
                                                            setUsingLocal(false);
                                                        } catch (err) {
                                                            const is404 = err?.response?.status === 404;
                                                            if (!is404) throw err;
                                                            await financeAPILocal.deleteTransaction(i.id);
                                                            setUsingLocal(true);
                                                        }
                                                        toast({ title: 'Silindi' }); load();
                                                    }}><Trash2 className="h-4 w-4 text-red-500" /></Button>
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

            {showForm && (
                <Form initial={editing} onClose={() => { setShowForm(false); setEditing(null); }} />
            )}
        </div>
    );
};

export default Finance;
