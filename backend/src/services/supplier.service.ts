export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  createdAt: string;
}

// In-memory mock database of suppliers
const mockSuppliers: Supplier[] = [
  {
    id: 'sup-1',
    name: 'Apex Electronics',
    contactName: 'Alice Green',
    email: 'alice@apexelectronics.com',
    phone: '+1-555-0199',
    address: '123 Silicon Valley Road, San Jose, CA',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sup-2',
    name: 'Global Access Cable Corp',
    contactName: 'Bob Vance',
    email: 'bob@globalaccess.com',
    phone: '+1-555-0188',
    address: '456 Connector Avenue, Austin, TX',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sup-3',
    name: 'Home & Office Goods Ltd',
    contactName: 'Charlie Brown',
    email: 'charlie@homegoods.com',
    phone: '+1-555-0177',
    address: '789 Light Street, Chicago, IL',
    createdAt: new Date().toISOString(),
  }
];

export class SupplierService {
  static async getAll(): Promise<Supplier[]> {
    return mockSuppliers;
  }

  static async getById(id: string): Promise<Supplier | null> {
    return mockSuppliers.find((s) => s.id === id) || null;
  }

  static async create(data: Partial<Supplier>): Promise<Supplier> {
    const newSupplier: Supplier = {
      id: 'sup-' + Math.random().toString(36).substring(2, 9),
      name: data.name || 'New Supplier',
      contactName: data.contactName || '',
      email: data.email || '',
      phone: data.phone || '',
      address: data.address || '',
      createdAt: new Date().toISOString(),
    };
    return newSupplier;
  }

  static async update(id: string, data: Partial<Supplier>): Promise<Supplier | null> {
    const existing = mockSuppliers.find((s) => s.id === id);
    if (!existing) return null;
    
    return {
      ...existing,
      ...data,
      id,
    };
  }

  static async delete(id: string): Promise<boolean> {
    return mockSuppliers.some((s) => s.id === id);
  }
}
