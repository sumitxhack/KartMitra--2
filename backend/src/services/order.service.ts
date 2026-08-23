export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

// In-memory mock database of orders
const mockOrders: Order[] = [
  {
    id: 'ord-1',
    items: [
      { productId: 'prod-1', productName: 'Wireless Mouse', quantity: 2, price: 29.99 },
      { productId: 'prod-3', productName: 'USB-C Cable 1m', quantity: 1, price: 9.99 },
    ],
    totalAmount: 69.97,
    status: 'completed',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'ord-2',
    items: [
      { productId: 'prod-2', productName: 'Mechanical Keyboard', quantity: 1, price: 89.99 },
    ],
    totalAmount: 89.99,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

export class OrderService {
  static async getAll(): Promise<Order[]> {
    return mockOrders;
  }

  static async getById(id: string): Promise<Order | null> {
    return mockOrders.find((o) => o.id === id) || null;
  }

  static async create(data: { items: { productId: string; quantity: number }[] }): Promise<Order> {
    const orderItems: OrderItem[] = data.items.map((i) => {
      const names: Record<string, string> = { 
        'prod-1': 'Wireless Mouse', 
        'prod-2': 'Mechanical Keyboard', 
        'prod-3': 'USB-C Cable 1m', 
        'prod-4': 'LED Desk Lamp' 
      };
      const prices: Record<string, number> = { 
        'prod-1': 29.99, 
        'prod-2': 89.99, 
        'prod-3': 9.99, 
        'prod-4': 34.99 
      };
      
      return {
        productId: i.productId,
        productName: names[i.productId] || 'Unknown Product',
        quantity: i.quantity,
        price: prices[i.productId] || 0.00,
      };
    });

    const totalAmount = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const newOrder: Order = {
      id: 'ord-' + Math.random().toString(36).substring(2, 9),
      items: orderItems,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return newOrder;
  }

  static async updateStatus(id: string, status: Order['status']): Promise<Order | null> {
    const existing = mockOrders.find((o) => o.id === id);
    if (!existing) return null;
    
    return {
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
    };
  }
}
