// Mock data for electrical store inventory system

export const mockProducts = [
  {
    id: '1',
    barcode: '8690123456789',
    name: 'LED Ampul 9W E27 Beyaz Işık',
    category: 'Aydınlatma',
    brand: 'Philips',
    stock: 45,
    minStock: 10,
    buyPrice: 12.50,
    sellPrice: 18.90,
    taxRate: 18,
    supplier: 'Elektrik Toptan AŞ',
    lastUpdated: new Date('2025-01-20T10:30:00Z').toISOString()
  },
  {
    id: '2',
    barcode: '8690987654321',
    name: 'Kablo 2.5mm NYA Siyah (100m)',
    category: 'Kablolar',
    brand: 'Nexans',
    stock: 8,
    minStock: 5,
    buyPrice: 185.00,
    sellPrice: 285.00,
    taxRate: 18,
    supplier: 'Kablo Dünyası',
    lastUpdated: new Date('2025-01-19T14:15:00Z').toISOString()
  },
  {
    id: '3',
    barcode: '8691234567890',
    name: 'Anahtar Tekli Beyaz',
    category: 'Elektrik Aksesuarları',
    brand: 'Viko',
    stock: 120,
    minStock: 20,
    buyPrice: 8.75,
    sellPrice: 14.50,
    taxRate: 18,
    supplier: 'Viko Bayi',
    lastUpdated: new Date('2025-01-18T09:45:00Z').toISOString()
  },
  {
    id: '4',
    barcode: '8692345678901',
    name: 'Priz Topraklı Beyaz',
    category: 'Elektrik Aksesuarları',
    brand: 'Schneider',
    stock: 65,
    minStock: 15,
    buyPrice: 15.25,
    sellPrice: 24.90,
    taxRate: 18,
    supplier: 'Schneider Bayi',
    lastUpdated: new Date('2025-01-17T16:20:00Z').toISOString()
  },
  {
    id: '5',
    barcode: '8693456789012',
    name: 'Sigorta 16A C Tipi',
    category: 'Sigortalar',
    brand: 'ABB',
    stock: 25,
    minStock: 10,
    buyPrice: 32.00,
    sellPrice: 48.50,
    taxRate: 18,
    supplier: 'ABB Distribütörü',
    lastUpdated: new Date('2025-01-16T11:10:00Z').toISOString()
  }
];

export const mockSales = [
  {
    id: 'S001',
    date: new Date('2025-01-20T15:30:00Z').toISOString(),
    cashier: 'Ahmet Yılmaz',
    items: [
      {
        productId: '1',
        barcode: '8690123456789',
        name: 'LED Ampul 9W E27 Beyaz Işık',
        quantity: 3,
        unitPrice: 18.90,
        totalPrice: 56.70,
        taxRate: 18
      },
      {
        productId: '3',
        barcode: '8691234567890',
        name: 'Anahtar Tekli Beyaz',
        quantity: 5,
        unitPrice: 14.50,
        totalPrice: 72.50,
        taxRate: 18
      }
    ],
    subtotal: 129.20,
    taxAmount: 23.26,
    total: 152.46
  },
  {
    id: 'S002',
    date: new Date('2025-01-20T11:15:00Z').toISOString(),
    cashier: 'Mehmet Demir',
    items: [
      {
        productId: '4',
        barcode: '8692345678901',
        name: 'Priz Topraklı Beyaz',
        quantity: 2,
        unitPrice: 24.90,
        totalPrice: 49.80,
        taxRate: 18
      }
    ],
    subtotal: 49.80,
    taxAmount: 8.96,
    total: 58.76
  }
];

export const mockUsers = [
  {
    id: '1',
    username: 'admin',
    password: 'admin123', // In real app, this would be hashed
    role: 'admin',
    fullName: 'İbrahim Usta',
    email: 'ibrahim@elektrikdukkani.com',
    active: true,
    createdAt: new Date('2025-01-10T10:00:00Z').toISOString()
  },
  {
    id: '2',
    username: 'kasiyer1',
    password: 'kasiyer123', // In real app, this would be hashed
    role: 'cashier',
    fullName: 'Ahmet Yılmaz',
    email: 'ahmet@elektrikdukkani.com',
    active: true,
    createdAt: new Date('2025-01-12T14:30:00Z').toISOString()
  },
  {
    id: '3',
    username: 'kasiyer2',
    password: 'kasiyer456', // In real app, this would be hashed
    role: 'cashier',
    fullName: 'Mehmet Demir',
    email: 'mehmet@elektrikdukkani.com',
    active: true,
    createdAt: new Date('2025-01-14T09:15:00Z').toISOString()
  }
];

export const mockCategories = [
  'Aydınlatma',
  'Kablolar',
  'Elektrik Aksesuarları',
  'Sigortalar',
  'Anahtarlar',
  'Prizler',
  'Elektrik Panosu',
  'Koruma Cihazları',
  'Sensörler',
  'Projektörler'
];

export const mockSuppliers = [
  'Elektrik Toptan AŞ',
  'Kablo Dünyası',
  'Viko Bayi',
  'Schneider Bayi',
  'ABB Distribütörü',
  'Legrand Türkiye',
  'General Electric',
  'Siemens Elektrik'
];

// Simulated barcode scanning
export const simulateBarcodeScan = (barcode) => {
  const product = mockProducts.find(p => p.barcode === barcode);
  return product || null;
};

// Calculate price with tax
export const calculatePriceWithTax = (price, taxRate) => {
  return price + (price * taxRate / 100);
};

// Calculate profit margin
export const calculateProfitMargin = (buyPrice, sellPrice) => {
  return ((sellPrice - buyPrice) / buyPrice * 100).toFixed(2);
};