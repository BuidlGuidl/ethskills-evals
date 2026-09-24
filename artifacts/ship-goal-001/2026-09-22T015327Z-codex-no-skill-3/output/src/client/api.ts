import type {
  ApproveLoanInput,
  CreateToolInput,
  DeclineLoanInput,
  RequestLoanInput,
  ReturnLoanInput,
  ToolshedState
} from "../shared/types";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export function getState(): Promise<ToolshedState> {
  return request<ToolshedState>("/api/state");
}

export function createTool(input: CreateToolInput): Promise<unknown> {
  return request("/api/tools", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function requestLoan(input: RequestLoanInput): Promise<unknown> {
  return request("/api/loans", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function approveLoan(loanId: string, input: ApproveLoanInput): Promise<unknown> {
  return request(`/api/loans/${loanId}/approve`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function declineLoan(loanId: string, input: DeclineLoanInput): Promise<unknown> {
  return request(`/api/loans/${loanId}/decline`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function returnLoan(loanId: string, input: ReturnLoanInput): Promise<unknown> {
  return request(`/api/loans/${loanId}/return`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}
