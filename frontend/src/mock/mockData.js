// Mock data for barcode scanner
export const mockBarcodes = [
  {
    id: '1',
    barcode: '1234567890123',
    type: 'EAN-13',
    product: 'Coca Cola 330ml',
    scannedAt: new Date('2025-01-15T10:30:00Z').toISOString(),
    location: 'Store Section A'
  },
  {
    id: '2',
    barcode: '9876543210987',
    type: 'UPC-A',
    product: 'Samsung Galaxy Phone',
    scannedAt: new Date('2025-01-15T09:15:00Z').toISOString(),
    location: 'Electronics'
  },
  {
    id: '3',
    barcode: 'ABC123XYZ789',
    type: 'Code 128',
    product: 'Office Supplies Box',
    scannedAt: new Date('2025-01-14T16:45:00Z').toISOString(),
    location: 'Warehouse B'
  },
  {
    id: '4',
    barcode: 'QR_CODE_123456',
    type: 'QR Code',
    product: 'Digital Product License',
    scannedAt: new Date('2025-01-14T14:20:00Z').toISOString(),
    location: 'Digital Assets'
  }
];

export const mockScanResult = {
  barcode: '1111222233334',
  type: 'EAN-13',
  product: 'Apple iPhone 15',
  confidence: 0.98
};

// Simulated scanning function
export const simulateScan = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const randomBarcode = Math.floor(Math.random() * 1000000000000).toString();
      const types = ['EAN-13', 'UPC-A', 'Code 128', 'QR Code'];
      const products = ['Sample Product A', 'Sample Product B', 'Sample Product C', 'Sample Product D'];
      
      resolve({
        barcode: randomBarcode,
        type: types[Math.floor(Math.random() * types.length)],
        product: products[Math.floor(Math.random() * products.length)],
        confidence: Math.random() * 0.3 + 0.7 // Random confidence between 0.7-1.0
      });
    }, 2000); // Simulate 2 second scan time
  });
};