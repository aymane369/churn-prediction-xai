import { keepPreviousData, QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './endpoints'
import { ApiError } from './client'
import type { CustomerQuery, PredictionInput } from '@/types/api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Don't retry requests that cannot succeed on retry (404, 422, model missing)
      retry: (count, error) => !(error instanceof ApiError && (error.isClientError || error.isModelUnavailable)) && count < 2,
    },
  },
})

export const keys = {
  overview: ['overview'] as const,
  model: ['model'] as const,
  recent: ['recent-predictions'] as const,
  customers: (q: CustomerQuery) => ['customers', q] as const,
  customer: (id: number) => ['customer', id] as const,
  explanation: (id: number) => ['explanation', id] as const,
}

export const useOverview = () =>
  useQuery({ queryKey: keys.overview, queryFn: ({ signal }) => api.overview(signal) })

export const useModelInfo = () =>
  useQuery({ queryKey: keys.model, queryFn: ({ signal }) => api.model(signal), staleTime: 300_000 })

export const useRecentPredictions = (limit = 6) =>
  useQuery({ queryKey: [...keys.recent, limit], queryFn: ({ signal }) => api.recentPredictions(limit, signal), staleTime: 10_000 })

export const useCustomers = (query: CustomerQuery) =>
  useQuery({
    queryKey: keys.customers(query),
    queryFn: ({ signal }) => api.customers(query, signal),
    placeholderData: keepPreviousData, // keep the old page on screen while the next one loads
  })

export const useCustomer = (id: number) =>
  useQuery({ queryKey: keys.customer(id), queryFn: ({ signal }) => api.customer(id, signal), enabled: Number.isFinite(id) })

export const useExplanation = (id: number) =>
  useQuery({ queryKey: keys.explanation(id), queryFn: ({ signal }) => api.explanation(id, signal), enabled: Number.isFinite(id), staleTime: 300_000 })

export function usePredict() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: PredictionInput) => api.predict(input),
    // A prediction is logged by the backend, so the "recent activity" list is now stale
    onSuccess: () => client.invalidateQueries({ queryKey: keys.recent }),
  })
}
