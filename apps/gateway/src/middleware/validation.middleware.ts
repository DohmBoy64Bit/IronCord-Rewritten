import { Request, Response, NextFunction } from 'express';

export type ValidationSchema = Record<string, (value: unknown) => boolean>;

export function validateBody(schema: ValidationSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    for (const [field, validator] of Object.entries(schema)) {
      const value = (req.body as Record<string, unknown>)[field];
      
      if (!validator(value)) {
        errors.push(field);
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: `Invalid fields: ${errors.join(', ')}`,
      });
      return;
    }

    next();
  };
}

export const validators = {
  required: (value: unknown): boolean => {
    return value !== undefined && value !== null && value !== '';
  },
  
  string: (value: unknown): boolean => {
    return typeof value === 'string' && value.trim().length > 0;
  },
  
  email: (value: unknown): boolean => {
    if (typeof value !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },
  
  minLength: (min: number) => (value: unknown): boolean => {
    return typeof value === 'string' && value.length >= min;
  },
  
  maxLength: (max: number) => (value: unknown): boolean => {
    return typeof value === 'string' && value.length <= max;
  },
};
