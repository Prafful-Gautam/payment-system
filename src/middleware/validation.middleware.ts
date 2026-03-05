import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export function validateRequest(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: errors,
        },
      });
      return;
    }

    next();
  };
}

// Validation schemas
export const paymentSchemas = {
  initiatePayment: Joi.object({
    user_id: Joi.string().uuid().required(),
    order_id: Joi.string().max(100).required(),
    amount: Joi.number().positive().required(),
    currency: Joi.string().length(3).default('USD'),
    use_wallet: Joi.boolean().default(false),
    preferred_gateway: Joi.string().valid('stripe', 'razorpay').optional(),
    idempotency_key: Joi.string().required(),
    metadata: Joi.object().optional(),
  }),

  processPayment: Joi.object({
    transaction_id: Joi.string().uuid().required(),
    gateway_payment_method: Joi.string().optional(),
    gateway_token: Joi.string().required(),
  }),

  refundPayment: Joi.object({
    amount: Joi.number().positive().optional(),
    reason: Joi.string().max(500).optional(),
  }),
};
