import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';

function mockRes(): jest.Mocked<Response> {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('authenticate middleware', () => {
  it('returns 401 when token is missing', async () => {
    const req: any = { headers: {} } satisfies Partial<Request>;
    const res = mockRes();
    const next: NextFunction = jest.fn();

    await authenticate(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when token is valid', async () => {
    process.env.JWT_SECRET = 'test-secret';

    const token = jwt.sign({ id: 'u1', email: 'u1@example.com', role: 'user' }, process.env.JWT_SECRET);
    const req: any = { headers: { authorization: `Bearer ${token}` } } satisfies Partial<Request>;
    const res = mockRes();
    const next: NextFunction = jest.fn();

    await authenticate(req as any, res as any, next);

    expect(req.user).toEqual({ id: 'u1', email: 'u1@example.com', role: 'user' });
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 when token is invalid', async () => {
    const req: any = { headers: { authorization: 'Bearer not-a-real-token' } } satisfies Partial<Request>;
    const res = mockRes();
    const next: NextFunction = jest.fn();

    await authenticate(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

