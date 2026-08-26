export interface ApiError {
  status: number;
  message: string;
  details?: unknown;
}

export interface ValidationError extends ApiError {
  status: 400;
  details?: Array<{ path: string; message: string }>;
}

export function createApiError(status: number, message: string, details?: unknown): ApiError {
  return { status, message, details };
}

export function createValidationError(
  message: string,
  details?: Array<{ path: string; message: string }>,
): ValidationError {
  return { status: 400, message, details };
}
