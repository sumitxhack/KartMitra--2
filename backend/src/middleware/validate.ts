import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ApiError } from '../utils/apiError';

interface ValidationSchema {
  body?: AnyZodObject;
  query?: AnyZodObject;
  params?: AnyZodObject;
}

/**
 * Reusable input validation middleware using Zod.
 */
export const validate = (schema: ValidationSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.reduce((acc: Record<string, string>, curr) => {
          const field = curr.path.join('.');
          acc[field] = curr.message;
          return acc;
        }, {});
        
        // Throw a 400 Bad Request / Validation error
        return next(new ApiError(400, 'Validation Error', formattedErrors));
      }
      return next(error);
    }
  };
};
