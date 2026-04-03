import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/middleware/error.middleware';
import { AuthRequest } from '@/types';

const categorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export class CategoryController {
  list = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categories = await prisma.category.findMany({
        where: { businessId: req.user.businessId, isActive: true },
        orderBy: { name: 'asc' },
        include: { _count: { select: { products: true } } },
      });
      res.json({ success: true, data: categories });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = categorySchema.parse(req.body);
      const category = await prisma.category.create({
        data: { ...data, businessId: req.user.businessId },
      });
      res.status(201).json({ success: true, data: category });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = categorySchema.partial().parse(req.body);
      const existing = await prisma.category.findFirst({
        where: { id: req.params.id, businessId: req.user.businessId },
      });
      if (!existing) throw new AppError(404, 'Category not found');

      const updated = await prisma.category.update({ where: { id: req.params.id }, data });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const existing = await prisma.category.findFirst({
        where: { id: req.params.id, businessId: req.user.businessId },
        include: { _count: { select: { products: true } } },
      });
      if (!existing) throw new AppError(404, 'Category not found');
      if (existing._count.products > 0) {
        throw new AppError(400, 'Cannot delete category with existing products');
      }

      await prisma.category.update({
        where: { id: req.params.id },
        data: { isActive: false },
      });
      res.json({ success: true, message: 'Category removed' });
    } catch (err) {
      next(err);
    }
  };
}
