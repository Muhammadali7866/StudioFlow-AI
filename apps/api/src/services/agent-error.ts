import { TaskError } from '@studioflow/shared';

interface ErrorShape {
  code?: unknown;
  message?: unknown;
  name?: unknown;
  retryable?: unknown;
  status?: unknown;
  statusCode?: unknown;
  response?: {
    status?: unknown;
  };
  cause?: ErrorShape;
}

const RETRYABLE_CODES = new Set([
  'ABORT_ERR',
  'DEADLINE_EXCEEDED',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENETUNREACH',
  'ETIMEDOUT',
  'RESOURCE_EXHAUSTED',
  'UNAVAILABLE',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
]);

const INVALID_INPUT_CODES = new Set([
  'BAD_REQUEST',
  'FILE_MISSING',
  'INVALID_ARGUMENT',
  'INVALID_FILE_TYPE',
  'INVALID_INPUT',
  'VALIDATION_ERROR',
]);

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

function asErrorShape(error: unknown): ErrorShape {
  return typeof error === 'object' && error !== null ? (error as ErrorShape) : {};
}

function readStatusCode(error: ErrorShape): number | undefined {
  const candidates = [
    error.statusCode,
    error.status,
    error.response?.status,
    error.code,
    error.cause?.statusCode,
    error.cause?.status,
    error.cause?.response?.status,
    error.cause?.code,
  ];
  return candidates.find(
    (candidate): candidate is number => typeof candidate === 'number' && Number.isInteger(candidate)
  );
}

function readProviderCode(error: ErrorShape): string | undefined {
  if (typeof error.code === 'string' && error.code.trim()) {
    return error.code.trim().toUpperCase();
  }
  return typeof error.cause?.code === 'string' && error.cause.code.trim()
    ? error.cause.code.trim().toUpperCase()
    : undefined;
}

function readMessage(error: unknown, shape: ErrorShape): string {
  if (typeof shape.message === 'string' && shape.message.trim()) return shape.message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  return 'Agent execution failed.';
}

export function classifyAgentError(error: unknown): TaskError {
  const shape = asErrorShape(error);
  const providerCode = readProviderCode(shape);
  const statusCode = readStatusCode(shape);
  const errorName = typeof shape.name === 'string' ? shape.name.toUpperCase() : '';
  const message = readMessage(error, shape);
  const normalizedMessage = message.toLowerCase();
  const explicitlyRetryable = typeof shape.retryable === 'boolean' ? shape.retryable : undefined;

  let code = providerCode || 'AGENT_EXECUTION_FAILED';
  let retryable = explicitlyRetryable ?? false;

  if (
    statusCode === 400 ||
    statusCode === 413 ||
    statusCode === 422 ||
    (providerCode !== undefined && INVALID_INPUT_CODES.has(providerCode))
  ) {
    code = 'AGENT_INVALID_INPUT';
    retryable = false;
  } else if (statusCode === 401 || statusCode === 403) {
    code = 'AGENT_AUTHENTICATION_FAILED';
    retryable = false;
  } else if (statusCode === 404) {
    code = 'AGENT_RESOURCE_NOT_FOUND';
    retryable = false;
  } else if (
    statusCode === 429 ||
    providerCode === 'RESOURCE_EXHAUSTED' ||
    /rate limit|too many requests|quota exceeded/.test(normalizedMessage)
  ) {
    code = 'AGENT_RATE_LIMITED';
    retryable = explicitlyRetryable ?? true;
  } else if (
    statusCode === 408 ||
    errorName === 'TIMEOUTERROR' ||
    /timed? out|timeout/.test(normalizedMessage) ||
    (providerCode !== undefined &&
      ['DEADLINE_EXCEEDED', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT'].includes(providerCode))
  ) {
    code = 'AGENT_TIMEOUT';
    retryable = explicitlyRetryable ?? true;
  } else if (
    (statusCode !== undefined && [500, 502, 503, 504].includes(statusCode)) ||
    providerCode === 'UNAVAILABLE'
  ) {
    code = 'AGENT_SERVICE_UNAVAILABLE';
    retryable = explicitlyRetryable ?? true;
  } else if (providerCode !== undefined && RETRYABLE_CODES.has(providerCode)) {
    retryable = explicitlyRetryable ?? true;
  } else if (statusCode !== undefined && RETRYABLE_STATUS_CODES.has(statusCode)) {
    retryable = explicitlyRetryable ?? true;
  }

  return {
    code,
    message,
    retryable,
    ...(statusCode !== undefined ? { statusCode } : {}),
  };
}

export function isRetryableError(error: unknown): boolean {
  return classifyAgentError(error).retryable;
}
