import mongoose from 'mongoose';
import { ParkingLotModel, type ParkingLot } from '../models/ParkingLot.js';
import { ParkingFloorModel } from '../models/ParkingFloor.js';
import { ParkingSlotModel } from '../models/ParkingSlot.js';
import { BookingModel, type Booking } from '../models/Booking.js';
import { PaymentModel, type Payment } from '../models/Payment.js';
import { ReviewModel, type Review } from '../models/Review.js';
import { VehicleMovementLogModel } from '../models/VehicleMovementLog.js';
import { AppError } from '../utils/AppError.js';

export interface OwnerDashboardAnalyticsParams {
  ownerId: string;
  parkingLotId?: string | undefined;
  rangePreset?: 'today' | 'this_week' | 'this_month' | 'this_year' | 'custom' | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}

export interface RevenueTrendPoint {
  date: string;
  revenue: number;
  refunds: number;
  transactions: number;
}

export interface FloorOccupancyItem {
  floorId: string;
  floorName: string;
  totalSlots: number;
  occupiedSlots: number;
  reservedSlots: number;
  availableSlots: number;
  maintenanceSlots: number;
  occupancyPercentage: number;
}

export interface RecentBookingItem {
  _id: string;
  bookingReference: string;
  customerName: string;
  vehicleNumber: string;
  vehicleType: string;
  parkingLotName: string;
  slotNumber: string;
  scheduledEntryTime: string;
  scheduledExitTime: string;
  bookingStatus: string;
  totalAmount: number;
  createdAt: string;
}

export interface RecentReviewItem {
  _id: string;
  customerName: string;
  parkingLotName: string;
  overallRating: number;
  comment: string;
  hasReply: boolean;
  createdAt: string;
}

export interface OwnerDashboardAnalyticsResponse {
  ownerLots: Array<{ _id: string; parkingName: string; address: string; totalSlots: number }>;
  selectedLotId: string;
  dateRange: { start: string; end: string; preset: string };
  kpis: {
    totalRevenue: number;
    netRevenue: number;
    successfulPayments: number;
    totalBookings: number;
    activeBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    occupancyRate: number;
    totalSlots: number;
    occupiedSlots: number;
    reservedSlots: number;
    availableSlots: number;
    maintenanceSlots: number;
    overstayCount: number;
    averageRating: number;
    totalReviews: number;
    awaitingReplyCount: number;
  };
  revenueTrends: RevenueTrendPoint[];
  floorOccupancy: FloorOccupancyItem[];
  recentBookings: RecentBookingItem[];
  recentReviews: RecentReviewItem[];
}

export async function getOwnerDashboardAnalytics(
  params: OwnerDashboardAnalyticsParams,
): Promise<OwnerDashboardAnalyticsResponse> {
  const { ownerId, parkingLotId, rangePreset = 'this_month', dateFrom, dateTo } = params;

  if (!mongoose.Types.ObjectId.isValid(ownerId)) {
    throw new AppError('Invalid owner ID format.', 400, 'INVALID_OWNER_ID');
  }

  const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

  // 1. Fetch all facilities owned by this owner
  const ownerLots = await (ParkingLotModel as any)
    .find({
      ownerId: { $in: [ownerObjectId, ownerId] },
      parkingStatus: { $ne: 'Deleted' },
    })
    .select('_id parkingName address totalSlots city state')
    .sort({ parkingName: 1 })
    .lean()
    .exec();

  if (!ownerLots.length) {
    return {
      ownerLots: [],
      selectedLotId: 'all',
      dateRange: { start: new Date().toISOString(), end: new Date().toISOString(), preset: rangePreset },
      kpis: {
        totalRevenue: 0,
        netRevenue: 0,
        successfulPayments: 0,
        totalBookings: 0,
        activeBookings: 0,
        completedBookings: 0,
        cancelledBookings: 0,
        occupancyRate: 0,
        totalSlots: 0,
        occupiedSlots: 0,
        reservedSlots: 0,
        availableSlots: 0,
        maintenanceSlots: 0,
        overstayCount: 0,
        averageRating: 0,
        totalReviews: 0,
        awaitingReplyCount: 0,
      },
      revenueTrends: [],
      floorOccupancy: [],
      recentBookings: [],
      recentReviews: [],
    };
  }

  const ownerLotIds: mongoose.Types.ObjectId[] = (ownerLots as any[]).map((l: any) => l._id as mongoose.Types.ObjectId);

  // Validate selected parkingLotId if specified
  let targetLotIds: mongoose.Types.ObjectId[] = ownerLotIds;
  if (parkingLotId && parkingLotId !== 'all') {
    if (!mongoose.Types.ObjectId.isValid(parkingLotId)) {
      throw new AppError('Invalid parking lot ID.', 400, 'INVALID_PARKING_LOT_ID');
    }
    const targetObjId = new mongoose.Types.ObjectId(parkingLotId);
    if (!ownerLotIds.some((id: mongoose.Types.ObjectId) => id.equals(targetObjId))) {
      throw new AppError('Access denied: You do not own this facility.', 403, 'FORBIDDEN');
    }
    targetLotIds = [targetObjId];
  }

  // 2. Compute Date Range Window
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date(now);

  switch (rangePreset) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'this_week': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(now.setDate(diff));
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      break;
    }
    case 'this_year':
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      endDate = new Date();
      break;
    case 'custom':
      if (dateFrom) {
        startDate = new Date(dateFrom);
        startDate.setHours(0, 0, 0, 0);
      } else {
        startDate.setDate(now.getDate() - 30);
      }
      if (dateTo) {
        endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
      } else {
        endDate = new Date();
      }
      break;
    case 'this_month':
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date();
      break;
  }

  // 3. Revenue Aggregations (consistent with ownerRevenue.service.ts)
  const paymentFilter: Record<string, unknown> = {
    parkingLotId: { $in: targetLotIds },
    paymentTypeCode: { $in: ['BOOKING', 'EXTENSION', 'OVERSTAY'] },
    createdAt: { $gte: startDate, $lte: endDate },
  };

  const revenueAgg = await (PaymentModel as mongoose.Model<Payment>).aggregate([
    { $match: paymentFilter },
    {
      $group: {
        _id: null,
        totalGross: {
          $sum: {
            $cond: [{ $in: ['$paymentStatus', ['SUCCESSFUL', 'REFUNDED']] }, '$amount', 0],
          },
        },
        totalRefunds: {
          $sum: {
            $cond: [
              { $in: ['$paymentStatus', ['SUCCESSFUL', 'REFUNDED']] },
              { $ifNull: ['$refundAmount', 0] },
              0,
            ],
          },
        },
        successfulPayments: {
          $sum: {
            $cond: [{ $eq: ['$paymentStatus', 'SUCCESSFUL'] }, 1, 0],
          },
        },
      },
    },
  ]);

  const totalRevenue = revenueAgg[0]?.totalGross || 0;
  const refundedAmount = revenueAgg[0]?.totalRefunds || 0;
  const netRevenue = Math.max(0, totalRevenue - refundedAmount);
  const successfulPayments = revenueAgg[0]?.successfulPayments || 0;

  // Revenue Over Time Trends (Daily grouping)
  const trendAgg = await (PaymentModel as mongoose.Model<Payment>).aggregate([
    {
      $match: {
        parkingLotId: { $in: targetLotIds },
        paymentTypeCode: { $in: ['BOOKING', 'EXTENSION', 'OVERSTAY'] },
        createdAt: { $gte: startDate, $lte: endDate },
        paymentStatus: { $in: ['SUCCESSFUL', 'REFUNDED'] },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$amount' },
        refunds: { $sum: { $ifNull: ['$refundAmount', 0] } },
        transactions: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const revenueTrends: RevenueTrendPoint[] = trendAgg.map((item) => ({
    date: item._id,
    revenue: item.revenue || 0,
    refunds: item.refunds || 0,
    transactions: item.transactions || 0,
  }));

  // 4. Bookings Aggregations in Period
  const bookingFilter: Record<string, unknown> = {
    parkingLotId: { $in: targetLotIds },
    createdAt: { $gte: startDate, $lte: endDate },
  };

  const [totalBookings, completedBookings, cancelledBookings] = await Promise.all([
    (BookingModel as any).countDocuments(bookingFilter),
    (BookingModel as any).countDocuments({ ...bookingFilter, bookingStatus: 'Completed' }),
    (BookingModel as any).countDocuments({ ...bookingFilter, bookingStatus: 'Cancelled' }),
  ]);

  // Active bookings (currently active in facility or confirmed upcoming)
  const activeBookings = await (BookingModel as any).countDocuments({
    parkingLotId: { $in: targetLotIds },
    bookingStatus: { $in: ['Active', 'Confirmed', 'Overstay'] },
  });

  // 5. Real-Time Occupancy Analytics on ParkingSlotModel
  const slotAgg = await (ParkingSlotModel as any).aggregate([
    { $match: { parkingLotId: { $in: targetLotIds }, isArchived: { $ne: true } } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        occupied: {
          $sum: { $cond: [{ $eq: ['$slotStatus', 'Occupied'] }, 1, 0] },
        },
        reserved: {
          $sum: { $cond: [{ $eq: ['$slotStatus', 'Reserved'] }, 1, 0] },
        },
        maintenance: {
          $sum: {
            $cond: [{ $in: ['$slotStatus', ['Under Maintenance', 'Maintenance', 'Blocked']] }, 1, 0],
          },
        },
      },
    },
  ]);

  let totalSlots = slotAgg[0]?.total || 0;
  let occupiedSlots = slotAgg[0]?.occupied || 0;
  let reservedSlots = slotAgg[0]?.reserved || 0;
  let maintenanceSlots = slotAgg[0]?.maintenance || 0;

  // Fallback if individual slots are not generated in ParkingSlotModel: derive from ParkingLotModel counts
  if (totalSlots === 0 && ownerLots.length > 0) {
    for (const lot of ownerLots as any[]) {
      totalSlots += lot.totalSlots || 0;
      occupiedSlots += lot.occupiedSlots || 0;
      reservedSlots += lot.reservedSlots || 0;
    }
  }

  const availableSlots = Math.max(0, totalSlots - occupiedSlots - reservedSlots - maintenanceSlots);
  const occupancyRate = totalSlots > 0 ? Math.min(100, Math.round((occupiedSlots / totalSlots) * 100)) : 0;

  // Floor-level occupancy breakdown
  const floors = await (ParkingFloorModel as any)
    .find({ parkingLotId: { $in: targetLotIds } })
    .select('_id floorName floorNumber totalSlots')
    .sort({ floorNumber: 1 })
    .lean();

  const floorIds = floors.map((f: any) => f._id);
  const floorSlotAgg = await (ParkingSlotModel as any).aggregate([
    { $match: { floorId: { $in: floorIds }, isArchived: { $ne: true } } },
    {
      $group: {
        _id: '$floorId',
        total: { $sum: 1 },
        occupied: {
          $sum: { $cond: [{ $eq: ['$slotStatus', 'Occupied'] }, 1, 0] },
        },
        reserved: {
          $sum: { $cond: [{ $eq: ['$slotStatus', 'Reserved'] }, 1, 0] },
        },
        maintenance: {
          $sum: {
            $cond: [{ $in: ['$slotStatus', ['Under Maintenance', 'Maintenance', 'Blocked']] }, 1, 0],
          },
        },
      },
    },
  ]);

  const floorSlotMap = new Map<string, any>();
  for (const fa of floorSlotAgg) {
    floorSlotMap.set(fa._id.toString(), fa);
  }

  const floorOccupancy: FloorOccupancyItem[] = floors.map((f: any) => {
    const stats = floorSlotMap.get(f._id.toString()) || { total: f.totalSlots || 0, occupied: 0, reserved: 0, maintenance: 0 };
    const fTotal = stats.total || f.totalSlots || 0;
    const fOcc = stats.occupied || 0;
    const fRes = stats.reserved || 0;
    const fMaint = stats.maintenance || 0;
    const fAvail = Math.max(0, fTotal - fOcc - fRes - fMaint);
    const fPct = fTotal > 0 ? Math.min(100, Math.round((fOcc / fTotal) * 100)) : 0;

    return {
      floorId: f._id.toString(),
      floorName: f.floorName,
      totalSlots: fTotal,
      occupiedSlots: fOcc,
      reservedSlots: fRes,
      availableSlots: fAvail,
      maintenanceSlots: fMaint,
      occupancyPercentage: fPct,
    };
  });

  // 6. Overstay Count (Vehicles inside exceeding scheduled exit + bookings flagged as Overstay)
  const [overstayBookings, activeLogs] = await Promise.all([
    (BookingModel as any).find({
      parkingLotId: { $in: targetLotIds },
      bookingStatus: 'Overstay',
    }).select('_id vehicleNumber').lean(),
    (VehicleMovementLogModel as any).find({
      parkingLotId: { $in: targetLotIds },
      movementStatus: { $in: ['Vehicle Inside', 'Overstayed'] },
    }).select('bookingId scheduledExitTime movementStatus vehicleNumber').lean(),
  ]);

  const overstayBookingIds = new Set<string>(overstayBookings.map((b: any) => b._id.toString()));
  const currentTimestamp = Date.now();

  for (const log of activeLogs) {
    if (log.movementStatus === 'Overstayed') {
      if (log.bookingId) overstayBookingIds.add(log.bookingId.toString());
      else if (log.vehicleNumber) overstayBookingIds.add(log.vehicleNumber);
    } else if (log.movementStatus === 'Vehicle Inside') {
      if (log.scheduledExitTime && new Date(log.scheduledExitTime).getTime() + 15 * 60 * 1000 < currentTimestamp) {
        if (log.bookingId) overstayBookingIds.add(log.bookingId.toString());
        else if (log.vehicleNumber) overstayBookingIds.add(log.vehicleNumber);
      }
    }
  }

  const overstayCount = overstayBookingIds.size;

  // 7. Customer Satisfaction (ReviewModel metrics)
  const reviewsSummaryAgg = await (ReviewModel as mongoose.Model<Review>).aggregate([
    { $match: { parkingLotId: { $in: targetLotIds }, isDeleted: { $ne: true } } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$overallRating' },
        totalReviews: { $sum: 1 },
        awaitingReplyCount: {
          $sum: {
            $cond: [
              { $or: [{ $eq: ['$ownerReply', null] }, { $eq: ['$ownerReply', ''] }] },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const averageRating = reviewsSummaryAgg[0]?.averageRating
    ? Math.round(reviewsSummaryAgg[0].averageRating * 10) / 10
    : 0;
  const totalReviews = reviewsSummaryAgg[0]?.totalReviews || 0;
  const awaitingReplyCount = reviewsSummaryAgg[0]?.awaitingReplyCount || 0;

  // Recent 3 reviews for dashboard
  const rawReviews = await (ReviewModel as any)
    .find({ parkingLotId: { $in: targetLotIds }, isDeleted: { $ne: true } })
    .sort({ createdAt: -1 })
    .limit(3)
    .populate('customerId', 'fullName')
    .populate('parkingLotId', 'parkingName')
    .lean();

  const recentReviews: RecentReviewItem[] = rawReviews.map((r: any) => ({
    _id: r._id.toString(),
    customerName: r.customerId?.fullName || 'Verified Customer',
    parkingLotName: r.parkingLotId?.parkingName || 'Facility',
    overallRating: r.overallRating || 5,
    comment: r.comment || '',
    hasReply: Boolean(r.ownerReply),
    createdAt: new Date(r.createdAt).toISOString(),
  }));

  // 8. Recent 6 Bookings for operational feed
  const rawRecentBookings = await (BookingModel as mongoose.Model<Booking>)
    .find({ parkingLotId: { $in: targetLotIds } })
    .sort({ createdAt: -1 })
    .limit(6)
    .populate('customerId', 'fullName')
    .populate('vehicleId', 'vehicleNumber vehicleType')
    .populate('currentSlotId', 'slotNumber')
    .populate('parkingLotId', 'parkingName')
    .lean();

  const recentBookings: RecentBookingItem[] = rawRecentBookings.map((b: any) => ({
    _id: b._id.toString(),
    bookingReference: b.bookingReference || 'PB-BOOKING',
    customerName: b.customerId?.fullName || 'Customer',
    vehicleNumber: b.vehicleId?.vehicleNumber || 'Unassigned',
    vehicleType: b.vehicleId?.vehicleType || 'Car',
    parkingLotName: b.parkingLotId?.parkingName || 'Facility',
    slotNumber: b.currentSlotId?.slotNumber || 'Bay Pending',
    scheduledEntryTime: new Date(b.scheduledEntryTime).toISOString(),
    scheduledExitTime: new Date(b.scheduledExitTime).toISOString(),
    bookingStatus: b.bookingStatus || 'Confirmed',
    totalAmount: Number(b.totalAmount || 0),
    createdAt: new Date(b.createdAt).toISOString(),
  }));

  return {
    ownerLots: ownerLots.map((l: any) => ({
      _id: l._id.toString(),
      parkingName: l.parkingName,
      address: l.address,
      totalSlots: l.totalSlots || 0,
    })),
    selectedLotId: parkingLotId || 'all',
    dateRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      preset: rangePreset,
    },
    kpis: {
      totalRevenue,
      netRevenue,
      successfulPayments,
      totalBookings,
      activeBookings,
      completedBookings,
      cancelledBookings,
      occupancyRate,
      totalSlots,
      occupiedSlots,
      reservedSlots,
      availableSlots,
      maintenanceSlots,
      overstayCount,
      averageRating,
      totalReviews,
      awaitingReplyCount,
    },
    revenueTrends,
    floorOccupancy,
    recentBookings,
    recentReviews,
  };
}
