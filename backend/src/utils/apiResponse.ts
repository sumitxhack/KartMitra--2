import { Response } from 'express';

export class ApiResponse {
  /**
   * Send a success response.
   */
  static success<T>(res: Response, message: string = 'Request successful', data: T = {} as T, statusCode: number = 200): Response {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  /**
   * Send an error response.
   */
  static error<T>(res: Response, message: string = 'Something went wrong', error: T = {} as T, statusCode: number = 500): Response {
    return res.status(statusCode).json({
      success: false,
      message,
      error,
    });
  }
}
