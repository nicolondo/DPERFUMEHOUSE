import api from './api';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export async function loginAdmin(email: string, password: string): Promise<AdminUser> {
  const { data } = await api.post<{ accessToken: string; refreshToken: string; user: { id: string; email: string; name: string; role: string } }>('/auth/login', {
    email,
    password,
  });

  if (data.user.role !== 'ADMIN') {
    throw new Error('Acceso no autorizado. Solo administradores.');
  }

  localStorage.setItem('admin_access_token', data.accessToken);
  localStorage.setItem('admin_refresh_token', data.refreshToken);

  const adminUser: AdminUser = {
    id: data.user.id,
    email: data.user.email,
    name: data.user.name,
    role: data.user.role,
  };

  localStorage.setItem('admin_user', JSON.stringify(adminUser));
  return adminUser;
}

export function getAdminUser(): AdminUser | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('admin_user');
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_access_token');
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

export function logoutAdmin() {
  localStorage.removeItem('admin_access_token');
  localStorage.removeItem('admin_refresh_token');
  localStorage.removeItem('admin_user');
  window.location.href = '/login';
}
