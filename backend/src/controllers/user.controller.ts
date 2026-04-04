import { Response, NextFunction } from 'express';
import { prisma } from '@/lib/prisma';
import { AuthRequest } from '@/types';

export class UserController {
  list = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const users = await prisma.user.findMany({
        where: { businessId: req.user.businessId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          business: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json({ success: true, data: users });
    } catch (err) {
      next(err);
    }
  };
}
