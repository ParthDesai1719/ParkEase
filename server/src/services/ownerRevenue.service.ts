import mongoose from 'mongoose';
import { PaymentModel, type Payment } from '../models/Payment.js';
import { BookingModel, type Booking } from '../models/Booking.js';
import { ParkingLotModel, type ParkingLot } from '../models/ParkingLot.js';
import { AppError } from '../utils/AppError.js';

export interface OwnerRevenueOverviewQuery {
  parkingLotId?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  rangePreset?: string | undefined;
}

export interface OwnerRevenueTransactionsQuery {
  parkingLotId?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  paymentStatus?: string | undefined;
  paymentType?: string | undefined;
  paymentMethod?: string | undefined;
  search?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export class OwnerRevenueService {
  /**
   * Helper: Resolve authorized parking lots belonging to authenticated owner
   */
  private async getAuthorizedLotIds(ownerId: string, requestedLotId?: string): Promise<{
    allOwnerLotIds: mongoose.Types.ObjectId[];
    targetLotIds: mongoose.Types.ObjectId[];
    ownerLots: Array<{ _id: string; parkingName: string; address: string }>;
  }> {
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      throw new AppError('Invalid owner identifier.', 401, 'INVALID_OWNER_ID');
    }

    const ownerLots = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .find({ ownerId: new mongoose.Types.ObjectId(ownerId) })
      .select('_id name parkingName address')
      .lean();

    const allOwnerLotIds = ownerLots.map((l) => new mongoose.Types.ObjectId(l._id.toString()));

    if (allOwnerLotIds.length === 0) {
      return { allOwnerLotIds: [], targetLotIds: [], ownerLots: [] };
    }

    let targetLotIds = allOwnerLotIds;
    if (requestedLotId && requestedLotId !== 'all') {
      if (!mongoose.Types.ObjectId.isValid(requestedLotId)) {
        throw new AppError('Invalid parking lot ID filter.', 400, 'INVALID_LOT_ID');
      }
      const match = allOwnerLotIds.some((id) => id.toString() === requestedLotId);
      if (!match) {
        throw new AppError('Forbidden: You do not own this parking lot.', 403, 'FORBIDDEN_LOT');
      }
      targetLotIds = [new mongoose.Types.ObjectId(requestedLotId)];
    }

    return {
      allOwnerLotIds,
      targetLotIds,
      ownerLots: ownerLots.map((l) => ({
        _id: l._id.toString(),
        parkingName: l.parkingName || (l as any).name || 'Unnamed Facility',
        address: l.address || '',
      })),
    };
  }

  /**
   * Helper: Build date filter object based on dateFrom, dateTo, or preset
   */
  private buildDateFilter(
    dateFrom?: string,
    dateTo?: string,
    rangePreset?: string,
  ): { $gte?: Date; $lte?: Date } | null {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    if (rangePreset) {
      if (rangePreset === 'today') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      } else if (rangePreset === 'this_week') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
        start = new Date(now.setDate(diff));
        start.setHours(0, 0, 0, 0);
        end = new Date();
      } else if (rangePreset === 'this_month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        end = new Date();
      } else if (rangePreset === 'this_year') {
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        end = new Date();
      }
    }

    if (dateFrom) {
      const parsed = new Date(dateFrom);
      if (!isNaN(parsed.getTime())) {
        start = parsed;
      }
    }

    if (dateTo) {
      const parsed = new Date(dateTo);
      if (!isNaN(parsed.getTime())) {
        end = parsed;
      }
    }

    if (!start && !end) return null;

    const filter: { $gte?: Date; $lte?: Date } = {};
    if (start) filter.$gte = start;
    if (end) filter.$lte = end;
    return filter;
  }

  /**
   * OWNER-01: Financial overview and revenue analytics
   */
  public async getOwnerRevenueOverview(ownerId: string, query: OwnerRevenueOverviewQuery) {
    const { targetLotIds, ownerLots } = await this.getAuthorizedLotIds(ownerId, query.parkingLotId);

    if (targetLotIds.length === 0) {
      return {
        ownerLots: [],
        kpis: {
          totalRevenue: 0,
          netRevenue: 0,
          successfulPaymentsCount: 0,
          pendingPaymentsCount: 0,
          pendingPaymentsAmount: 0,
          refundedAmount: 0,
          totalRefundsCount: 0,
          cancellationCount: 0,
          failedPaymentsCount: 0,
        },
        revenueOverTime: [],
        paymentStatusBreakdown: [],
        revenueByParkingLot: [],
        refundTrends: [],
        cancellationReasons: [],
        payoutInfo: {
          settlementCadence: 'Bi-monthly (1st and 15th)',
          payoutMethod: 'Direct Verified Bank Transfer',
          status: 'Recorded Platform Revenue',
          note: 'Recorded parking revenue is audited against verified gateway transaction receipts and settled according to your platform merchant agreement.',
        },
      };
    }

    const dateFilter = this.buildDateFilter(query.dateFrom, query.dateTo, query.rangePreset);

    // 1. Payment Aggregation
    const paymentMatch: Record<string, any> = {
      parkingLotId: { $in: targetLotIds },
      paymentTypeCode: { $in: ['BOOKING', 'EXTENSION', 'OVERSTAY'] }, // Parking revenue only
    };

    if (dateFilter) {
      paymentMatch.createdAt = dateFilter;
    }

    const payments = await (PaymentModel as mongoose.Model<Payment>)
      .find(paymentMatch)
      .select('amount paymentStatus paymentTypeCode paymentMethod refund createdAt parkingLotId')
      .lean();

    let totalRevenue = 0;
    let successfulPaymentsCount = 0;
    let pendingPaymentsCount = 0;
    let pendingPaymentsAmount = 0;
    let failedPaymentsCount = 0;
    let refundedAmount = 0;
    let totalRefundsCount = 0;

    const statusCounts: Record<string, { count: number; amount: number }> = {
      SUCCESSFUL: { count: 0, amount: 0 },
      PENDING: { count: 0, amount: 0 },
      FAILED: { count: 0, amount: 0 },
      REFUNDED: { count: 0, amount: 0 },
    };

    const lotRevenueMap = new Map<string, { parkingName: string; revenue: number; transactions: number }>();
    for (const lot of ownerLots) {
      if (targetLotIds.some((id) => id.toString() === lot._id)) {
        lotRevenueMap.set(lot._id, { parkingName: lot.parkingName, revenue: 0, transactions: 0 });
      }
    }

    const dateTrendMap = new Map<string, { revenue: number; refunds: number; transactions: number }>();

    for (const p of payments) {
      const dateKey = p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : 'Unknown';

      if (!dateTrendMap.has(dateKey)) {
        dateTrendMap.set(dateKey, { revenue: 0, refunds: 0, transactions: 0 });
      }
      const trend = dateTrendMap.get(dateKey)!;
      trend.transactions += 1;

      const pStatus = p.paymentStatus || 'PENDING';
      if (!statusCounts[pStatus]) {
        statusCounts[pStatus] = { count: 0, amount: 0 };
      }
      statusCounts[pStatus].count += 1;
      statusCounts[pStatus].amount += p.amount || 0;

      if (pStatus === 'SUCCESSFUL') {
        totalRevenue += p.amount || 0;
        successfulPaymentsCount += 1;
        trend.revenue += p.amount || 0;

        const lotIdStr = p.parkingLotId?.toString();
        if (lotIdStr && lotRevenueMap.has(lotIdStr)) {
          const lEntry = lotRevenueMap.get(lotIdStr)!;
          lEntry.revenue += p.amount || 0;
          lEntry.transactions += 1;
        }
      } else if (pStatus === 'PENDING') {
        pendingPaymentsCount += 1;
        pendingPaymentsAmount += p.amount || 0;
      } else if (pStatus === 'FAILED') {
        failedPaymentsCount += 1;
      }

      // Check for refunds
      const refAmt = (p as any).refundAmount || (p as any).refunds?.[0]?.refundAmount || 0;
      if (pStatus === 'REFUNDED' || refAmt > 0) {
        const actualRefund = refAmt > 0 ? refAmt : p.amount || 0;
        refundedAmount += actualRefund;
        totalRefundsCount += 1;
        trend.refunds += actualRefund;
      }
    }

    const netRevenue = Math.max(0, totalRevenue - refundedAmount);

    // 2. Cancellation and refund reasons from BookingModel
    const bookingMatch: Record<string, any> = {
      parkingLotId: { $in: targetLotIds },
    };
    if (dateFilter) {
      bookingMatch.createdAt = dateFilter;
    }

    const bookings = await (BookingModel as any)
      .find(bookingMatch)
      .select('bookingStatus cancellationReason totalAmount createdAt')
      .lean();

    let cancellationCount = 0;
    const reasonCounts: Record<string, number> = {};

    for (const b of bookings) {
      if (b.bookingStatus === 'Cancelled') {
        cancellationCount += 1;
        const reason = (b as any).cancellationReason || 'Customer Cancelled';
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      }
    }

    // Sort trends chronologically
    const sortedDates = Array.from(dateTrendMap.keys()).sort();
    const revenueOverTime = sortedDates.map((date) => ({
      date,
      revenue: dateTrendMap.get(date)!.revenue,
      refunds: dateTrendMap.get(date)!.refunds,
      transactions: dateTrendMap.get(date)!.transactions,
    }));

    const paymentStatusBreakdown = Object.entries(statusCounts).map(([status, val]) => ({
      status,
      count: val.count,
      amount: val.amount,
    }));

    const revenueByParkingLot = Array.from(lotRevenueMap.entries()).map(([lotId, val]) => ({
      lotId,
      parkingName: val.parkingName,
      revenue: val.revenue,
      transactions: val.transactions,
    }));

    const cancellationReasons = Object.entries(reasonCounts).map(([reason, count]) => ({
      reason,
      count,
    }));

    return {
      ownerLots,
      kpis: {
        totalRevenue,
        netRevenue,
        successfulPaymentsCount,
        pendingPaymentsCount,
        pendingPaymentsAmount,
        refundedAmount,
        totalRefundsCount,
        cancellationCount,
        failedPaymentsCount,
      },
      revenueOverTime,
      paymentStatusBreakdown,
      revenueByParkingLot,
      cancellationReasons,
      payoutInfo: {
        settlementCadence: 'Bi-monthly (1st and 15th)',
        payoutMethod: 'Direct Verified Bank Transfer',
        status: 'Audited Platform Revenue',
        note: 'Live parking revenue reflects customer transactions verified through Razorpay or cash barrier reconciliation. Payouts are executed via direct bank wire per your facility agreement.',
      },
    };
  }

  /**
   * OWNER-01: Paginated transaction breakdown for financial audit and export
   */
  public async getOwnerRevenueTransactions(ownerId: string, query: OwnerRevenueTransactionsQuery) {
    const { targetLotIds, ownerLots } = await this.getAuthorizedLotIds(ownerId, query.parkingLotId);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 15));
    const skip = (page - 1) * limit;

    if (targetLotIds.length === 0) {
      return {
        transactions: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
        ownerLots,
      };
    }

    const filter: Record<string, any> = {
      parkingLotId: { $in: targetLotIds },
      paymentTypeCode: { $in: ['BOOKING', 'EXTENSION', 'OVERSTAY'] },
    };

    if (query.paymentStatus && query.paymentStatus !== 'all') {
      filter.paymentStatus = query.paymentStatus;
    }

    if (query.paymentType && query.paymentType !== 'all') {
      filter.paymentTypeCode = query.paymentType;
    }

    if (query.paymentMethod && query.paymentMethod !== 'all') {
      filter.paymentMethod = query.paymentMethod;
    }

    const dateFilter = this.buildDateFilter(query.dateFrom, query.dateTo);
    if (dateFilter) {
      filter.createdAt = dateFilter;
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      const regex = new RegExp(term, 'i');
      filter.$or = [
        { paymentReference: regex },
        { transactionId: regex },
        { gatewayPaymentId: regex },
      ];
    }

    const [transactions, total] = await Promise.all([
      (PaymentModel as any)
        .find(filter)
        .populate('bookingId', 'bookingReference bookingStatus scheduledEntryTime scheduledExitTime')
        .populate('customerId', 'fullName email mobileNumber')
        .populate('parkingLotId', 'parkingName address city')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      (PaymentModel as any).countDocuments(filter),
    ]);

    return {
      transactions: transactions.map((t: any) => ({
        _id: t._id.toString(),
        paymentReference: t.paymentReference,
        bookingReference: t.bookingId?.bookingReference || 'N/A',
        bookingId: t.bookingId?._id?.toString() || null,
        customerName: t.customerId?.fullName || 'Walk-In Customer',
        customerEmail: t.customerId?.email || null,
        customerPhone: t.customerId?.mobileNumber || null,
        parkingLotName: t.parkingLotId?.parkingName || 'Facility',
        parkingLotAddress: t.parkingLotId?.address || '',
        paymentType: t.paymentType,
        paymentTypeCode: t.paymentTypeCode,
        paymentMethod: t.paymentMethod,
        amount: t.amount,
        paymentStatus: t.paymentStatus,
        transactionId: t.transactionId || t.gatewayPaymentId || null,
        refundAmount: t.refund?.refundAmount || (t.paymentStatus === 'REFUNDED' ? t.amount : 0),
        refundStatus: t.refund?.refundStatus || (t.paymentStatus === 'REFUNDED' ? 'Refund Completed' : null),
        refundReason: t.refund?.refundReason || null,
        createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      ownerLots,
    };
  }
}

export const ownerRevenueService = new OwnerRevenueService();
