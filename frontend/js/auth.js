export const API_BASE_URL = "http://127.0.0.1:8000";

const ACCESS_TOKEN_KEY = "speechpt_access_token";
const REFRESH_TOKEN_KEY = "speechpt_refresh_token";

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens({ access_token, refresh_token }) {
  localStorage.setItem(ACCESS_TOKEN_KEY, access_token);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
}

export function setTokensFromUrlParams() {
  if (typeof window === "undefined") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (!accessToken || !refreshToken) {
    return false;
  }

  setTokens({ access_token: accessToken, refresh_token: refreshToken });
  params.delete("access_token");
  params.delete("refresh_token");

  const newSearch = params.toString();
  const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ""}${window.location.hash}`;
  window.history.replaceState({}, document.title, newUrl);
  return true;
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export async function refreshAuthToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error("refresh token이 없습니다.");
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    clearTokens();
    throw new Error("토큰 갱신에 실패했습니다.");
  }

  const tokens = await response.json();
  setTokens(tokens);
  return tokens.access_token;
}

export async function authFetch(url, options = {}) {
  const headers = {
    ...(options.headers || {}),
  };

  const accessToken = getAccessToken();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401 && getRefreshToken() && !url.endsWith("/auth/refresh")) {
    try {
      const newAccessToken = await refreshAuthToken();
      headers.Authorization = `Bearer ${newAccessToken}`;
      return await fetch(url, {
        ...options,
        headers,
      });
    } catch (refreshError) {
      throw refreshError;
    }
  }

  return response;
}

export async function fetchJson(url, options = {}) {
  const response = await authFetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    const detail = errorText || response.statusText || "요청 처리 중 오류가 발생했습니다.";
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }
  return await response.json();
}
