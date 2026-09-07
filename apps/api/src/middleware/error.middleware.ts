import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  public statusCode: number;
  public errorCode: string;

  constructor(message: string, statusCode = 500, errorCode = 'INTERNAL_SERVER_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const errorCode = err instanceof AppError ? err.errorCode : 'INTERNAL_SERVER_ERROR';
  const isProduction = process.env.NODE_ENV === 'production';

  // Always log full error detail server-side for debugging / Grafana ingestion
  console.error(
    `❌ [API Error] ${req.method} ${req.originalUrl} | ${errorCode} (${statusCode}):`,
    err.message
  );

  // In production, hide internal details for 5xx errors to prevent info leakage (M6-01)
  const clientMessage =
    isProduction && statusCode >= 500
      ? 'An unexpected error occurred. Please try again later.'
      : err.message || 'An unexpected internal server error occurred.';

  res.status(statusCode).json({
    error: {
      code: errorCode,
      message: clientMessage,
    },
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `The requested path '${req.originalUrl}' was not found on this server.`,
    },
  });
}
