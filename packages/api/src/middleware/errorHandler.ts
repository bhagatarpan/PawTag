import { Request, Response, NextFunction } from 'express';
import logger from '../lib/logger';
import { isAppError, toAppError, AppError } from '../lib/app-errors';
import { getRequestContext } from '../lib/request-context';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const appError = toAppError(err);
  const ctx = getRequestContext();
  const isProd = process.env.NODE_ENV === 'production';

  // Log with request context and error taxonomy
  logger.error({
    err,
    requestId: ctx?.requestId,
    correlationId: ctx?.correlationId,
    method: req.method,
    url: req.originalUrl,
    httpStatus: appError.httpStatus,
    errorCode: appError.code,
    severity: appError.severity,
    retryable: appError.retryable,
    fingerprint: appError.fingerprint,
    operation: appError.operation,
    isOperational: appError.isOperational,
    userAgent: req.headers?.['user-agent'],
    ip: req.ip,
  }, appError.message);

  // Only show user-facing message for operational errors that were originally AppErrors.
  // Generic errors wrapped by toAppError should not leak details.
  // In development, always show the error message for debugging.
  const isOriginalAppError = isAppError(err);
  const showDetails = isProd
    ? (appError.isOperational && isOriginalAppError)
    : true;

  const response: Record<string, unknown> = {
    success: false,
    error: showDetails
      ? (isOriginalAppError ? appError.userMessage : appError.message)
      : 'Internal server error',
    code: appError.code,
  };

  // Include details for validation errors
  if (showDetails && appError.name === 'ValidationError' && 'details' in appError) {
    response.details = (appError as any).details;
  }

  // Include request IDs for debugging
  if (ctx) {
    response.requestId = ctx.requestId;
    if (!isProd) {
      response.correlationId = ctx.correlationId;
    }
  }

  res.status(appError.httpStatus).json(response);
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
  });
}
