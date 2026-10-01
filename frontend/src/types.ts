// Shapes the API sends and receives (mirrors backend/SpaceShare.Api/Dtos).

export type OrganizationType = 'Platform' | 'Provider' | 'Client';
export type OrganizationStatus = 'Pending' | 'Active' | 'Rejected' | 'Suspended';

export interface MeUser {
  id: number;
  fullName: string;
  email: string;
  role: string;
}

export interface MeOrganization {
  id: number;
  name: string;
  type: OrganizationType;
  status: OrganizationStatus;
  reviewNote: string | null;
}

export interface Me {
  user: MeUser;
  organization: MeOrganization;
}

export interface AuthResponse {
  token: string;
  expiresAt: string;
  me: Me;
}

export interface RegisterInput {
  organizationType: 'Provider' | 'Client';
  organizationName: string;
  city: string | null;
  phone: string | null;
  fullName: string;
  email: string;
  password: string;
}

export interface TeamMember {
  id: number;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface TeamMemberInput {
  fullName: string;
  email: string;
  role: string;
  password: string;
}

// ---- listings ----

export type WarehouseStatus = 'Draft' | 'Pending' | 'Approved' | 'Rejected';
export type SpaceUnit = 'Pallet' | 'Shelf' | 'SquareMeter';
export type Temperature = 'Ambient' | 'Chilled' | 'Frozen';

export const WAREHOUSE_FEATURES = ['Cctv', 'SecurityGuards', 'Access24h', 'LoadingDock', 'Forklift', 'Racking', 'FireSystem'] as const;
export const SPACE_UNITS: SpaceUnit[] = ['Pallet', 'Shelf', 'SquareMeter'];
export const TEMPERATURES: Temperature[] = ['Ambient', 'Chilled', 'Frozen'];

export interface WarehouseInput {
  name: string;
  city: string;
  address: string;
  description: string | null;
  openingHours: string | null;
  features: string[];
}

export interface SpaceOfferInput {
  unitType: SpaceUnit;
  temperature: Temperature;
  capacity: number;
  pricePerWeek: number;
  minWeeks: number;
  isActive: boolean;
  notes: string | null;
}

export interface SpaceOffer extends SpaceOfferInput {
  id: number;
}

export interface Photo {
  id: number;
  url: string;
}

export interface WarehouseSummary {
  id: number;
  name: string;
  city: string;
  status: WarehouseStatus;
  coverUrl: string | null;
  photoCount: number;
  activeOfferCount: number;
  updatedAt: string;
}

export interface WarehouseDetail {
  id: number;
  name: string;
  city: string;
  address: string;
  description: string | null;
  openingHours: string | null;
  features: string[];
  status: WarehouseStatus;
  reviewNote: string | null;
  submittedAt: string | null;
  providerName: string;
  photos: Photo[];
  offers: SpaceOffer[];
}

export interface SearchResult {
  id: number;
  name: string;
  city: string;
  providerName: string;
  coverUrl: string | null;
  features: string[];
  offers: SpaceOffer[];
}

export interface SearchFilters {
  city?: string;
  unitType?: SpaceUnit;
  temperature?: Temperature;
  maxPrice?: number;
  minUnits?: number;
}

export interface AdminWarehouse {
  id: number;
  name: string;
  city: string;
  status: WarehouseStatus;
  providerName: string;
  coverUrl: string | null;
  photoCount: number;
  activeOfferCount: number;
  submittedAt: string | null;
  reviewNote: string | null;
}

export interface AdminOrganization {
  id: number;
  name: string;
  type: OrganizationType;
  status: OrganizationStatus;
  city: string | null;
  phone: string | null;
  createdAt: string;
  ownerName: string | null;
  ownerEmail: string | null;
  userCount: number;
  reviewedAt: string | null;
  reviewNote: string | null;
}
