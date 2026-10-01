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
