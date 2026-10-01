import { api } from './http';
import type {
  AdminOrganization, AdminWarehouse, AuthResponse, Me, Photo, RegisterInput, SearchFilters, SearchResult,
  SpaceOffer, SpaceOfferInput, TeamMember, TeamMemberInput, WarehouseDetail, WarehouseInput, WarehouseSummary,
} from '../types';

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

// ---- listings (a warehouse business's own) ----

const W = '/api/warehouses';

export const warehousesApi = {
  list: () => api.get<WarehouseSummary[]>(W),
  get: (id: number) => api.get<WarehouseDetail>(`${W}/${id}`),
  create: (data: WarehouseInput) => api.post<WarehouseDetail>(W, data),
  update: (id: number, data: WarehouseInput) => api.put<WarehouseDetail>(`${W}/${id}`, data),
  remove: (id: number) => api.del<void>(`${W}/${id}`),
  submit: (id: number) => api.post<void>(`${W}/${id}/submit`, {}),
  addOffer: (id: number, data: SpaceOfferInput) => api.post<SpaceOffer>(`${W}/${id}/offers`, data),
  updateOffer: (id: number, offerId: number, data: SpaceOfferInput) => api.put<SpaceOffer>(`${W}/${id}/offers/${offerId}`, data),
  removeOffer: (id: number, offerId: number) => api.del<void>(`${W}/${id}/offers/${offerId}`),
  addPhoto: (id: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.postForm<Photo>(`${W}/${id}/photos`, form);
  },
  removePhoto: (id: number, photoId: number) => api.del<void>(`${W}/${id}/photos/${photoId}`),
  makeCover: (id: number, photoId: number) => api.post<void>(`${W}/${id}/photos/${photoId}/cover`, {}),
};

// ---- the marketplace ----

export const searchApi = {
  search: (filters: SearchFilters) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '') query.set(key, String(value));
    }
    return api.get<SearchResult[]>(`/api/search/warehouses?${query}`);
  },
  cities: () => api.get<string[]>('/api/search/cities'),
  get: (id: number) => api.get<WarehouseDetail>(`/api/search/warehouses/${id}`),
};

// ---- the platform admin's listing review ----

const AW = '/api/admin/warehouses';

export const adminListingsApi = {
  list: () => api.get<AdminWarehouse[]>(AW),
  get: (id: number) => api.get<WarehouseDetail>(`${AW}/${id}`),
  approve: (id: number) => api.post<void>(`${AW}/${id}/approve`, {}),
  reject: (id: number, note: string) => api.post<void>(`${AW}/${id}/reject`, { note }),
};
