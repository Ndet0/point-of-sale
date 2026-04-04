import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/middleware/error.middleware';
import { AuthRequest } from '@/types';

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sku: z.string().optional(),
  price: z.number().positive(),
  stockQuantity: z.number().int().min(0).default(0),
  lowStockAlert: z.number().int().min(0).default(5),
  categoryId: z.string().uuid().optional(),
});

export class ProductController {
  list = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.user;
      const search = req.query.search as string | undefined;
      const categoryId = req.query.categoryId as string | undefined;

      const products = await prisma.product.findMany({
        where: {
          businessId,
          isActive: true,
          deletedAt: null,
          ...(search && { name: { contains: search, mode: 'insensitive' } }),
          ...(categoryId && { categoryId }),
        },
        include: { category: { select: { name: true } } },
        orderBy: { name: 'asc' },
      });

      res.json({ success: true, data: products });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const product = await prisma.product.findFirst({
        where: { id: req.params.id as string, businessId: req.user.businessId, deletedAt: null },
        include: { category: { select: { name: true } } },
      });
      if (!product) throw new AppError(404, 'Product not found');
      res.json({ success: true, data: product });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = productSchema.parse(req.body);
      const product = await prisma.product.create({
        data: { ...data, businessId: req.user.businessId },
      });
      res.status(201).json({ success: true, data: product });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = productSchema.partial().parse(req.body);
      const product = await prisma.product.findFirst({
        where: { id: req.params.id as string, businessId: req.user.businessId, deletedAt: null },
      });
      if (!product) throw new AppError(404, 'Product not found');

      const updated = await prisma.product.update({ where: { id: req.params.id as string }, data });
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  };

  softDelete = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const product = await prisma.product.findFirst({
        where: { id: req.params.id as string, businessId: req.user.businessId, deletedAt: null },
      });
      if (!product) throw new AppError(404, 'Product not found');

      await prisma.product.update({
        where: { id: req.params.id as string },
        data: { deletedAt: new Date(), isActive: false },
      });
      res.json({ success: true, message: 'Product archived' });
    } catch (err) {
      next(err);
    }
  };
}
