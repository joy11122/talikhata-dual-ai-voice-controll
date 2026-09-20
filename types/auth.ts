export type UserRole = 'USER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';
export interface SessionUser { id: string; name?: string | null; email?: string | null; image?: string | null; role?: UserRole; status?: UserStatus; shopId?: string | null; }
