import { Role } from '@prisma/client';
import { Request } from 'express';

// Re-export Express Request with required user property (augmented in express.d.ts)
// In authenticated routes, user is guaranteed to exist by the authenticate middleware
export interface AuthRequest extends Request {
  user: NonNullable<Request['user']>;
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
