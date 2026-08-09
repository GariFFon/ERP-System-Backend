import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../middleware/auth';
import { generateChallanNumber } from '../../utils/challanNumber';
import {
  sendSuccess,
  sendError,
  getPaginationParams,
  buildPaginationMeta,
} from '../../utils/apiResponse';

interface ChallanItemInput {
  productId: string;
  quantity: number;
}

// GET /api/challans
export const listChallans = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query as Record<string, unknown>);
    const status = req.query.status as string | undefined;
    const customer_id = req.query.customer_id as string | undefined;
    const from_date = req.query.from_date as string | undefined;
    const to_date = req.query.to_date as string | undefined;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (customer_id) where.customerId = customer_id;
    if (from_date || to_date) {
      where.createdAt = {
        ...(from_date ? { gte: new Date(from_date) } : {}),
        ...(to_date ? { lte: new Date(to_date) } : {}),
      };
    }

    const [challans, total] = await Promise.all([
      prisma.challan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, customerName: true, mobileNumber: true } },
          creator: { select: { id: true, name: true } },
          items: true,
        },
      }),
      prisma.challan.count({ where }),
    ]);

    sendSuccess(res, challans, 'Challans fetched', 200, buildPaginationMeta(page, limit, total));
  } catch {
    sendError(res, 'Failed to fetch challans', 500);
  }
};

// POST /api/challans
export const createChallan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { customerId, items, status = 'Draft' } = req.body as {
      customerId?: string;
      items?: ChallanItemInput[];
      status?: string;
    };

    if (status !== 'Draft' && status !== 'Confirmed') {
      sendError(res, 'Status must be Draft or Confirmed', 400);
      return;
    }

    if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
      sendError(res, 'customerId and at least one item are required', 400);
      return;
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) { sendError(res, 'Customer not found', 404); return; }

    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map(p => [p.id, p]));

    for (const item of items) {
      if (!productMap.has(item.productId)) {
        sendError(res, `Product ${item.productId} not found`, 404);
        return;
      }
    }

    if (status === 'Confirmed') {
      for (const item of items) {
        const product = productMap.get(item.productId)!;
        if (product.currentStock < item.quantity) {
          sendError(
            res,
            `Insufficient stock for "${product.productName}". Available: ${product.currentStock}, Requested: ${item.quantity}`,
            400
          );
          return;
        }
      }
    }

    const challanNumber = await generateChallanNumber();
    const totalQuantity = items.reduce((sum, i) => sum + Number(i.quantity), 0);

    const challanItems = items.map(item => {
      const product = productMap.get(item.productId)!;
      return {
        productId: item.productId,
        productNameSnapshot: product.productName,
        skuSnapshot: product.sku,
        unitPriceSnapshot: product.unitPrice,
        quantity: Number(item.quantity),
      };
    });

    const challan = await prisma.$transaction(async (tx) => {
      const created = await tx.challan.create({
        data: {
          challanNumber,
          customerId,
          totalQuantity,
          status: status as 'Draft' | 'Confirmed' | 'Cancelled',
          createdBy: req.user!.sub,
          items: { create: challanItems },
        },
        include: {
          customer: { select: { id: true, customerName: true } },
          creator: { select: { id: true, name: true } },
          items: true,
        },
      });

      if (status === 'Confirmed') {
        for (const item of items) {
          const product = productMap.get(item.productId)!;
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { decrement: item.quantity } },
          });
          await tx.stockMovementLog.create({
            data: {
              productId: item.productId,
              quantityChanged: item.quantity,
              movementType: 'OUT',
              reason: `Challan ${challanNumber} confirmed`,
              createdBy: req.user!.sub,
            },
          });
        }
      }

      return created;
    });

    sendSuccess(res, challan, 'Challan created successfully', 201);
  } catch {
    sendError(res, 'Failed to create challan', 500);
  }
};

// GET /api/challans/:id
export const getChallan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const challan = await prisma.challan.findUnique({
      where: { id },
      include: {
        customer: true,
        creator: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { id: true, productName: true, sku: true } } },
        },
      },
    });

    if (!challan) { sendError(res, 'Challan not found', 404); return; }
    sendSuccess(res, challan);
  } catch {
    sendError(res, 'Failed to fetch challan', 500);
  }
};

// PUT /api/challans/:id
export const updateChallan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const challan = await prisma.challan.findUnique({ where: { id }, include: { items: true } });

    if (!challan) { sendError(res, 'Challan not found', 404); return; }
    if (challan.status !== 'Draft') { sendError(res, 'Only Draft challans can be edited', 400); return; }

    const { customerId, items } = req.body as { customerId?: string; items?: ChallanItemInput[] };
    if (!items || !Array.isArray(items) || items.length === 0) {
      sendError(res, 'At least one item is required', 400);
      return;
    }

    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map(p => [p.id, p]));

    for (const item of items) {
      if (!productMap.has(item.productId)) {
        sendError(res, `Product ${item.productId} not found`, 404);
        return;
      }
    }

    const totalQuantity = items.reduce((sum, i) => sum + Number(i.quantity), 0);
    const challanItems = items.map(item => {
      const product = productMap.get(item.productId)!;
      return {
        productId: item.productId,
        productNameSnapshot: product.productName,
        skuSnapshot: product.sku,
        unitPriceSnapshot: product.unitPrice,
        quantity: Number(item.quantity),
      };
    });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.challanItem.deleteMany({ where: { challanId: id } });
      return tx.challan.update({
        where: { id },
        data: {
          customerId: customerId || challan.customerId,
          totalQuantity,
          items: { create: challanItems },
        },
        include: { customer: true, items: true },
      });
    });

    sendSuccess(res, updated, 'Challan updated successfully');
  } catch {
    sendError(res, 'Failed to update challan', 500);
  }
};

// PATCH /api/challans/:id/confirm
export const confirmChallan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const challan = await prisma.challan.findUnique({ where: { id }, include: { items: true } });

    if (!challan) { sendError(res, 'Challan not found', 404); return; }
    if (challan.status !== 'Draft') { sendError(res, 'Only Draft challans can be confirmed', 400); return; }

    for (const item of challan.items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) { sendError(res, `Product ${item.productId} not found`, 404); return; }
      if (product.currentStock < item.quantity) {
        sendError(
          res,
          `Insufficient stock for "${product.productName}". Available: ${product.currentStock}, Requested: ${item.quantity}`,
          400
        );
        return;
      }
    }

    const confirmed = await prisma.$transaction(async (tx) => {
      for (const item of challan.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { decrement: item.quantity } },
        });
        await tx.stockMovementLog.create({
          data: {
            productId: item.productId,
            quantityChanged: item.quantity,
            movementType: 'OUT',
            reason: `Challan ${challan.challanNumber} confirmed`,
            createdBy: req.user!.sub,
          },
        });
      }

      return tx.challan.update({
        where: { id },
        data: { status: 'Confirmed' },
        include: { customer: true, items: true, creator: true },
      });
    });

    sendSuccess(res, confirmed, 'Challan confirmed successfully');
  } catch {
    sendError(res, 'Failed to confirm challan', 500);
  }
};

// PATCH /api/challans/:id/cancel
export const cancelChallan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const challan = await prisma.challan.findUnique({ where: { id }, include: { items: true } });

    if (!challan) { sendError(res, 'Challan not found', 404); return; }
    if (challan.status === 'Cancelled') { sendError(res, 'Challan is already cancelled', 400); return; }

    const cancelled = await prisma.$transaction(async (tx) => {
      // Restore stock if it was confirmed
      if (challan.status === 'Confirmed') {
        for (const item of challan.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { increment: item.quantity } },
          });
          await tx.stockMovementLog.create({
            data: {
              productId: item.productId,
              quantityChanged: item.quantity,
              movementType: 'IN',
              reason: `Challan ${challan.challanNumber} cancelled`,
              createdBy: req.user!.sub,
            },
          });
        }
      }

      return tx.challan.update({
        where: { id },
        data: { status: 'Cancelled' },
        include: { customer: true, items: true },
      });
    });

    sendSuccess(res, cancelled, 'Challan cancelled successfully');
  } catch {
    sendError(res, 'Failed to cancel challan', 500);
  }
};

// DELETE /api/challans/:id
export const deleteChallan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const challan = await prisma.challan.findUnique({ where: { id } });

    if (!challan) { sendError(res, 'Challan not found', 404); return; }
    if (challan.status !== 'Draft') { sendError(res, 'Only Draft challans can be deleted', 400); return; }

    await prisma.challan.delete({ where: { id } });
    sendSuccess(res, null, 'Challan deleted successfully');
  } catch {
    sendError(res, 'Failed to delete challan', 500);
  }
};
