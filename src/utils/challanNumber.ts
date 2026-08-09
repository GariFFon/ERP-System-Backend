import prisma from '../config/database';

/**
 * Generates a unique challan number in format: CHN-YYYYMMDD-XXXXX
 * e.g., CHN-20260809-00001
 */
export const generateChallanNumber = async (): Promise<string> => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

  // Count challans created today to get sequence
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const count = await prisma.challan.count({
    where: {
      createdAt: {
        gte: startOfDay,
        lt: endOfDay,
      },
    },
  });

  const sequence = String(count + 1).padStart(5, '0');
  return `CHN-${dateStr}-${sequence}`;
};
