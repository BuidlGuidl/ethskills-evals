const API_URL = import.meta.env.VITE_API_URL || "";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return payload;
}

export function getBootstrap() {
  return request("/api/bootstrap");
}

export function createTool(tool) {
  return request("/api/tools", {
    method: "POST",
    body: JSON.stringify(tool)
  });
}

export function createMember(member) {
  return request("/api/members", {
    method: "POST",
    body: JSON.stringify(member)
  });
}

export function createBorrowRequest(borrowRequest) {
  return request("/api/requests", {
    method: "POST",
    body: JSON.stringify(borrowRequest)
  });
}

export function updateBorrowRequest(id, patch) {
  return request(`/api/requests/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch)
  });
}

export function createLoan(loan) {
  return request("/api/loans", {
    method: "POST",
    body: JSON.stringify(loan)
  });
}

export function updateLoan(id, patch) {
  return request(`/api/loans/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch)
  });
}
