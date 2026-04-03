import api from './api';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  name: string;
  sellerId?: string;
  exp: number;
  iat: number;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    sellerId?: string;
    canManageSellers?: boolean;
  };
}

function decodeJwt(token: string): JwtPayload | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', {
    email,
    password,
  });

  const { accessToken, refreshToken, user } = data;

  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
  localStorage.setItem('user', JSON.stringify(user));

  return data;
}

export async function refresh(): Promise<string> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const { data } = await api.post<{ accessToken: string; refreshToken?: string }>(
    '/auth/refresh',
    { refreshToken }
  );

  const { accessToken, refreshToken: newRefreshToken } = data;
  localStorage.setItem('access_token', accessToken);
  if (newRefreshToken) {
    localStorage.setItem('refresh_token', newRefreshToken);
  }

  return accessToken;
}

export function logout(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

export function getUser(): JwtPayload | null {
  const token = localStorage.getItem('access_token');
  if (!token) return null;

  const payload = decodeJwt(token);
  if (!payload) return null;

  // Check if token is expired
  if (payload.exp * 1000 < Date.now()) {
    return null;
  }

  return payload;
}

export function getStoredUser(): LoginResponse['user'] | null {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  const token = localStorage.getItem('access_token');
  if (!token) return false;

  const payload = decodeJwt(token);
  if (!payload) return false;

  return payload.exp * 1000 > Date.now();
}

export function getAccessToken(): string | null {
  return localStorage.getItem('access_token');
}
