import { Role } from '@prisma/client';
import { Request } from 'express';

// Authenticated request — always has user + businessId injected by middleware
export interface AuthRequest extends Request {
  user: {
    id: string;
    businessId: string;
    role: Role;
    email: string;
  };
}

// Standard API response envelope
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export type PaginationQuery = {
  page?: number;
  limit?: number;
};
