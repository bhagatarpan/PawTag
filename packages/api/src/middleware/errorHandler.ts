import { Request, Response, NextFunction } from 'express';
import logger from '../lib/logger';
import { isAppError, toAppError } from '../lib/app-errors';
import { getRequestContext } from '../lib/request-context';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const appError = toAppError(err);
  const ctx = getRequestContext();

  // Log with request context
  logger.error({
    err,
    requestId: ctx?.requestId,
    correlationId: ctx?.correlationId,
    method: req.method,
    url: req.originalUrl,
    httpStatus: appError.httpStatus,
    errorCode: appError.code,
    isOperational: appError.isOperational,
  }, appError.message);

  // Send response
  // Show error message only for operational errors (user-facing errors)
  // In production, hide internal/system error details
  const isOriginalAppError = isAppError(err);
  const showDetails = appError.isOperational && isOriginalAppError;

  const response: Record<string, unknown> = {
    success: false,
    error: showDetails
      ? appError.message
      : process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : appError.message,
  };

  // Include error code for AppErrors
  if (isAppError(err)) {
    response.code = err.code;
  }

  // Include details for validation errors
  if (appError.name === 'ValidationError' && 'details' in appError) {
    response.details = (appError as any).details;
  }

  // Include request IDs for debugging
  if (ctx) {
    response.requestId = ctx.requestId;
    if (process.env.NODE_ENV !== 'production') {
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
