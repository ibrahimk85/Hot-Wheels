import { NextRequest, NextResponse } from 'next/server';
import { AppError, ValidationError, NotFoundError, UnauthorizedError, ForbiddenError } from './errors';

type ApiHandler = (
  request: NextRequest,
  context?: any
) => Promise<Response> | Response;

/**
 * Wrapper for API routes with automatic error handling
 */
export function apiHandler(handler: ApiHandler) {
  return async (request: NextRequest, context?: any): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error('API Error:', error);

      if (error instanceof AppError) {
        return NextResponse.json(
          {
            error: error.message,
            code: error.code,
            ...(error instanceof ValidationError && error.fields
              ? { fields: error.fields }
              : {}),
          },
          { status: error.statusCode }
        );
      }

      if (error instanceof ValidationError) {
        return NextResponse.json(
          {
            error: error.message,
            code: 'VALIDATION_ERROR',
            ...(error.fields ? { fields: error.fields } : {}),
          },
          { status: 400 }
        );
      }

      if (error instanceof NotFoundError) {
        return NextResponse.json(
          { error: error.message, code: 'NOT_FOUND' },
          { status: 404 }
        );
      }

      if (error instanceof UnauthorizedError) {
        return NextResponse.json(
          { error: error.message, code: 'UNAUTHORIZED' },
          { status: 401 }
        );
      }

      if (error instanceof ForbiddenError) {
        return NextResponse.json(
          { error: error.message, code: 'FORBIDDEN' },
          { status: 403 }
        );
      }

      // Unknown error
      return NextResponse.json(
        {
          error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : error instanceof Error
            ? error.message
            : 'Unknown error occurred',
        },
        { status: 500 }
      );
    }
  };
}


