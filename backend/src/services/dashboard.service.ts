export class DashboardService {
  /**
   * Get overall key metrics summary.
   */
  static async getSummary() {
    return {
      totalSales: 15420.50,
      totalOrders: 142,
      totalProducts: 4,
      lowStockProducts: 1,
    };
  }

  /**
   * Get sales/revenue metrics.
   */
  static async getSalesData() {
    return {
      totalRevenue: 15420.50,
      averageOrderValue: 108.59,
      salesOverTime: [
        { date: '2026-08-14', sales: 1200 },
        { date: '2026-08-15', sales: 1800 },
        { date: '2026-08-16', sales: 1500 },
        { date: '2026-08-17', sales: 2200 },
        { date: '2026-08-18', sales: 3100 },
        { date: '2026-08-19', sales: 2600 },
        { date: '2026-08-20', sales: 3020.50 },
      ],
    };
  }

  /**
   * Get inventory category breakdown and alert metrics.
   */
  static async getInventoryData() {
    return {
      totalItemsInStock: 523,
      categories: [
        { category: 'Electronics', count: 165 },
        { category: 'Accessories', count: 350 },
        { category: 'Office & Home', count: 8 },
      ],
      recentLowStockAlerts: [
        { productId: 'prod-4', name: 'LED Desk Lamp', stock: 8, threshold: 15 }
      ]
    };
  }
}
