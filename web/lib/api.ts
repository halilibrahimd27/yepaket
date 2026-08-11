/**
 * Backend hand-off contract.
 * UI currently reads local dummy data. Set NEXT_PUBLIC_API_MODE=remote when
 * the backend implements docs/API_CONTRACT.md.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.yepaket.app/v1";

export const API_MODE = process.env.NEXT_PUBLIC_API_MODE ?? "dummy";

export const endpoints = {
  auth: {
    login: "/auth/login",
    refresh: "/auth/refresh",
    oauth: (provider: "google" | "apple" | "microsoft") => `/auth/oauth/${provider}`,
    me: "/auth/me",
  },
  bags: {
    list: "/bags",
    nearby: "/bags/nearby",
    detail: (id: string) => `/bags/${id}`,
    favorite: (id: string) => `/bags/${id}/favorite`,
  },
  orders: {
    list: "/orders",
    create: "/orders",
    detail: (id: string) => `/orders/${id}`,
    cancel: (id: string) => `/orders/${id}/cancel`,
    pickup: (id: string) => `/orders/${id}/pickup`,
    sharePickup: (id: string) => `/orders/${id}/share-pickup`,
  },
  partners: {
    apply: "/partners/applications",
    dashboard: "/partner/dashboard",
    bags: "/partner/bags",
    orders: "/partner/orders",
    payouts: "/partner/payouts",
  },
  support: { tickets: "/support/tickets" },
} as const;

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { accessToken?: string } = {},
): Promise<T> {
  const { accessToken, headers, ...request } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...request,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(response.status, error);
  }

  return response.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, public payload: unknown) {
    super(`YePaket API error: ${status}`);
  }
}

