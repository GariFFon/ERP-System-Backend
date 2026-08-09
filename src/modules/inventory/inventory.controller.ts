import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../middleware/auth';
import {
  sendSuccess,
  sendError,
  getPaginationParams,
  buildPaginationMeta,
} from '../../utils/apiResponse';

// GET /api/inventory/movements
export const listMovements = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query as Record<string, unknown>);
    const movement_type = req.query.movement_type as string | undefined;
    const product_id = req.query.product_id as string | undefined;
    const from_date = req.query.from_date as string | undefined;
    const to_date = req.query.to_date as string | undefined;

    const where: Record<string, unknown> = {};
    if (movement_type) where.movementType = movement_type;
    if (product_id) where.productId = product_id;
    if (from_date || to_date) {
      where.createdAt = {
        ...(from_date ? { gte: new Date(from_date) } : {}),
        ...(to_date ? { lte: new Date(to_date) } : {}),
      };
    }

    const [movements, total] = await Promise.all([
      prisma.stockMovementLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, productName: true, sku: true } },
          creator: { select: { id: true, name: true } },
        },
      }),
      prisma.stockMovementLog.count({ where }),
    ]);

    sendSuccess(res, movements, 'Stock movements fetched', 200, buildPaginationMeta(page, limit, total));
  } catch {
    sendError(res, 'Failed to fetch stock movements', 500);
  }
};

// POST /api/inventory/movements
export const createMovement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productId, quantityChanged, movementType, reason } =
      req.body as { productId?: string; quantityChanged?: number; movementType?: string; reason?: string };

    if (!productId || !quantityChanged || !movementType || !reason) {
      sendError(res, 'productId, quantityChanged, movementType, and reason are required', 400);
      return;
    }

    const qty = Number(quantityChanged);

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) { sendError(res, 'Product not found', 404); return; }

    if (movementType === 'OUT' && product.currentStock < qty) {
      sendError(
        res,
        `Insufficient stock for "${product.productName}". Available: ${product.currentStock}, Requested: ${qty}`,
        400
      );
      return;
    }

    const newStock = movementType === 'IN'
      ? product.currentStock + qty
      : product.currentStock - qty;

    const [movement] = await prisma.$transaction([
      prisma.stockMovementLog.create({
        data: {
          productId,
          quantityChanged: qty,
          movementType: movementType as 'IN' | 'OUT',
          reason,
          createdBy: req.user!.sub,
        },
        include: {
          product: { select: { id: true, productName: true, sku: true } },
          creator: { select: { id: true, name: true } },
        },
      }),
      prisma.product.update({
        where: { id: productId },
        data: { currentStock: newStock },
      }),
    ]);

    sendSuccess(res, movement, 'Stock movement recorded successfully', 201);
  } catch {
    sendError(res, 'Failed to record stock movement', 500);
  }
};

// GET /api/inventory/movements/:productId
export const getProductMovements = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query as Record<string, unknown>);
    const productId = req.params.productId as string;

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) { sendError(res, 'Product not found', 404); return; }

    const [movements, total] = await Promise.all([
      prisma.stockMovementLog.findMany({
        where: { productId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { creator: { select: { id: true, name: true } } },
      }),
      prisma.stockMovementLog.count({ where: { productId } }),
    ]);

    sendSuccess(res, movements, 'Product movements fetched', 200, buildPaginationMeta(page, limit, total));
  } catch {
    sendError(res, 'Failed to fetch product movements', 500);
  }
};
