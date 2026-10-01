import type { OrganizationType } from '../types';

// Mirrors backend Auth/Roles.cs.
export const ROLES = {
  PlatformAdmin: 'PlatformAdmin',
  ProviderOwner: 'ProviderOwner',
  ProviderStaff: 'ProviderStaff',
  ClientOwner: 'ClientOwner',
  ClientMember: 'ClientMember',
} as const;

/** The roles a member of this kind of organisation can have (owner first). */
export function rolesFor(type: OrganizationType): string[] {
  switch (type) {
    case 'Provider': return [ROLES.ProviderOwner, ROLES.ProviderStaff];
    case 'Client': return [ROLES.ClientOwner, ROLES.ClientMember];
    default: return [ROLES.PlatformAdmin];
  }
}

export const isOwner = (role?: string) => role === ROLES.ProviderOwner || role === ROLES.ClientOwner;
export const isPlatformAdmin = (role?: string) => role === ROLES.PlatformAdmin;
