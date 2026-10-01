import { api } from './http';
import type { AdminOrganization, AuthResponse, Me, RegisterInput, TeamMember, TeamMemberInput } from '../types';

export const authApi = {
  login: (email: string, password: string) => api.post<AuthResponse>('/api/auth/login', { email, password }),
  register: (data: RegisterInput) => api.post<AuthResponse>('/api/auth/register', data),
  me: () => api.get<Me>('/api/auth/me'),
};

export const teamApi = {
  list: () => api.get<TeamMember[]>('/api/team'),
  add: (data: TeamMemberInput) => api.post<TeamMember>('/api/team', data),
  update: (id: number, role: string, isActive: boolean) => api.put<TeamMember>(`/api/team/${id}`, { role, isActive }),
};

const ADMIN = '/api/admin/organizations';

export const adminApi = {
  organizations: () => api.get<AdminOrganization[]>(ADMIN),
  approve: (id: number) => api.post<void>(`${ADMIN}/${id}/approve`, {}),
  reject: (id: number, note: string) => api.post<void>(`${ADMIN}/${id}/reject`, { note }),
  suspend: (id: number, note: string) => api.post<void>(`${ADMIN}/${id}/suspend`, { note }),
  reactivate: (id: number) => api.post<void>(`${ADMIN}/${id}/reactivate`, {}),
};
