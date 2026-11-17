import type { Risk } from '@/types/api'

/**
 * Presentation of the three risk bands. The band *boundaries* live in the backend
 * (src/models/risk.py) and arrive with each customer / prediction; the UI only styles them.
 */
export const RISK_ORDER: Risk[] = ['low', 'medium', 'high']

export const RISK: Record<
  Risk,
  { label: string; short: string; text: string; soft: string; mark: string; markVar: string; description: string }
> = {
  low: {
    label: 'Low risk',
    short: 'Low',
    text: 'text-risk-low',
    soft: 'bg-risk-low-soft',
    mark: '#4f8271',
    markVar: 'var(--risk-low-mark)',
    description: 'Predicted churn probability below 20%',
  },
  medium: {
    label: 'Medium risk',
    short: 'Medium',
    text: 'text-risk-medium',
    soft: 'bg-risk-medium-soft',
    mark: '#aa7b20',
    markVar: 'var(--risk-medium-mark)',
    description: 'Predicted churn probability from 20% to 50%',
  },
  high: {
    label: 'High risk',
    short: 'High',
    text: 'text-risk-high',
    soft: 'bg-risk-high-soft',
    mark: '#c65f40',
    markVar: 'var(--risk-high-mark)',
    description: 'Predicted churn probability of 50% or more',
  },
}
