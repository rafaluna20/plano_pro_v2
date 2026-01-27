// Tipos para la API

export interface ApiKeyInfo {
  id: string;
  key: string;
  prefix: string;
  name: string;
  permissions: string[];
  rateLimit: number;
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: {
    page?: number;
    pageSize?: number;
    total?: number;
    [key: string]: any;
  };
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ListPlanosParams extends PaginationParams {
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  loteCodigo?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  services: {
    database: 'ok' | 'error';
    redis: 'ok' | 'error';
    storage: 'ok' | 'error';
  };
  version: string;
  uptime: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

export interface WebhookPayload {
  event: 'plano.completed' | 'plano.failed' | 'plano.processing';
  timestamp: string;
  data: {
    planoId: string;
    loteCodigo: string;
    status: string;
    pdfUrl?: string;
    errorMessage?: string;
  };
}
