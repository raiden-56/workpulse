export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: ApiFieldError[];
  traceId?: string;
}

export interface PageMeta {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  meta?: PageMeta;
  error?: ApiError;
  timestamp: string;
}

export interface Paged<T> {
  items: T[];
  meta: PageMeta;
}

export interface MessageResponse {
  message: string;
}

export interface PageQuery {
  page?: number;
  size?: number;
  sort?: string;
}
