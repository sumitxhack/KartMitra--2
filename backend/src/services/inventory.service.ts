export interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  stock: number;
  lowStockThreshold: number;
  updatedAt: string;
}

// In-memory inventory list mapped to products
const mockInventory: InventoryItem[] = [
  {
    id: 'inv-1',
    productId: 'prod-1',
    productName: 'Wireless Mouse',
    sku: 'WM-001',
    stock: 120,
    lowStockThreshold: 20,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'inv-2',
    productId: 'prod-2',
    productName: 'Mechanical Keyboard',
    sku: 'MK-87',
    stock: 45,
    lowStockThreshold: 10,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'inv-3',
    productId: 'prod-3',
    productName: 'USB-C Cable 1m',
    sku: 'UC-001',
    stock: 350,
    lowStockThreshold: 50,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'inv-4',
    productId: 'prod-4',
    productName: 'LED Desk Lamp',
    sku: 'LL-500',
    stock: 8,
    lowStockThreshold: 15,
    updatedAt: new Date().toISOString(),
  }
];

export class InventoryService {
  static async getAll(): Promise<InventoryItem[]> {
    return mockInventory;
  }

  static async getByProductId(productId: string): Promise<InventoryItem | null> {
    return mockInventory.find((i) => i.productId === productId) || null;
  }

  static async getLowStock(): Promise<InventoryItem[]> {
    return mockInventory.filter((i) => i.stock < i.lowStockThreshold);
  }

  static async adjustStock(productId: string, adjustment: number): Promise<InventoryItem | null> {
    const item = mockInventory.find((i) => i.productId === productId);
    if (!item) return null;
    
    return {
      ...item,
      stock: Math.max(0, item.stock + adjustment),
      updatedAt: new Date().toISOString(),
    };
  }
}
