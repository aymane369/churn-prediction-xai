/** Domain types. These mirror the FastAPI response models (app/schemas.py). */

export type Risk = 'low' | 'medium' | 'high'
export type ThreeState = 'Yes' | 'No' | 'No internet service'

export interface Customer {
  id: number
  username: string
  avatar_seed: string
  gender: string
  senior_citizen: boolean
  partner: boolean
  dependents: boolean
  tenure: number
  phone_service: boolean
  multiple_lines: string
  internet_service: string
  online_security: string
  online_backup: string
  device_protection: string
  tech_support: string
  streaming_tv: string
  streaming_movies: string
  contract: string
  paperless_billing: boolean
  payment_method: string
  monthly_charges: number
  total_charges: number
  /** Observed outcome in the dataset. Not a prediction. */
  churn: boolean
  /** Latest model prediction for the active model version. */
  churn_probability: number | null
  risk: Risk | null
}

export interface CustomerPage {
  total: number
  limit: number
  offset: number
  items: Customer[]
}

export type SortKey = 'id' | 'risk_desc' | 'risk_asc' | 'tenure_desc' | 'tenure_asc' | 'charges_desc'

export interface CustomerQuery {
  limit?: number
  offset?: number
  search?: string
  contract?: string
  internet_service?: string
  churn?: boolean
  risk?: Risk
  tenure_min?: number
  tenure_max?: number
  sort?: SortKey
}

/** What the prediction form / what-if simulator sends. Mirrors the customers table. */
export interface PredictionInput {
  gender: 'Female' | 'Male'
  senior_citizen: boolean
  partner: boolean
  dependents: boolean
  tenure: number
  phone_service: boolean
  multiple_lines: 'Yes' | 'No' | 'No phone service'
  internet_service: 'DSL' | 'Fiber optic' | 'No'
  online_security: ThreeState
  online_backup: ThreeState
  device_protection: ThreeState
  tech_support: ThreeState
  streaming_tv: ThreeState
  streaming_movies: ThreeState
  contract: 'Month-to-month' | 'One year' | 'Two year'
  paperless_billing: boolean
  payment_method: 'Electronic check' | 'Mailed check' | 'Bank transfer (automatic)' | 'Credit card (automatic)'
  monthly_charges: number
  total_charges: number
}

export interface FeatureContribution {
  /** snake_case model feature key */
  feature: string
  label: string
  value: string | number | null
  /** SHAP: log-odds. LIME: probability units. Positive pushes towards churn. */
  contribution: number
  /** LIME only, e.g. "Tenure (months) <= 9.00" */
  rule?: string | null
}

export type ExplanationMethod = 'shap' | 'lime'

export interface Explanation {
  method: ExplanationMethod
  /** SHAP: baseline log-odds (E[f(x)]). LIME: surrogate intercept. */
  base_value: number | null
  values: FeatureContribution[]
}

export interface PredictionResult {
  prediction_id: number
  churn: boolean
  probability: number
  risk: Risk
  /** The model's churn / no-churn cut-off (a decision threshold, not a risk band). */
  threshold: number
  model_version: string
  /** ISO timestamp of when this prediction was stored. */
  predicted_at: string
  cached: boolean
  explanations: Explanation[]
}

export interface ContractStat {
  contract: string
  customers: number
  churn_rate: number
}

export interface RiskBandStat {
  band: Risk
  customers: number
  avg_probability: number
  /** In-sample: these customers were part of the training data. */
  observed_churn_rate: number
}

export interface HistogramBin {
  lower: number
  upper: number
  customers: number
}

export interface Segment {
  dimension: 'contract' | 'internet_service' | 'tenure'
  value: string
  customers: number
  avg_probability: number
  observed_churn_rate: number
  high_risk_share: number
}

export interface RiskThresholds {
  low_max: number
  high_min: number
  decision_threshold: number
}

export interface Overview {
  customers: number
  churned: number
  churn_rate: number
  avg_monthly_charges: number
  by_contract: ContractStat[]
  model_version: string | null
  avg_probability: number | null
  high_risk_customers: number | null
  risk_thresholds: RiskThresholds | null
  risk_distribution: RiskBandStat[]
  probability_histogram: HistogramBin[]
  segments: Segment[]
}

export interface RecentPrediction {
  id: number
  created_at: string
  probability: number
  churn: boolean
  risk: Risk
  model_version: string
  contract: string | null
  tenure: number | null
  monthly_charges: number | null
  internet_service: string | null
}

export interface ModelMetrics {
  roc_auc: number
  pr_auc: number
  brier: number
  threshold: number
  accuracy: number
  precision: number
  recall: number
  f1: number
}

export interface ModelInfo {
  model_version: string
  algorithm: string
  trained_at: string
  threshold: number
  n_train: number
  n_test: number
  churn_rate: number
  features: string[]
  categories: Record<string, string[]>
  metrics: Record<string, { cv: ModelMetrics; test: ModelMetrics }>
}

export interface Health {
  status: string
  database: string
  cache: 'up' | 'down'
  model: string | null
}
