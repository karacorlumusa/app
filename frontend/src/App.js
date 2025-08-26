import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  BarChart3, 
  Archive, 
  LogOut,
  Menu,
  X,
  Store
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Toaster } from "./components/ui/toaster";
import { AuthProvider, useAuth } from "./context/AuthContext";

import Login from "./components/Login";
import AdminDashboard from "./components/AdminDashboard";
import ProductManagement from "./components/ProductManagement";
import StockManagement from "./components/StockManagement";
import CashierSales from "./components/CashierSales";
import SalesReports from "./components/SalesReports";

function AppContent() {
  const { user, logout, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const handleLogout = async () => {
    await logout();
    setSidebarOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const adminMenuItems = [
    { 
      path: '/dashboard', 
      name: 'Dashboard', 
      icon: LayoutDashboard,
      component: AdminDashboard 
    },
    { 
      path: '/products', 
      name: 'Ürün Yönetimi', 
      icon: Package,
      component: ProductManagement 
    },
    { 
      path: '/stock', 
      name: 'Stok Yönetimi', 
      icon: Archive,
      component: StockManagement 
    },
    { 
      path: '/sales', 
      name: 'Satış İşlemleri', 
      icon: ShoppingCart,
      component: CashierSales 
    },
    { 
      path: '/reports', 
      name: 'Satış Raporları', 
      icon: BarChart3,
      component: SalesReports 
    }
  ];

  const cashierMenuItems = [
    { 
      path: '/sales', 
      name: 'Satış İşlemleri', 
      icon: ShoppingCart,
      component: CashierSales 
    }
  ];

  const menuItems = user.role === 'admin' ? adminMenuItems : cashierMenuItems;
  const defaultPath = user.role === 'admin' ? '/dashboard' : '/sales';

  const Sidebar = () => (
    <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform lg:translate-x-0 lg:static lg:inset-0`}>
      <div className="flex items-center justify-between h-16 px-6 bg-gray-800">
        <div className="flex items-center gap-2">
          <Store className="h-8 w-8 text-blue-400" />
          <span className="text-white font-bold">Elektrik Dükkanı</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden text-white hover:bg-gray-700"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      
      <nav className="mt-8">
        <div className="px-4 mb-4">
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-white font-medium">{user.full_name}</p>
            <p className="text-gray-400 text-sm capitalize">{user.role === 'admin' ? 'Admin' : 'Kasiyer'}</p>
          </div>
        </div>
        
        <div className="space-y-1 px-2">
          {menuItems.map((item) => (
            <a
              key={item.path}
              href={item.path}
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState(null, '', item.path);
                setSidebarOpen(false);
              }}
              className="flex items-center gap-3 px-3 py-2 text-gray-300 rounded-lg hover:bg-gray-800 hover:text-white transition-colors"
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </a>
          ))}
        </div>
        
        <div className="absolute bottom-4 left-2 right-2">
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start text-gray-300 hover:bg-red-600 hover:text-white"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Çıkış Yap
          </Button>
        </div>
      </nav>
    </div>
  );

  const Header = () => (
    <header className="bg-white border-b border-gray-200 px-4 py-3 lg:px-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        <div className="flex items-center gap-4 ml-auto">
          <div className="text-right">
            <p className="text-sm font-medium">{user.full_name}</p>
            <p className="text-xs text-gray-500 capitalize">{user.role === 'admin' ? 'Yönetici' : 'Kasiyer'}</p>
          </div>
        </div>
      </div>
    </header>
  );

  const getCurrentComponent = () => {
    const currentPath = window.location.pathname;
    const currentItem = menuItems.find(item => item.path === currentPath);
    
    if (currentItem) {
      const Component = currentItem.component;
      return <Component user={user} />;
    }
    
    // Default component based on user role
    if (user.role === 'admin') {
      return <AdminDashboard user={user} />;
    } else {
      return <CashierSales user={user} />;
    }
  };

  return (
    <BrowserRouter>
      <div className="flex h-screen bg-gray-100">
        {/* Sidebar Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        <Sidebar />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <Routes>
              <Route path="/" element={<Navigate to={defaultPath} replace />} />
              {menuItems.map((item) => (
                <Route 
                  key={item.path}
                  path={item.path} 
                  element={<item.component user={user} />} 
                />
              ))}
              <Route path="*" element={<Navigate to={defaultPath} replace />} />
            </Routes>
          </main>
        </div>
        
        <Toaster />
      </div>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;