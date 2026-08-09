import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../middleware/auth';
import {
  sendSuccess,
  sendError,
  getPaginationParams,
  buildPaginationMeta,
} from '../../utils/apiResponse';

// GET /api/customers
export const listCustomers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query as Record<string, unknown>);
    const q = req.query.q as string | undefined;
    const status = req.query.status as string | undefined;
    const customer_type = req.query.customer_type as string | undefined;
    const follow_up_date = req.query.follow_up_date as string | undefined;

    const where: Record<string, unknown> = {};

    if (q) {
      where.OR = [
        { customerName: { contains: q, mode: 'insensitive' } },
        { mobileNumber: { contains: q, mode: 'insensitive' } },
        { businessName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;
    if (customer_type) where.customerType = customer_type;
    if (follow_up_date) {
      const date = new Date(follow_up_date);
      where.followUpDate = {
        gte: date,
        lt: new Date(date.getTime() + 86400000),
      };
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { creator: { select: { id: true, name: true } } },
      }),
      prisma.customer.count({ where }),
    ]);

    sendSuccess(res, customers, 'Customers fetched', 200, buildPaginationMeta(page, limit, total));
  } catch {
    sendError(res, 'Failed to fetch customers', 500);
  }
};

// POST /api/customers
export const createCustomer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      customerName, mobileNumber, email, businessName, gstNumber,
      customerType, address, status, followUpDate, notes,
    } = req.body as Record<string, string | undefined>;

    if (!customerName || !mobileNumber || !customerType || !address || !status) {
      sendError(res, 'customerName, mobileNumber, customerType, address, and status are required', 400);
      return;
    }

    const customer = await prisma.customer.create({
      data: {
        customerName,
        mobileNumber,
        email: email || null,
        businessName: businessName || null,
        gstNumber: gstNumber || null,
        customerType: customerType as 'Retail' | 'Wholesale' | 'Distributor',
        address,
        status: status as 'Lead' | 'Active' | 'Inactive',
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        notes: notes || null,
        createdBy: req.user!.sub,
      },
    });

    sendSuccess(res, customer, 'Customer created successfully', 201);
  } catch {
    sendError(res, 'Failed to create customer', 500);
  }
};

// GET /api/customers/:id
export const getCustomer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true } },
        followups: {
          orderBy: { createdAt: 'desc' },
          include: { creator: { select: { id: true, name: true } } },
        },
      },
    });

    if (!customer) { sendError(res, 'Customer not found', 404); return; }
    sendSuccess(res, customer);
  } catch {
    sendError(res, 'Failed to fetch customer', 500);
  }
};

// PUT /api/customers/:id
export const updateCustomer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) { sendError(res, 'Customer not found', 404); return; }

    const {
      customerName, mobileNumber, email, businessName, gstNumber,
      customerType, address, status, followUpDate, notes,
    } = req.body as Record<string, string | undefined>;

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        customerName: customerName || existing.customerName,
        mobileNumber: mobileNumber || existing.mobileNumber,
        email: email ?? existing.email,
        businessName: businessName ?? existing.businessName,
        gstNumber: gstNumber ?? existing.gstNumber,
        customerType: (customerType as 'Retail' | 'Wholesale' | 'Distributor') || existing.customerType,
        address: address || existing.address,
        status: (status as 'Lead' | 'Active' | 'Inactive') || existing.status,
        followUpDate: followUpDate ? new Date(followUpDate) : existing.followUpDate,
        notes: notes ?? existing.notes,
      },
    });

    sendSuccess(res, customer, 'Customer updated successfully');
  } catch {
    sendError(res, 'Failed to update customer', 500);
  }
};

// DELETE /api/customers/:id
export const deleteCustomer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) { sendError(res, 'Customer not found', 404); return; }
    await prisma.customer.delete({ where: { id } });
    sendSuccess(res, null, 'Customer deleted successfully');
  } catch {
    sendError(res, 'Failed to delete customer', 500);
  }
};

// POST /api/customers/:id/followups
export const addFollowup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const customerId = req.params.id as string;
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) { sendError(res, 'Customer not found', 404); return; }

    const { note, followUpDate } = req.body as { note?: string; followUpDate?: string };
    if (!note || !followUpDate) { sendError(res, 'note and followUpDate are required', 400); return; }

    const followup = await prisma.customerFollowup.create({
      data: {
        customerId,
        note,
        followUpDate: new Date(followUpDate),
        createdBy: req.user!.sub,
      },
      include: { creator: { select: { id: true, name: true } } },
    });

    sendSuccess(res, followup, 'Follow-up added successfully', 201);
  } catch {
    sendError(res, 'Failed to add follow-up', 500);
  }
};

// GET /api/customers/:id/followups
export const listFollowups = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const customerId = req.params.id as string;
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) { sendError(res, 'Customer not found', 404); return; }

    const followups = await prisma.customerFollowup.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: { creator: { select: { id: true, name: true } } },
    });

    sendSuccess(res, followups);
  } catch {
    sendError(res, 'Failed to fetch follow-ups', 500);
  }
};
