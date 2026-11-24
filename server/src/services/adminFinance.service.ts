import mongoose from 'mongoose';
import { PaymentModel, type Payment } from '../models/Payment.js';
import { BookingModel, type Booking } from '../models/Booking.js';
import { ParkingLotModel } from '../models/ParkingLot.js';
import { UserModel } from '../models/User.js';
import { VehicleModel } from '../models/Vehicle.js';
import { BookingTimelineModel } from '../models/BookingTimeline.js';
import { AppError } from '../utils/AppError.js';

export interface AdminFinanceOverviewQueryParams {
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  parkingLotId?: string | undefined;
  ownerId?: string | undefined;
  paymentType?: string | undefined;
  paymentMethod?: string | undefined;
}

export interface AdminFinanceOverview {
  totalRevenue: number;
  netRevenue: number;
  totalRefunded: number;
  platformFeesCollected: number;
  totalTransactions: number;
  successfulTransactions: number;
  refundedTransactions: number;
  pendingTransactions: number;
  failedTransactions: number;
  cashReversalPendingTransactions: number;
  successRatePercentage: number;
  paymentMethods: {
    razorpay: { count: number; amount: number; percentage: number };
    cash: { count: number; amount: number; percentage: number };
  };
  paymentTypes: {
    booking: { count: number; amount: number };
    extension: { count: number; amount: number };
    overstay: { count: number; amount: number };
    ownerRegistration: { count: number; amount: number };
  };
  paymentStatusDistribution: Array<{
    status: string;
    label: string;
    count: number;
    amount: number;
    percentage: number;
  }>;
  refundStatusDistribution: Array<{
    status: string;
    count: number;
    amount: number;
    percentage: number;
  }>;
  revenueTrend: Array<{
    date: string;
    revenue: number;
    refunds: number;
    platformFee: number;
    transactionsCount: number;
  }>;
}

export interface AdminPaymentQueryParams {
  search?: string | undefined;
  status?: string | undefined;
  paymentType?: string | undefined;
  paymentMethod?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  parkingLotId?: string | undefined;
  ownerId?: string | undefined;
  sortBy?: string | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface AdminPaymentListItem {
  _id: string;
  paymentReference: string;
  transactionId?: string | null | undefined;
  gatewayPaymentId?: string | null | undefined;
  gatewayOrderId?: string | null | undefined;
  paymentType: string;
  paymentTypeCode: 'BOOKING' | 'EXTENSION' | 'OVERSTAY' | 'OWNER_REGISTRATION';
  paymentMethod: 'RAZORPAY' | 'CASH';
  paymentStatus: 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'REFUNDED' | 'CASH_REVERSAL_PENDING';
  refundWorkflowState?: 'Refund Pending' | 'Refund Processing' | 'Refund Completed' | 'Refund Failed' | null | undefined;
  amount: number;
  platformBookingFee: number;
  additionalCharges: number;
  refundAmount: number;
  refundsCount: number;
  paymentDate?: string | null | undefined;
  createdAt: string;
  customer?: {
    _id: string;
    fullName: string;
    email: string;
    mobileNumber?: string | undefined;
  } | null | undefined;
  owner?: {
    _id: string;
    fullName: string;
    email: string;
    mobileNumber?: string | undefined;
  } | null | undefined;
  parkingLot?: {
    _id: string;
    parkingName: string;
    address?: string | undefined;
    city?: string | undefined;
  } | null | undefined;
  booking?: {
    _id: string;
    bookingReference: string;
    bookingStatus: string;
    vehiclePlate?: string | undefined;
  } | null | undefined;
  ownerApplication?: {
    _id: string;
    applicationReference: string;
    businessName: string;
    businessType?: string | undefined;
  } | null | undefined;
}

export interface AdminPaymentDetailData extends AdminPaymentListItem {
  gatewaySignatureProvided: boolean;
  remarks?: string | null | undefined;
  refunds: Array<{
    refundReference: string;
    refundAmount: number;
    refundStatus: 'Refund Pending' | 'Refund Processing' | 'Refund Completed' | 'Refund Failed';
    refundReason: string;
    gatewayRefundId?: string | null | undefined;
    refundTransactionId?: string | null | undefined;
    initiatedAt: string;
    completedAt?: string | null | undefined;
    initiatedBy?: {
      _id: string;
      fullName: string;
      email: string;
    } | null | undefined;
    remarks?: string | null | undefined;
  }>;
  bookingDetails?: {
    bookingReference: string;
    bookingStatus: string;
    scheduledEntryTime: string;
    scheduledExitTime: string;
    actualEntryTime?: string | null | undefined;
    actualExitTime?: string | null | undefined;
    vehicle?: {
      plateNumber: string;
      model?: string | undefined;
      vehicleType?: string | undefined;
    } | null | undefined;
    parkingSlot?: {
      slotNumber: string;
      slotLabel?: string | undefined;
    } | null | undefined;
  } | null | undefined;
  bookingTimeline?: Array<{
    eventCode: string;
    eventType: string;
    eventDescription: string;
    eventTime: string;
    eventSource: string;
  }> | undefined;
}

export class AdminFinanceService {
  /**
   * Builds Mongoose match filter based on finance query parameters.
   */
  private buildMatchFilter(params: AdminFinanceOverviewQueryParams): Record<string, any> {
    const filter: Record<string, any> = {};

    if (params.parkingLotId && mongoose.isValidObjectId(params.parkingLotId)) {
      filter.parkingLotId = new mongoose.Types.ObjectId(params.parkingLotId);
    }

    if (params.ownerId && mongoose.isValidObjectId(params.ownerId)) {
      filter.ownerId = new mongoose.Types.ObjectId(params.ownerId);
    }

    if (params.paymentType && params.paymentType !== 'ALL') {
      filter.paymentTypeCode = params.paymentType;
    }

    if (params.paymentMethod && params.paymentMethod !== 'ALL') {
      filter.paymentMethod = params.paymentMethod;
    }

    if (params.dateFrom || params.dateTo) {
      filter.createdAt = {};
      if (params.dateFrom) {
        const from = new Date(params.dateFrom);
        from.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = from;
      }
      if (params.dateTo) {
        const to = new Date(params.dateTo);
        to.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }

    return filter;
  }

  /**
   * 1. Get Financial Overview & Aggregated Chart Data
   */
  public async getFinanceOverview(params: AdminFinanceOverviewQueryParams): Promise<AdminFinanceOverview> {
    const matchFilter = this.buildMatchFilter(params);

    // Parallel Aggregations: Status metrics, Payment Methods, Payment Types, and Time-series Trend
    const [statusSummary, methodSummary, typeSummary, refundStatusSummary, timeSeriesTrend] = await Promise.all([
      // Status breakdown
      (PaymentModel as mongoose.Model<Payment>).aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: '$paymentStatus',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalRefundAmount: { $sum: '$refundAmount' },
            totalPlatformFee: { $sum: '$platformBookingFee' },
          },
        },
      ]),

      // Method breakdown
      (PaymentModel as mongoose.Model<Payment>).aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: '$paymentMethod',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
          },
        },
      ]),

      // Type breakdown
      (PaymentModel as mongoose.Model<Payment>).aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: '$paymentTypeCode',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
          },
        },
      ]),

      // Unwind refunds to compute real refund workflow state distribution
      (PaymentModel as mongoose.Model<Payment>).aggregate([
        { $match: matchFilter },
        { $unwind: '$refunds' },
        {
          $group: {
            _id: '$refunds.refundStatus',
            count: { $sum: 1 },
            totalRefundAmount: { $sum: '$refunds.refundAmount' },
          },
        },
      ]),

      // Daily trend for the last 30 days (or date range)
      (PaymentModel as mongoose.Model<Payment>).aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            revenue: {
              $sum: {
                $cond: [{ $in: ['$paymentStatus', ['SUCCESSFUL', 'REFUNDED']] }, '$amount', 0],
              },
            },
            refunds: { $sum: '$refundAmount' },
            platformFee: { $sum: '$platformBookingFee' },
            transactionsCount: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Parse status metrics
    let totalTransactions = 0;
    let successfulTransactions = 0;
    let refundedTransactions = 0;
    let pendingTransactions = 0;
    let failedTransactions = 0;
    let cashReversalPendingTransactions = 0;

    let totalRevenue = 0;
    let totalRefunded = 0;
    let platformFeesCollected = 0;

    const statusCountsMap: Record<string, { count: number; amount: number }> = {};

    for (const item of statusSummary) {
      const status = item._id as string;
      const count = item.count as number;
      const amount = item.totalAmount as number;

      totalTransactions += count;
      statusCountsMap[status] = { count, amount };

      if (status === 'SUCCESSFUL') {
        successfulTransactions += count;
        totalRevenue += amount;
        platformFeesCollected += item.totalPlatformFee || 0;
      } else if (status === 'REFUNDED') {
        refundedTransactions += count;
        totalRevenue += amount; // Gross includes originally successful refunded
        totalRefunded += item.totalRefundAmount || amount;
        platformFeesCollected += item.totalPlatformFee || 0;
      } else if (status === 'PENDING') {
        pendingTransactions += count;
      } else if (status === 'FAILED') {
        failedTransactions += count;
      } else if (status === 'CASH_REVERSAL_PENDING') {
        cashReversalPendingTransactions += count;
        totalRefunded += item.totalRefundAmount || 0;
      }
    }

    const netRevenue = Math.max(0, totalRevenue - totalRefunded);
    const successRatePercentage =
      totalTransactions > 0
        ? Number((((successfulTransactions + refundedTransactions) / totalTransactions) * 100).toFixed(1))
        : 0;

    // Payment methods map
    let razorpayCount = 0;
    let razorpayAmount = 0;
    let cashCount = 0;
    let cashAmount = 0;

    for (const item of methodSummary) {
      if (item._id === 'RAZORPAY') {
        razorpayCount = item.count;
        razorpayAmount = item.totalAmount;
      } else if (item._id === 'CASH') {
        cashCount = item.count;
        cashAmount = item.totalAmount;
      }
    }

    const methodsTotalAmount = razorpayAmount + cashAmount;
    const paymentMethods = {
      razorpay: {
        count: razorpayCount,
        amount: razorpayAmount,
        percentage: methodsTotalAmount > 0 ? Number(((razorpayAmount / methodsTotalAmount) * 100).toFixed(1)) : 0,
      },
      cash: {
        count: cashCount,
        amount: cashAmount,
        percentage: methodsTotalAmount > 0 ? Number(((cashAmount / methodsTotalAmount) * 100).toFixed(1)) : 0,
      },
    };

    // Payment types map
    const paymentTypes = {
      booking: { count: 0, amount: 0 },
      extension: { count: 0, amount: 0 },
      overstay: { count: 0, amount: 0 },
      ownerRegistration: { count: 0, amount: 0 },
    };

    for (const item of typeSummary) {
      if (item._id === 'BOOKING') {
        paymentTypes.booking = { count: item.count, amount: item.totalAmount };
      } else if (item._id === 'EXTENSION') {
        paymentTypes.extension = { count: item.count, amount: item.totalAmount };
      } else if (item._id === 'OVERSTAY') {
        paymentTypes.overstay = { count: item.count, amount: item.totalAmount };
      } else if (item._id === 'OWNER_REGISTRATION') {
        paymentTypes.ownerRegistration = { count: item.count, amount: item.totalAmount };
      }
    }

    // Payment status distribution
    const canonicalStatuses = [
      { status: 'SUCCESSFUL', label: 'Successful' },
      { status: 'PENDING', label: 'Pending' },
      { status: 'REFUNDED', label: 'Refunded' },
      { status: 'CASH_REVERSAL_PENDING', label: 'Cash Reversal Pending' },
      { status: 'FAILED', label: 'Failed' },
    ];

    const paymentStatusDistribution = canonicalStatuses.map(({ status, label }) => {
      const entry = statusCountsMap[status] || { count: 0, amount: 0 };
      return {
        status,
        label,
        count: entry.count,
        amount: entry.amount,
        percentage: totalTransactions > 0 ? Number(((entry.count / totalTransactions) * 100).toFixed(1)) : 0,
      };
    });

    // Refund workflow distribution
    const canonicalRefundStates = ['Refund Pending', 'Refund Processing', 'Refund Completed', 'Refund Failed'];
    const refundMap: Record<string, { count: number; amount: number }> = {};
    let totalRefundInstances = 0;

    for (const item of refundStatusSummary) {
      const st = item._id as string;
      refundMap[st] = { count: item.count, amount: item.totalRefundAmount };
      totalRefundInstances += item.count;
    }

    const refundStatusDistribution = canonicalRefundStates.map((status) => {
      const entry = refundMap[status] || { count: 0, amount: 0 };
      return {
        status,
        count: entry.count,
        amount: entry.amount,
        percentage:
          totalRefundInstances > 0 ? Number(((entry.count / totalRefundInstances) * 100).toFixed(1)) : 0,
      };
    });

    // Time-series trend formatting
    const revenueTrend = timeSeriesTrend.map((item) => ({
      date: item._id as string,
      revenue: item.revenue || 0,
      refunds: item.refunds || 0,
      platformFee: item.platformFee || 0,
      transactionsCount: item.transactionsCount || 0,
    }));

    return {
      totalRevenue,
      netRevenue,
      totalRefunded,
      platformFeesCollected,
      totalTransactions,
      successfulTransactions,
      refundedTransactions,
      pendingTransactions,
      failedTransactions,
      cashReversalPendingTransactions,
      successRatePercentage,
      paymentMethods,
      paymentTypes,
      paymentStatusDistribution,
      refundStatusDistribution,
      revenueTrend,
    };
  }

  /**
   * 2. Query Payments Directory with Multi-Criteria Filters, Search, and Pagination
   */
  public async getPayments(params: AdminPaymentQueryParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    // Specific filters
    if (params.status && params.status !== 'ALL') {
      filter.paymentStatus = params.status;
    }

    if (params.paymentType && params.paymentType !== 'ALL') {
      filter.paymentTypeCode = params.paymentType;
    }

    if (params.paymentMethod && params.paymentMethod !== 'ALL') {
      filter.paymentMethod = params.paymentMethod;
    }

    if (params.parkingLotId && mongoose.isValidObjectId(params.parkingLotId)) {
      filter.parkingLotId = new mongoose.Types.ObjectId(params.parkingLotId);
    }

    if (params.ownerId && mongoose.isValidObjectId(params.ownerId)) {
      filter.ownerId = new mongoose.Types.ObjectId(params.ownerId);
    }

    if (params.dateFrom || params.dateTo) {
      filter.createdAt = {};
      if (params.dateFrom) {
        const from = new Date(params.dateFrom);
        from.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = from;
      }
      if (params.dateTo) {
        const to = new Date(params.dateTo);
        to.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }

    // Free text search matching transaction ID, payment reference, gateway IDs, customer, or booking
    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      const regex = new RegExp(q, 'i');

      // Resolve matching customer or owner user IDs
      const matchingUsers = await (UserModel as any).find({
        $or: [{ fullName: regex }, { email: regex }, { mobileNumber: regex }],
      }).select('_id');
      const userIds = matchingUsers.map((u: any) => u._id);

      // Resolve matching vehicles
      const matchingVehicles = await (VehicleModel as any).find({ vehicleNumber: regex }).select('_id');
      const vehicleIds = matchingVehicles.map((v: any) => v._id);

      // Resolve matching booking IDs
      const matchingBookings = await (BookingModel as any).find({
        $or: [
          { bookingReference: regex },
          ...(vehicleIds.length > 0 ? [{ vehicleId: { $in: vehicleIds } }] : []),
        ],
      }).select('_id');
      const bookingIds = matchingBookings.map((b: any) => b._id);

      // Resolve matching owner applications
      const matchingApps = await mongoose.model('OwnerApplication').find({
        $or: [{ applicationReference: regex }, { businessName: regex }],
      }).select('_id');
      const appIds = matchingApps.map((a: any) => a._id);

      filter.$or = [
        { paymentReference: regex },
        { transactionId: regex },
        { gatewayPaymentId: regex },
        { gatewayOrderId: regex },
        ...(userIds.length > 0 ? [{ customerId: { $in: userIds } }, { ownerId: { $in: userIds } }] : []),
        ...(bookingIds.length > 0 ? [{ bookingId: { $in: bookingIds } }] : []),
        ...(appIds.length > 0 ? [{ ownerApplicationId: { $in: appIds } }] : []),
      ];
    }

    // Sort order
    const sortBy = params.sortBy === 'amount' ? 'amount' : params.sortBy === 'paymentDate' ? 'paymentDate' : 'createdAt';
    const sortOrder: 1 | -1 = params.sortOrder === 'asc' ? 1 : -1;
    const sortObj: Record<string, 1 | -1> = { [sortBy]: sortOrder };

    const [payments, total] = await Promise.all([
      (PaymentModel as mongoose.Model<Payment>)
        .find(filter)
        .populate<{ customerId: { _id: mongoose.Types.ObjectId; fullName: string; email: string; mobileNumber?: string } }>('customerId', 'fullName email mobileNumber')
        .populate<{ ownerId: { _id: mongoose.Types.ObjectId; fullName: string; email: string; mobileNumber?: string } }>('ownerId', 'fullName email mobileNumber')
        .populate<{ parkingLotId: { _id: mongoose.Types.ObjectId; parkingName: string; address?: string; city?: string } }>('parkingLotId', 'parkingName address city')
        .populate<{ bookingId: { _id: mongoose.Types.ObjectId; bookingReference: string; bookingStatus: string; vehicleId?: mongoose.Types.ObjectId } }>('bookingId', 'bookingReference bookingStatus vehicleId')
        .populate<{ ownerApplicationId: { _id: mongoose.Types.ObjectId; applicationReference: string; businessName: string; businessType?: string } }>('ownerApplicationId', 'applicationReference businessName businessType')
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean(),
      PaymentModel.countDocuments(filter),
    ]);

    // Format list items and resolve refund workflow states
    const items: AdminPaymentListItem[] = [];

    for (const p of payments) {
      // Determine refund workflow state
      let refundWorkflowState: 'Refund Pending' | 'Refund Processing' | 'Refund Completed' | 'Refund Failed' | null = null;
      if (p.refunds && p.refunds.length > 0) {
        const latestRefund = p.refunds[p.refunds.length - 1];
        if (latestRefund?.refundStatus) {
          refundWorkflowState = latestRefund.refundStatus as any;
        }
      } else if (p.paymentStatus === 'REFUNDED') {
        refundWorkflowState = 'Refund Completed';
      } else if (p.paymentStatus === 'CASH_REVERSAL_PENDING') {
        refundWorkflowState = 'Refund Pending';
      }

      // Resolve vehicle plate if booking exists
      let vehiclePlate: string | undefined;
      if (p.bookingId?.vehicleId) {
        const veh = (await (VehicleModel as any).findById(p.bookingId.vehicleId).select('vehicleNumber').lean()) as any;
        if (veh?.vehicleNumber) {
          vehiclePlate = veh.vehicleNumber;
        }
      }

      items.push({
        _id: String(p._id),
        paymentReference: p.paymentReference,
        transactionId: p.transactionId || null,
        gatewayPaymentId: p.gatewayPaymentId || null,
        gatewayOrderId: p.gatewayOrderId || null,
        paymentType: p.paymentType,
        paymentTypeCode: p.paymentTypeCode as any,
        paymentMethod: p.paymentMethod,
        paymentStatus: p.paymentStatus,
        refundWorkflowState,
        amount: p.amount,
        platformBookingFee: p.platformBookingFee || 0,
        additionalCharges: p.additionalCharges || 0,
        refundAmount: p.refundAmount || 0,
        refundsCount: p.refunds?.length || 0,
        paymentDate: p.paymentDate ? p.paymentDate.toISOString() : null,
        createdAt: p.createdAt ? p.createdAt.toISOString() : new Date().toISOString(),
        customer: p.customerId
          ? {
              _id: String(p.customerId._id),
              fullName: p.customerId.fullName,
              email: p.customerId.email,
              mobileNumber: p.customerId.mobileNumber,
            }
          : null,
        owner: p.ownerId
          ? {
              _id: String(p.ownerId._id),
              fullName: p.ownerId.fullName,
              email: p.ownerId.email,
              mobileNumber: p.ownerId.mobileNumber,
            }
          : null,
        parkingLot: p.parkingLotId
          ? {
              _id: String(p.parkingLotId._id),
              parkingName: p.parkingLotId.parkingName,
              address: p.parkingLotId.address,
              city: p.parkingLotId.city,
            }
          : null,
        booking: p.bookingId
          ? {
              _id: String(p.bookingId._id),
              bookingReference: p.bookingId.bookingReference,
              bookingStatus: p.bookingId.bookingStatus,
              vehiclePlate,
            }
          : null,
        ownerApplication: p.ownerApplicationId
          ? {
              _id: String(p.ownerApplicationId._id),
              applicationReference: p.ownerApplicationId.applicationReference,
              businessName: p.ownerApplicationId.businessName,
              businessType: p.ownerApplicationId.businessType,
            }
          : null,
      });
    }

    return {
      payments: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * 3. Get Payment Details Dossier
   */
  public async getPaymentById(id: string): Promise<AdminPaymentDetailData> {
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError('Invalid Payment ID format.', 400, 'INVALID_PAYMENT_ID');
    }

    const p = await (PaymentModel as mongoose.Model<Payment>)
      .findById(id)
      .populate<{ customerId: { _id: mongoose.Types.ObjectId; fullName: string; email: string; mobileNumber?: string } }>('customerId', 'fullName email mobileNumber')
      .populate<{ ownerId: { _id: mongoose.Types.ObjectId; fullName: string; email: string; mobileNumber?: string } }>('ownerId', 'fullName email mobileNumber')
      .populate<{ parkingLotId: { _id: mongoose.Types.ObjectId; parkingName: string; address?: string; city?: string } }>('parkingLotId', 'parkingName address city')
      .populate<{ bookingId: { _id: mongoose.Types.ObjectId; bookingReference: string; bookingStatus: string; scheduledEntryTime: Date; scheduledExitTime: Date; actualEntryTime?: Date; actualExitTime?: Date; vehicleId?: mongoose.Types.ObjectId; currentSlotId?: mongoose.Types.ObjectId } }>('bookingId')
      .populate<{ ownerApplicationId: { _id: mongoose.Types.ObjectId; applicationReference: string; businessName: string; businessType?: string } }>('ownerApplicationId', 'applicationReference businessName businessType')
      .populate('refunds.initiatedBy', 'fullName email')
      .lean();

    if (!p) {
      throw new AppError('Payment transaction record not found.', 404, 'PAYMENT_NOT_FOUND');
    }

    // Determine refund workflow state
    let refundWorkflowState: 'Refund Pending' | 'Refund Processing' | 'Refund Completed' | 'Refund Failed' | null = null;
    if (p.refunds && p.refunds.length > 0) {
      const latestRefund = p.refunds[p.refunds.length - 1];
      if (latestRefund?.refundStatus) {
        refundWorkflowState = latestRefund.refundStatus as any;
      }
    } else if (p.paymentStatus === 'REFUNDED') {
      refundWorkflowState = 'Refund Completed';
    } else if (p.paymentStatus === 'CASH_REVERSAL_PENDING') {
      refundWorkflowState = 'Refund Pending';
    }

    // Booking Details if present
    let bookingDetails: AdminPaymentDetailData['bookingDetails'] = null;
    let bookingTimeline: AdminPaymentDetailData['bookingTimeline'] = [];

    if (p.bookingId) {
      let vehiclePlate = 'N/A';
      let vehicleModelName: string | undefined;
      let vehicleType: string | undefined;
      let slotNumber = 'N/A';
      let slotLabel: string | undefined;

      if (p.bookingId.vehicleId) {
        const veh = (await (VehicleModel as any).findById(p.bookingId.vehicleId).lean()) as any;
        if (veh) {
          vehiclePlate = veh.vehicleNumber;
          vehicleModelName = [veh.vehicleBrand, veh.vehicleModel].filter(Boolean).join(' ') || undefined;
          vehicleType = veh.vehicleType;
        }
      }

      if (p.bookingId.currentSlotId) {
        const slot = (await mongoose.model('ParkingSlot').findById(p.bookingId.currentSlotId).lean()) as { slotNumber?: string; slotLabel?: string } | null;
        if (slot?.slotNumber) {
          slotNumber = slot.slotNumber;
          slotLabel = slot.slotLabel;
        }
      }

      bookingDetails = {
        bookingReference: p.bookingId.bookingReference,
        bookingStatus: p.bookingId.bookingStatus,
        scheduledEntryTime: p.bookingId.scheduledEntryTime.toISOString(),
        scheduledExitTime: p.bookingId.scheduledExitTime.toISOString(),
        actualEntryTime: p.bookingId.actualEntryTime ? p.bookingId.actualEntryTime.toISOString() : null,
        actualExitTime: p.bookingId.actualExitTime ? p.bookingId.actualExitTime.toISOString() : null,
        vehicle: {
          plateNumber: vehiclePlate,
          model: vehicleModelName,
          vehicleType,
        },
        parkingSlot: {
          slotNumber,
          slotLabel,
        },
      };

      // Retrieve timeline
      const timelineDocs = await (BookingTimelineModel as any).find({ bookingId: p.bookingId._id })
        .sort({ eventTime: -1 })
        .lean();

      bookingTimeline = timelineDocs.map((t: any) => ({
        eventCode: t.eventCode,
        eventType: t.eventType,
        eventDescription: t.eventDescription,
        eventTime: t.eventTime ? t.eventTime.toISOString() : new Date().toISOString(),
        eventSource: t.eventSource || 'System',
      }));
    }

    // Format refunds
    const refundsFormatted = (p.refunds || []).map((r) => ({
      refundReference: r.refundReference,
      refundAmount: r.refundAmount,
      refundStatus: r.refundStatus,
      refundReason: r.refundReason,
      gatewayRefundId: r.gatewayRefundId || null,
      refundTransactionId: r.refundTransactionId || null,
      initiatedAt: r.initiatedAt ? r.initiatedAt.toISOString() : new Date().toISOString(),
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      initiatedBy: r.initiatedBy
        ? {
            _id: String((r.initiatedBy as any)._id),
            fullName: (r.initiatedBy as any).fullName || 'Staff / System',
            email: (r.initiatedBy as any).email || 'system@parkease.test',
          }
        : null,
      remarks: r.remarks || null,
    }));

    return {
      _id: String(p._id),
      paymentReference: p.paymentReference,
      transactionId: p.transactionId || null,
      gatewayPaymentId: p.gatewayPaymentId || null,
      gatewayOrderId: p.gatewayOrderId || null,
      gatewaySignatureProvided: Boolean(p.gatewaySignature),
      paymentType: p.paymentType,
      paymentTypeCode: p.paymentTypeCode as any,
      paymentMethod: p.paymentMethod,
      paymentStatus: p.paymentStatus,
      refundWorkflowState,
      amount: p.amount,
      platformBookingFee: p.platformBookingFee || 0,
      additionalCharges: p.additionalCharges || 0,
      refundAmount: p.refundAmount || 0,
      refundsCount: p.refunds?.length || 0,
      paymentDate: p.paymentDate ? p.paymentDate.toISOString() : null,
      createdAt: p.createdAt ? p.createdAt.toISOString() : new Date().toISOString(),
      remarks: p.remarks || null,
      customer: p.customerId
        ? {
            _id: String(p.customerId._id),
            fullName: p.customerId.fullName,
            email: p.customerId.email,
            mobileNumber: p.customerId.mobileNumber,
          }
        : null,
      owner: p.ownerId
        ? {
            _id: String(p.ownerId._id),
            fullName: p.ownerId.fullName,
            email: p.ownerId.email,
            mobileNumber: p.ownerId.mobileNumber,
          }
        : null,
      parkingLot: p.parkingLotId
        ? {
            _id: String(p.parkingLotId._id),
            parkingName: p.parkingLotId.parkingName,
            address: p.parkingLotId.address,
            city: p.parkingLotId.city,
          }
        : null,
      booking: p.bookingId
        ? {
            _id: String(p.bookingId._id),
            bookingReference: p.bookingId.bookingReference,
            bookingStatus: p.bookingId.bookingStatus,
            vehiclePlate: bookingDetails?.vehicle?.plateNumber,
          }
        : null,
      ownerApplication: p.ownerApplicationId
        ? {
            _id: String(p.ownerApplicationId._id),
            applicationReference: p.ownerApplicationId.applicationReference,
            businessName: p.ownerApplicationId.businessName,
            businessType: p.ownerApplicationId.businessType,
          }
        : null,
      refunds: refundsFormatted,
      bookingDetails,
      bookingTimeline,
    };
  }

  /**
   * 4. Export Filtered Transactions to CSV
   */
  public async exportPaymentsCsv(params: AdminPaymentQueryParams): Promise<string> {
    // Reuse filter logic without pagination limit (capped at safe export volume of 5000)
    const filter: Record<string, any> = {};

    if (params.status && params.status !== 'ALL') {
      filter.paymentStatus = params.status;
    }

    if (params.paymentType && params.paymentType !== 'ALL') {
      filter.paymentTypeCode = params.paymentType;
    }

    if (params.paymentMethod && params.paymentMethod !== 'ALL') {
      filter.paymentMethod = params.paymentMethod;
    }

    if (params.parkingLotId && mongoose.isValidObjectId(params.parkingLotId)) {
      filter.parkingLotId = new mongoose.Types.ObjectId(params.parkingLotId);
    }

    if (params.ownerId && mongoose.isValidObjectId(params.ownerId)) {
      filter.ownerId = new mongoose.Types.ObjectId(params.ownerId);
    }

    if (params.dateFrom || params.dateTo) {
      filter.createdAt = {};
      if (params.dateFrom) {
        const from = new Date(params.dateFrom);
        from.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = from;
      }
      if (params.dateTo) {
        const to = new Date(params.dateTo);
        to.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }

    const payments = await (PaymentModel as mongoose.Model<Payment>)
      .find(filter)
      .populate<{ customerId: { fullName: string; email: string } }>('customerId', 'fullName email')
      .populate<{ ownerId: { fullName: string; email: string } }>('ownerId', 'fullName email')
      .populate<{ parkingLotId: { parkingName: string; city?: string } }>('parkingLotId', 'parkingName city')
      .populate<{ bookingId: { bookingReference: string } }>('bookingId', 'bookingReference')
      .populate<{ ownerApplicationId: { applicationReference: string; businessName: string } }>('ownerApplicationId', 'applicationReference businessName')
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    const headers = [
      'Payment Reference',
      'Transaction ID',
      'Payment Type',
      'Payment Method',
      'Payment Status',
      'Refund Workflow State',
      'Gross Amount (INR)',
      'Platform Fee (INR)',
      'Refunded Amount (INR)',
      'Payer / Customer Name',
      'Payer Email',
      'Parking Facility',
      'Booking Reference / Application Ref',
      'Created At',
      'Settled Date',
    ];

    const escapeCsv = (val: unknown): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = payments.map((p) => {
      let refundWorkflowState = 'N/A';
      if (p.refunds && p.refunds.length > 0) {
        const latest = p.refunds[p.refunds.length - 1];
        refundWorkflowState = latest?.refundStatus || 'N/A';
      } else if (p.paymentStatus === 'REFUNDED') {
        refundWorkflowState = 'Refund Completed';
      } else if (p.paymentStatus === 'CASH_REVERSAL_PENDING') {
        refundWorkflowState = 'Refund Pending';
      }

      const payerName = p.customerId?.fullName || p.ownerId?.fullName || p.ownerApplicationId?.businessName || 'Anonymous / Walk-in';
      const payerEmail = p.customerId?.email || p.ownerId?.email || 'N/A';
      const facilityName = p.parkingLotId?.parkingName || (p.paymentTypeCode === 'OWNER_REGISTRATION' ? 'Platform Partner Onboarding' : 'N/A');
      const ref = p.bookingId?.bookingReference || p.ownerApplicationId?.applicationReference || 'N/A';
      const settledDate = p.paymentDate ? p.paymentDate.toISOString().slice(0, 19).replace('T', ' ') : 'N/A';
      const createdDate = p.createdAt ? p.createdAt.toISOString().slice(0, 19).replace('T', ' ') : 'N/A';

      return [
        escapeCsv(p.paymentReference),
        escapeCsv(p.transactionId || 'N/A'),
        escapeCsv(p.paymentType),
        escapeCsv(p.paymentMethod),
        escapeCsv(p.paymentStatus),
        escapeCsv(refundWorkflowState),
        escapeCsv(p.amount.toFixed(2)),
        escapeCsv((p.platformBookingFee || 0).toFixed(2)),
        escapeCsv((p.refundAmount || 0).toFixed(2)),
        escapeCsv(payerName),
        escapeCsv(payerEmail),
        escapeCsv(facilityName),
        escapeCsv(ref),
        escapeCsv(createdDate),
        escapeCsv(settledDate),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * 5. Get Filter Dropdown Options (Parking Lots and Owners)
   */
  public async getFilterOptions() {
    const [parkingLots, owners] = await Promise.all([
      (ParkingLotModel as any).find({ parkingStatus: { $ne: 'Closed' } })
        .select('_id parkingName city')
        .sort({ parkingName: 1 })
        .lean(),
      (UserModel as any).find({ roleId: { $exists: true } })
        .populate('roleId', 'roleCode')
        .select('_id fullName email roleId')
        .sort({ fullName: 1 })
        .lean(),
    ]);

    const filteredOwners = (owners as any[]).filter(
      (u: any) => u.roleId?.roleCode === 'PARKING_OWNER' || u.roleId?.roleCode === 'OWNER',
    );

    return {
      parkingLots: (parkingLots as any[]).map((l: any) => ({
        _id: String(l._id),
        parkingName: l.parkingName,
        city: l.city,
      })),
      owners: filteredOwners.map((o: any) => ({
        _id: String(o._id),
        fullName: o.fullName,
        email: o.email,
      })),
    };
  }
}

export const adminFinanceService = new AdminFinanceService();
