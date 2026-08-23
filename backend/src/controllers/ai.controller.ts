import { Request, Response, NextFunction } from 'express';
import { aiService } from '../services/ai.service';
import { ApiResponse } from '../utils/apiResponse';

export class AiController {
  /**
   * Run AI product pricing and stock insights.
   */
  static async productAnalysis(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const result = await aiService.analyzeProduct(req.body);
      return ApiResponse.success(res, 'AI product analysis complete (Mock)', result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Run AI product recommendations.
   */
  static async productRecommendation(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { productId } = req.body;
      const recommendations = await aiService.getRecommendations(productId);
      
      return ApiResponse.success(res, 'AI recommendations generated (Mock)', {
        productId,
        recommendations,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Run AI demand forecasting model.
   */
  static async demandPrediction(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const result = await aiService.predictDemand(req.body);
      return ApiResponse.success(res, 'AI demand forecasting complete (Mock)', result);
    } catch (error) {
      return next(error);
    }
  }
}
