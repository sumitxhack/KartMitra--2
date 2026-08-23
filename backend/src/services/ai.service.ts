export interface ProductAnalysisInput {
  productId: string;
  name: string;
  category: string;
  stock: number;
  price: number;
}

export interface AiProductAnalysisResult {
  productId: string;
  pricingStrategy: string;
  suggestedRetailPrice: number;
  stockLevelRecommendation: 'low' | 'adequate' | 'overstocked';
  insights: string[];
}

export interface DemandPredictionInput {
  productId: string;
  historicalSales: { date: string; quantity: number }[];
}

export interface AiDemandPredictionResult {
  productId: string;
  forecastPeriod: string;
  predictedDemand: number;
  confidenceScore: number;
  recommendation: string;
}

/**
 * Interface definition for all AI analysis providers.
 * Makes swapping out providers straightforward.
 */
export interface IAiService {
  analyzeProduct(input: ProductAnalysisInput): Promise<AiProductAnalysisResult>;
  getRecommendations(productId: string): Promise<string[]>;
  predictDemand(input: DemandPredictionInput): Promise<AiDemandPredictionResult>;
}

/**
 * Mock implementation of AI services.
 */
export class MockAiService implements IAiService {
  async analyzeProduct(input: ProductAnalysisInput): Promise<AiProductAnalysisResult> {
    const isUnderpriced = input.price < 20;
    const SRP = isUnderpriced ? input.price * 1.25 : input.price * 1.1;
    const stockLevel = input.stock < 15 ? 'low' : (input.stock > 200 ? 'overstocked' : 'adequate');

    return {
      productId: input.productId,
      pricingStrategy: isUnderpriced ? 'Aggressive growth pricing' : 'Value-based stabilization pricing',
      suggestedRetailPrice: parseFloat(SRP.toFixed(2)),
      stockLevelRecommendation: stockLevel,
      insights: [
        `Stock level is currently ${stockLevel}. Recommend checking restock thresholds.`,
        `Suggested adjustment of price to $${SRP.toFixed(2)} to optimize gross margins.`,
        `Category demand for ${input.category} is showing positive upward growth trends.`,
      ],
    };
  }

  async getRecommendations(productId: string): Promise<string[]> {
    return [
      'Bundle with complementary items to increase basket size.',
      'Promote as a popular product on dashboard recommendations.',
      'Review supplier cost structures to identify potential procurement savings.',
    ];
  }

  async predictDemand(input: DemandPredictionInput): Promise<AiDemandPredictionResult> {
    const totalSales = input.historicalSales.reduce((sum, s) => sum + s.quantity, 0);
    const avgSales = input.historicalSales.length > 0 ? totalSales / input.historicalSales.length : 12;

    return {
      productId: input.productId,
      forecastPeriod: 'Next 30 Days',
      predictedDemand: Math.round(avgSales * 1.18 + 3),
      confidenceScore: 0.85,
      recommendation: 'Plan a restock replenishment order of 50 units ahead of the peak mid-month sales cycle.',
    };
  }
}

// Export instance of MockAiService
export const aiService: IAiService = new MockAiService();
