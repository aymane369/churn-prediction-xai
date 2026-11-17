/** Minimal typed fetch wrapper. All requests are same-origin (`/api/...`). */

export class ApiError extends Error {
  readonly status: number
  readonly kind: 'network' | 'http'

  constructor(message: string, status: number, kind: 'network' | 'http') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.kind = kind
  }

  /** True when retrying the same request cannot help (bad input, not found, model missing). */
  get isClientError() {
    return this.kind === 'http' && this.status >= 400 && this.status < 500
  }
  get isModelUnavailable() {
    return this.status === 503
  }
}

function describe(detail: unknown): string | null {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) {
    // FastAPI validation errors: [{ loc: [...], msg: "..." }]
    const first = detail[0] as { loc?: unknown[]; msg?: string }
    const where = Array.isArray(first.loc) ? first.loc.filter((p) => p !== 'body').join('.') : ''
    return where ? `${where}: ${first.msg ?? 'invalid value'}` : (first.msg ?? null)
  }
  return null
}

export async function request<T>(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal; params?: Record<string, unknown> } = {},
): Promise<T> {
  const { method = 'GET', body, signal, params } = options

  let url = path
  if (params) {
    const qs = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') qs.set(key, String(value))
    }
    const s = qs.toString()
    if (s) url += `?${s}`
  }

  let response: Response
  try {
    response = await fetch(url, {
      method,
      signal,
      headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('The server could not be reached.', 0, 'network')
  }

  if (!response.ok) {
    let detail: string | null = null
    try {
      detail = describe((await response.json()).detail)
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(detail ?? `Request failed (${response.status}).`, response.status, 'http')
  }
  return (await response.json()) as T
}
