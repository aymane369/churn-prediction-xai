import { request } from './client'
import type {
  Customer,
  CustomerPage,
  CustomerQuery,
  Health,
  ModelInfo,
  Overview,
  PredictionInput,
  PredictionResult,
  RecentPrediction,
} from '@/types/api'

/** One function per backend endpoint. No endpoint here is invented: see app/api.py. */
export const api = {
  health: (signal?: AbortSignal) => request<Health>('/api/health', { signal }),
  model: (signal?: AbortSignal) => request<ModelInfo>('/api/model', { signal }),
  overview: (signal?: AbortSignal) => request<Overview>('/api/stats/overview', { signal }),
  recentPredictions: (limit = 8, signal?: AbortSignal) =>
    request<RecentPrediction[]>('/api/predictions/recent', { params: { limit }, signal }),
  customers: (query: CustomerQuery, signal?: AbortSignal) =>
    request<CustomerPage>('/api/customers', { params: { ...query }, signal }),
  customer: (id: number, signal?: AbortSignal) => request<Customer>(`/api/customers/${id}`, { signal }),
  explanation: (id: number, signal?: AbortSignal) =>
    request<PredictionResult>(`/api/customers/${id}/explanation`, { signal }),
  predict: (input: PredictionInput, signal?: AbortSignal) =>
    request<PredictionResult>('/api/predict', { method: 'POST', body: input, signal }),
}
