import { Request, Response, NextFunction } from 'express';
import { PaymentError } from '@type/error';

export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction): void {
  console.error('Error occurred:', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  if (error instanceof PaymentError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        transaction_id: req.body?.transaction_id,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // Unhandled errors
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
    },
  });
}
