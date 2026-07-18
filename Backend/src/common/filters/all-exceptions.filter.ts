import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Global HTTP exception filter stub.
 * Triage failures must never leak raw errors to the UI (use fallback instead).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] | object = 'Internal server error';
    if (exception instanceof HttpException) {
      const raw = exception.getResponse();
      if (typeof raw === 'string') {
        message = raw;
      } else if (raw && typeof raw === 'object') {
        const body = raw as Record<string, unknown>;
        message =
          typeof body.message === 'string' || Array.isArray(body.message)
            ? (body.message as string | string[])
            : raw;
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
    });
  }
}
