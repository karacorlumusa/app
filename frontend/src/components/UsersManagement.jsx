import React, { useEffect, useMemo, useState } from 'react';
import { usersAPI } from '../services/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select } from './ui/select';

const emptyForm = {
    id: '',
    username: '',
    full_name: '',
    email: '',
    role: 'cashier',
    active: true,
    password: ''
};

export default function UsersManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [form, setForm] = useState(emptyForm);
    const [mode, setMode] = useState('list'); // list | edit | create

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return users;
        return users.filter(u =>
            u.username.toLowerCase().includes(q) ||
            (u.full_name || '').toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q)
        );
    }, [users, query]);

    const load = async () => {
        try {
            setLoading(true);
            const data = await usersAPI.getUsers();
            setUsers(data);
        } catch (e) {
            setError(e?.response?.data?.detail || 'Kullanıcılar yüklenemedi');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const onEdit = (u) => {
        setForm({ ...emptyForm, ...u, password: '' });
        setMode('edit');
    };

    const onCreate = () => {
        setForm({ ...emptyForm });
        setMode('create');
    };

    const onCancel = () => {
        setMode('list');
        setForm(emptyForm);
        setError('');
    };

    const onSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            if (mode === 'create') {
                const payload = {
                    username: form.username,
                    full_name: form.full_name,
                    email: form.email || null,
                    role: form.role,
                    active: !!form.active,
                    password: form.password
                };
                await usersAPI.createUser(payload);
            } else if (mode === 'edit') {
                const payload = {
                    username: form.username,
                    full_name: form.full_name,
                    email: form.email || null,
                    role: form.role,
                    active: !!form.active,
                    ...(form.password ? { password: form.password } : {})
                };
                await usersAPI.updateUser(form.id, payload);
            }
            await load();
            onCancel();
        } catch (e) {
            setError(e?.response?.data?.detail || 'Kaydetme hatası');
        } finally {
            setSaving(false);
        }
    };

    const onDelete = async (u) => {
        if (!confirm(`${u.username} silinsin mi?`)) return;
        try {
            await usersAPI.deleteUser(u.id);
            await load();
        } catch (e) {
            setError(e?.response?.data?.detail || 'Silme hatası');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (mode !== 'list') {
        const isEdit = mode === 'edit';
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{isEdit ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}</CardTitle>
                </CardHeader>
                <CardContent>
                    {error && (
                        <div className="mb-3 text-sm text-red-600">{error}</div>
                    )}
                    <form onSubmit={onSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label>Kullanıcı Adı</Label>
                            <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
                        </div>
                        <div>
                            <Label>Ad Soyad</Label>
                            <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required />
                        </div>
                        <div>
                            <Label>E-posta</Label>
                            <Input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
                        </div>
                        <div>
                            <Label>Rol</Label>
                            <select className="border rounded h-10 px-2 w-full" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                                <option value="admin">Admin</option>
                                <option value="cashier">Kasiyer</option>
                            </select>
                        </div>
                        <div>
                            <Label>Durum</Label>
                            <select className="border rounded h-10 px-2 w-full" value={form.active ? '1' : '0'} onChange={e => setForm({ ...form, active: e.target.value === '1' })}>
                                <option value="1">Aktif</option>
                                <option value="0">Pasif</option>
                            </select>
                        </div>
                        <div>
                            <Label>{isEdit ? 'Şifre (değiştirmek için girin)' : 'Şifre'}</Label>
                            <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} {...(isEdit ? {} : { required: true })} />
                        </div>
                        <div className="col-span-full flex gap-2 justify-end mt-2">
                            <Button type="button" variant="ghost" onClick={onCancel}>Vazgeç</Button>
                            <Button type="submit" disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Input placeholder="Ara (kullanıcı adı, ad soyad, e-posta)" value={query} onChange={e => setQuery(e.target.value)} />
                <Button onClick={onCreate}>Yeni Kullanıcı</Button>
            </div>

            {error && (
                <div className="text-sm text-red-600">{error}</div>
            )}

            <div className="overflow-x-auto bg-white rounded shadow">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="text-left px-4 py-2">Kullanıcı Adı</th>
                            <th className="text-left px-4 py-2">Ad Soyad</th>
                            <th className="text-left px-4 py-2">E-posta</th>
                            <th className="text-left px-4 py-2">Rol</th>
                            <th className="text-left px-4 py-2">Durum</th>
                            <th className="px-4 py-2 text-right">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(u => (
                            <tr key={u.id} className="border-t">
                                <td className="px-4 py-2">{u.username}</td>
                                <td className="px-4 py-2">{u.full_name}</td>
                                <td className="px-4 py-2">{u.email}</td>
                                <td className="px-4 py-2 capitalize">{u.role}</td>
                                <td className="px-4 py-2">{u.active ? 'Aktif' : 'Pasif'}</td>
                                <td className="px-4 py-2 text-right space-x-2">
                                    <Button size="sm" onClick={() => onEdit(u)}>Düzenle</Button>
                                    <Button size="sm" variant="destructive" onClick={() => onDelete(u)}>Sil</Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
