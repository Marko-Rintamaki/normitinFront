// Common types for the Normitin application

export interface ApiResponse<T = unknown> {
  success: boolean;
  action?: string;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface AppInfo {
  name: string
  version: string
  environment: string
  uptime: number
  timestamp: string
}

export interface ErrorResponse {
  success: false;
  error: string;
  status: number;
  timestamp: string;
}

// Product types matching backend
export interface ProductSearchResult {
  product_line: string;
  product_code: string;
  supplier_code: string;
  supplier_name: string;
  general_name: string;
  technical_name: string;
  manufacturer: string;
  ean_code: string;
  unit: string;
  unit_weight: number;
  usage_unit: string;
  conversion_factor: number;
  quick_code: string;
  effective_date: string;
  active: boolean;
  created: string;
  updated: string;
  replacement_status?: string;
  replaced_by_product_line?: string;
  replaced_by_product_code?: string;
  replaced_at?: string;
}

export interface ProductSearchResponse {
  products: ProductSearchResult[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

export interface ProductSearchParams {
  query: string;
  limit?: number;
  offset?: number;
  activeOnly?: boolean;
  supplier?: string;
  productLine?: string;
  suppliers?: string[];
  productLines?: string[];
  hasReferences?: boolean;
  replacementStatus?: string;
  updatedAfter?: string;
}