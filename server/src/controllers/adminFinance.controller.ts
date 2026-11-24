import { type Request, type Response } from 'express';
import { adminFinanceService } from '../services/adminFinance.service.js';

export const getFinanceOverview = async (req: Request, res: Response) => {
  const query = req.query as Record<string, string | undefined>;
  const overview = await adminFinanceService.getFinanceOverview({
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    parkingLotId: query.parkingLotId,
    ownerId: query.ownerId,
    paymentType: query.paymentType,
    paymentMethod: query.paymentMethod,
  });

  return res.status(200).json({
    success: true,
    data: overview,
  });
};

export const getPayments = async (req: Request, res: Response) => {
  const query = req.query as Record<string, string | undefined>;
  const result = await adminFinanceService.getPayments({
    search: query.search,
    status: query.status,
    paymentType: query.paymentType,
    paymentMethod: query.paymentMethod,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    parkingLotId: query.parkingLotId,
    ownerId: query.ownerId,
    sortBy: query.sortBy,
    sortOrder: (query.sortOrder as 'asc' | 'desc') || 'desc',
    page: query.page ? Number(query.page) : 1,
    limit: query.limit ? Number(query.limit) : 10,
  });

  return res.status(200).json({
    success: true,
    data: result.payments,
    pagination: result.pagination,
  });
};

export const getPaymentById = async (req: Request, res: Response) => {
  const id = String(req.params.id || '');
  const detail = await adminFinanceService.getPaymentById(id);

  return res.status(200).json({
    success: true,
    data: detail,
  });
};

export const exportPaymentsCsv = async (req: Request, res: Response) => {
  const query = req.query as Record<string, string | undefined>;
  const csvContent = await adminFinanceService.exportPaymentsCsv({
    search: query.search,
    status: query.status,
    paymentType: query.paymentType,
    paymentMethod: query.paymentMethod,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    parkingLotId: query.parkingLotId,
    ownerId: query.ownerId,
  });

  const filename = `parkease-payments-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  return res.status(200).send(csvContent);
};

export const getFinanceFilterOptions = async (_req: Request, res: Response) => {
  const options = await adminFinanceService.getFilterOptions();

  return res.status(200).json({
    success: true,
    data: options,
  });
};
