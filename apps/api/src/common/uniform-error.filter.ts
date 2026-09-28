import { Catch, type ExceptionFilter, type ArgumentsHost, HttpException } from "@nestjs/common";
import type { Response, Request } from "express";

type UniformError = { code: string; message: string; details?: unknown };

@Catch()
export class UniformErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();

    const body: UniformError =
      exception instanceof HttpException
        ? this.fromHttpException(exception)
        : { code: "UNEXPECTED_ERROR", message: "Internal server error", details: undefined };

    if (!(exception instanceof HttpException)) {
      console.error("[api] unhandled", exception);
    }

    response
      .status(body.code === "UNEXPECTED_ERROR" ? 500 : (exception as HttpException).getStatus())
      .json(body);
  }

  private fromHttpException(exception: HttpException): UniformError {
    const status = exception.getStatus();
    const payload = exception.getResponse();
    if (typeof payload === "string") {
      return { code: `HTTP_${status}`, message: payload };
    }
    const record = payload as Record<string, unknown>;
    if (typeof record.message === "object" && record.message !== null) {
      return { code: "VALIDATION_ERROR", message: "Invalid request", details: record.message };
    }
    return {
      code: typeof record.code === "string" ? record.code : `HTTP_${status}`,
      message: typeof record.message === "string" ? record.message : exception.message,
      details: record.details,
    };
  }
}
