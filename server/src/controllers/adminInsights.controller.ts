import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { adminInsightsService, type DashboardPeriod } from '../services/adminInsights.service.js';
import { AuditLogModel } from '../models/index.js';

export async function getDashboardOverview(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const period = (req.query.period as DashboardPeriod) || 'month';
  const customFrom = req.query.customFrom as string | undefined;
  const customTo = req.query.customTo as string | undefined;

  const data = await adminInsightsService.getDashboardData(period, customFrom, customTo);
  res.status(200).json({
    success: true,
    data,
  });
}

export async function getAnalytics(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const period = (req.query.period as DashboardPeriod) || 'month';
  const customFrom = req.query.customFrom as string | undefined;
  const customTo = req.query.customTo as string | undefined;

  const data = await adminInsightsService.getAnalyticsData(period, customFrom, customTo);
  res.status(200).json({
    success: true,
    data,
  });
}

export async function generateReport(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const adminUserId = req.userId;
  const reportType = (req.query.reportType as any) || 'revenue';

  const report = await adminInsightsService.getReportData({
    reportType,
    dateFrom: req.query.dateFrom as string | undefined,
    dateTo: req.query.dateTo as string | undefined,
    parkingLotId: req.query.parkingLotId as string | undefined,
    ownerId: req.query.ownerId as string | undefined,
    bookingStatus: req.query.bookingStatus as string | undefined,
    paymentStatus: req.query.paymentStatus as string | undefined,
    bookingType: req.query.bookingType as string | undefined,
    vehicleType: req.query.vehicleType as string | undefined,
    page: req.query.page as string | undefined,
    limit: req.query.limit as string | undefined,
  });

  // Log report generation in AuditLog
  if (adminUserId) {
    try {
      await (AuditLogModel as any).create({
        userId: adminUserId,
        actionCode: 'REPORT_GENERATED',
        actionTitle: `Generated ${report.reportType}`,
        module: 'Reports',
        description: `Administrator generated ${report.reportType} with ${report.pagination.total} records.`,
        metadata: {
          reportType,
          appliedFilters: report.appliedFilters,
          recordsCount: report.pagination.total,
        },
      });
    } catch (auditErr) {
      console.warn('Failed to record AuditLog for report generation:', auditErr);
    }
  }

  res.status(200).json({
    success: true,
    data: report,
  });
}

export async function exportReportCsv(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const adminUserId = req.userId;
  const reportType = (req.query.reportType as any) || 'revenue';

  const csvContent = await adminInsightsService.exportReportCsv({
    reportType,
    dateFrom: req.query.dateFrom as string | undefined,
    dateTo: req.query.dateTo as string | undefined,
    parkingLotId: req.query.parkingLotId as string | undefined,
    ownerId: req.query.ownerId as string | undefined,
    bookingStatus: req.query.bookingStatus as string | undefined,
    paymentStatus: req.query.paymentStatus as string | undefined,
    bookingType: req.query.bookingType as string | undefined,
    vehicleType: req.query.vehicleType as string | undefined,
  });

  if (adminUserId) {
    try {
      await (AuditLogModel as any).create({
        userId: adminUserId,
        actionCode: 'REPORT_EXPORTED',
        actionTitle: `Exported ${reportType} CSV`,
        module: 'Reports',
        description: `Administrator downloaded CSV export for ${reportType}.`,
        metadata: { reportType, filters: req.query },
      });
    } catch (auditErr) {
      console.warn('Failed to record AuditLog for report export:', auditErr);
    }
  }

  const filename = `parkease-${reportType}-report-${Date.now()}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csvContent);
}

export async function getInsightsFilterOptions(
  _req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const filterOptions = await adminInsightsService.getFilterOptions();
  res.status(200).json({
    success: true,
    data: filterOptions,
  });
}
