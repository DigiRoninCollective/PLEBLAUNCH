import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';
import { AppError } from './errorHandler';

export const validateRequest = (schema: Schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(
      { body: req.body, query: req.query, params: req.params },
      { abortEarly: false }
    );

    if (error) {
      const errorMessage = error.details
        .map((detail) => detail.message)
        .join(', ');
      throw new AppError(errorMessage, 400);
    }

    next();
  };
};
