// Tipos para la base de datos (complementarios a Prisma)

export type UserRole = 'ADMIN' | 'USER' | 'API_CLIENT';

export type PlanoStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface UserWithRelations {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  apiKeys?: ApiKeyRecord[];
  planos?: PlanoRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKeyRecord {
  id: string;
  key: string;
  name: string;
  prefix: string;
  userId: string;
  permissions: string[];
  rateLimit: number;
  lastUsedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanoRecord {
  id: string;
  loteCodigo: string;
  loteNombre: string;
  manzana: string;
  etapa: string;
  numeroLote: string;
  vertices: any; // JSON
  dimensiones: any; // JSON
  colindancias: any; // JSON
  propietario?: any; // JSON
  pdfUrl?: string;
  pdfSize?: number;
  thumbnailUrl?: string;
  status: PlanoStatus;
  jobId?: string;
  errorMessage?: string;
  config: any; // JSON
  userId: string;
  source: string;
  generatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiLogRecord {
  id: string;
  apiKeyId?: string;
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number;
  ipAddress?: string;
  userAgent?: string;
  requestBody?: any; // JSON
  responseBody?: any; // JSON
  errorMessage?: string;
  createdAt: Date;
}

// Filtros para consultas
export interface PlanoFilters {
  loteCodigo?: string;
  status?: PlanoStatus;
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  manzana?: string;
  etapa?: string;
}

export interface ApiKeyFilters {
  userId?: string;
  isActive?: boolean;
  hasExpired?: boolean;
}

export interface ApiLogFilters {
  apiKeyId?: string;
  endpoint?: string;
  statusCode?: number;
  dateFrom?: Date;
  dateTo?: Date;
}

// Tipos para estadísticas
export interface PlanoStats {
  total: number;
  byStatus: Record<PlanoStatus, number>;
  byEtapa: Record<string, number>;
  avgGenerationTime: number;
  successRate: number;
}

export interface ApiUsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  requestsByEndpoint: Record<string, number>;
  requestsByDay: Array<{ date: string; count: number }>;
}
