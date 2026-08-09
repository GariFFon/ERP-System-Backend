import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../middleware/auth';
import {
  sendSuccess,
  sendError,
  getPaginationParams,
  buildPaginationMeta,
} from '../../utils/apiResponse';

// GET /api/products
export const listProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query as Record<string, unknown>);
    const q = req.query.q as string | undefined;
    const category = req.query.category as string | undefined;

    const where: Record<string, unknown> = {};
    if (q) {
      where.OR = [
        { productName: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (category) where.category = { contains: category, mode: 'insensitive' };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { creator: { select: { id: true, name: true } } },
      }),
      prisma.product.count({ where }),
    ]);

    sendSuccess(res, products, 'Products fetched', 200, buildPaginationMeta(page, limit, total));
  } catch {
    sendError(res, 'Failed to fetch products', 500);
  }
};

// GET /api/products/low-stock
export const getLowStockProducts = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allProducts = await prisma.product.findMany({ orderBy: { currentStock: 'asc' } });
    const lowStock = allProducts.filter(p => p.currentStock <= p.minStockAlertQty);
    sendSuccess(res, lowStock, 'Low stock products fetched');
  } catch {
    sendError(res, 'Failed to fetch low stock products', 500);
  }
};

// POST /api/products
export const createProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productName, sku, category, unitPrice, currentStock, minStockAlertQty, locationWarehouse } =
      req.body as Record<string, string | number | undefined>;

    if (!productName || !sku || unitPrice === undefined || minStockAlertQty === undefined) {
      sendError(res, 'productName, sku, unitPrice, and minStockAlertQty are required', 400);
      return;
    }

    const existing = await prisma.product.findUnique({ where: { sku: String(sku) } });
    if (existing) { sendError(res, `Product with SKU '${sku}' already exists`, 409); return; }

    const stockQty = Number(currentStock) || 0;

    const product = await prisma.product.create({
      data: {
        productName: String(productName),
        sku: String(sku),
        category: category ? String(category) : null,
        unitPrice: Number(unitPrice),
        currentStock: stockQty,
        minStockAlertQty: Number(minStockAlertQty),
        locationWarehouse: locationWarehouse ? String(locationWarehouse) : null,
        createdBy: req.user!.sub,
      },
    });

    if (stockQty > 0) {
      await prisma.stockMovementLog.create({
        data: {
          productId: product.id,
          quantityChanged: stockQty,
          movementType: 'IN',
          reason: 'Initial stock on product creation',
          createdBy: req.user!.sub,
        },
      });
    }

    sendSuccess(res, product, 'Product created successfully', 201);
  } catch {
    sendError(res, 'Failed to create product', 500);
  }
};

// GET /api/products/:id
export const getProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true } },
        stockMovements: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { creator: { select: { id: true, name: true } } },
        },
      },
    });

    if (!product) { sendError(res, 'Product not found', 404); return; }
    sendSuccess(res, product);
  } catch {
    sendError(res, 'Failed to fetch product', 500);
  }
};

// PUT /api/products/:id
export const updateProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) { sendError(res, 'Product not found', 404); return; }

    const { productName, sku, category, unitPrice, minStockAlertQty, locationWarehouse } =
      req.body as Record<string, string | number | undefined>;

    if (sku && String(sku) !== existing.sku) {
      const skuConflict = await prisma.product.findUnique({ where: { sku: String(sku) } });
      if (skuConflict) { sendError(res, `Product with SKU '${sku}' already exists`, 409); return; }
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        productName: productName ? String(productName) : existing.productName,
        category: category !== undefined ? (category ? String(category) : null) : existing.category,
        unitPrice: unitPrice !== undefined ? Number(unitPrice) : Number(existing.unitPrice),
        minStockAlertQty: minStockAlertQty !== undefined ? Number(minStockAlertQty) : existing.minStockAlertQty,
        locationWarehouse: locationWarehouse !== undefined ? (locationWarehouse ? String(locationWarehouse) : null) : existing.locationWarehouse,
      },
    });

    sendSuccess(res, product, 'Product updated successfully');
  } catch {
    sendError(res, 'Failed to update product', 500);
  }
};

// DELETE /api/products/:id
export const deleteProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) { sendError(res, 'Product not found', 404); return; }
    await prisma.product.delete({ where: { id } });
    sendSuccess(res, null, 'Product deleted successfully');
  } catch {
    sendError(res, 'Failed to delete product', 500);
  }
};
