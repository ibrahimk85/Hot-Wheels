import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { UnauthorizedError } from './errors';

export interface SessionUser {
  id: number;
  email: string;
  name: string | null;
}

/**
 * Get current session from request
 */
export async function getSession(request?: NextRequest): Promise<SessionUser | null> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return null;
    }
    return session.user as SessionUser;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

/**
 * Require authentication - throws error if not authenticated
 */
export async function requireAuth(request?: NextRequest): Promise<SessionUser> {
  const user = await getSession(request);
  if (!user) {
    throw new UnauthorizedError('Authentication required');
  }
  return user;
}

/**
 * Auth wrapper for API routes - combines with apiHandler
 */
export function withAuth(
  handler: (user: SessionUser, request: NextRequest, context?: any) => Promise<Response>
) {
  return async (request: NextRequest, context?: any): Promise<Response> => {
    const user = await requireAuth(request);
    return await handler(user, request, context);
  };
}


