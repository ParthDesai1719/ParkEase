import mongoose from 'mongoose';
import { ParkingLotModel, type ParkingLot } from '../models/ParkingLot.js';
import { ParkingFloorModel, type ParkingFloor } from '../models/ParkingFloor.js';
import { ParkingZoneModel, type ParkingZone } from '../models/ParkingZone.js';
import { ParkingLayoutModel, type ParkingLayout } from '../models/ParkingLayout.js';
import { ParkingSlotModel, type ParkingSlot } from '../models/ParkingSlot.js';
import {
  ParkingFacilitySubmissionModel,
  type ParkingFacilitySubmission,
} from '../models/ParkingFacilitySubmission.js';
import { ReviewModel, type Review } from '../models/Review.js';
import {
  FavouriteLocationModel,
  type FavouriteLocation,
} from '../models/FavouriteLocation.js';
import { AppError } from '../utils/AppError.js';

export interface CustomerParkingSearchQuery {
  search?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  maxDistanceKm?: number | undefined;
  vehicleType?: 'All' | 'Car' | 'Bike' | 'SUV' | 'EV' | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  minRating?: number | undefined;
  coveredParking?: boolean | undefined;
  evCharging?: boolean | undefined;
  is24x7?: boolean | undefined;
  availability?: 'All' | 'Available' | undefined;
  openNow?: boolean | undefined;
  sortBy?: 'distance' | 'lowestPrice' | 'highestRated' | 'availableSlots' | 'occupancyPercentage' | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface VehicleTypeAvailability {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
}

export interface FacilityPricingDetails {
  carHourlyRate: number;
  suvHourlyRate: number;
  bikeHourlyRate: number;
  dailyRate: number;
  overnightRate: number;
  evChargingRatePerHour: number;
  gracePeriodMinutes: number;
  minParkingDurationHours: number;
  maxParkingDurationHours: number;
  additionalPricingNotes: string;
}

export interface FacilityRulesDetails {
  rules: string;
  entryExitInstructions: string;
  vehicleRestrictions: string;
  heightWeightRestrictions: string;
  evRules: string;
  accessibleParkingRules: string;
  vipParkingRules: string;
  overnightRules: string;
  otherInstructions: string;
}

export interface FacilityOperatingDetails {
  isOpen24x7: boolean;
  openingTime: string;
  closingTime: string;
  scheduleType: string;
  dailySchedules: Array<{
    day: string;
    isOpen: boolean;
    openingTime: string;
    closingTime: string;
  }>;
}

export interface FacilityFloorSummary {
  _id: string;
  floorName: string;
  floorNumber: number;
  floorStatus: string;
  totalSlots?: number;
}

export interface CustomerReviewItem {
  _id: string;
  customerName: string;
  customerImage?: string | null;
  rating: number;
  comment: string | null;
  createdAt: string;
  ownerReply: string | null;
  replyDate: string | null;
}

export interface FacilityReviewsResponse {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  reviews: CustomerReviewItem[];
}

export interface CustomerParkingLotResult {
  _id: string;
  parkingName: string;
  description: string | null;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude: number;
  longitude: number;
  distanceKm: number | null;
  hourlyRate: number;
  gracePeriodMinutes: number;
  openingTime: string;
  closingTime: string;
  isOpen24Hours: boolean;
  isOpenNow: boolean;
  totalFloors: number;
  totalSlots: number;
  availableSlots: number;
  occupiedSlots: number;
  reservedSlots: number;
  occupancyPercentage: number;
  averageRating: number;
  totalReviews: number;
  amenities: string[];
  parkingImages: string[];
  isVerified: boolean;
  parkingStatus: string;
  hasPublishedLayout: boolean;
  contactNumber?: string;
  supportEmail?: string | null;
  facilityType?: string;
  pricing?: FacilityPricingDetails;
  rules?: FacilityRulesDetails;
  operatingHours?: FacilityOperatingDetails;
  floors?: FacilityFloorSummary[];
  vehicleAvailability: {
    car: VehicleTypeAvailability;
    bike: VehicleTypeAvailability;
    suv: VehicleTypeAvailability;
    ev: VehicleTypeAvailability;
  };
}

export interface PaginatedCustomerSearchResponse {
  parkingLots: CustomerParkingLotResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  activeFilters: {
    search?: string | undefined;
    vehicleType?: string | undefined;
    maxDistanceKm?: number | undefined;
    priceRange?: { min?: number | undefined; max?: number | undefined } | undefined;
    minRating?: number | undefined;
    hasUserLocation: boolean;
  };
}

/**
 * Calculates Great-Circle distance between two coordinates in kilometers using Haversine formula
 */
function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Evaluates whether a facility is currently open given current server time in IST (UTC+5:30)
 */
function evaluateIsOpenNow(
  isOpen24Hours: boolean,
  openingTime: string,
  closingTime: string,
): boolean {
  if (isOpen24Hours) return true;
  if (!openingTime || !closingTime) return true;

  // Format current time into HH:mm
  const now = new Date();
  // Using India Standard Time offset UTC+5.5
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istDate = new Date(utc + 3600000 * 5.5);
  const currentMinutes = istDate.getHours() * 60 + istDate.getMinutes();

  const [openH, openM] = openingTime.split(':').map(Number);
  const [closeH, closeM] = closingTime.split(':').map(Number);
  const openMinutes = (openH || 0) * 60 + (openM || 0);
  const closeMinutes = (closeH || 0) * 60 + (closeM || 0);

  if (openMinutes <= closeMinutes) {
    return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
  }
  // Crosses midnight (e.g. 20:00 to 04:00)
  return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
}

export class CustomerParkingService {
  /**
   * Search and discover eligible customer-facing parking facilities.
   * STRICT ENFORCEMENT OF RULE 9:
   * Only active, officially verified lots with published 2D layouts and confirmed reviews are returned.
   */
  async searchParkingLots(
    query: CustomerParkingSearchQuery,
  ): Promise<PaginatedCustomerSearchResponse> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 12));

    const priceRangeFilter =
      query.minPrice !== undefined || query.maxPrice !== undefined
        ? { min: query.minPrice, max: query.maxPrice }
        : undefined;

    // 1. Mandatory Pre-check: Obtain all ParkingLot IDs that have at least one Published 2D Layout
    const publishedLotObjectIds = await (
      ParkingLayoutModel as mongoose.Model<ParkingLayout>
    ).distinct('parkingLotId', {
      isPublished: true,
      status: 'Published',
    });

    if (!publishedLotObjectIds || publishedLotObjectIds.length === 0) {
      return {
        parkingLots: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
        activeFilters: {
          search: query.search,
          vehicleType: query.vehicleType,
          maxDistanceKm: query.maxDistanceKm,
          priceRange: priceRangeFilter,
          minRating: query.minRating,
          hasUserLocation: Boolean(query.latitude !== undefined && query.longitude !== undefined),
        },
      };
    }

    // 2. Build Base MongoDB Filter for Mandatory Visibility Invariants
    const mongoFilter: Record<string, unknown> = {
      _id: { $in: publishedLotObjectIds },
      parkingStatus: 'Active',
      isVerified: true,
      layoutReviewStatus: 'Owner Confirmed',
      totalSlots: { $gt: 0 },
    };

    // Text Search across name, city, address, state
    if (query.search && query.search.trim()) {
      const searchTerms = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(searchTerms, 'i');
      mongoFilter.$or = [
        { parkingName: searchRegex },
        { city: searchRegex },
        { address: searchRegex },
        { state: searchRegex },
      ];
    }

    // Pricing Filter
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const priceFilter: Record<string, number> = {};
      if (query.minPrice !== undefined && query.minPrice >= 0) {
        priceFilter.$gte = Number(query.minPrice);
      }
      if (query.maxPrice !== undefined && query.maxPrice > 0) {
        priceFilter.$lte = Number(query.maxPrice);
      }
      if (Object.keys(priceFilter).length > 0) {
        mongoFilter.hourlyRate = priceFilter;
      }
    }

    // Rating Filter
    if (query.minRating !== undefined && query.minRating > 0) {
      mongoFilter.averageRating = { $gte: Number(query.minRating) };
    }

    // Amenities: Covered Parking
    if (query.coveredParking === true) {
      mongoFilter.amenities = { $in: ['Covered Parking'] };
    }

    // Amenities: EV Charging
    if (query.evCharging === true) {
      if (mongoFilter.amenities && Array.isArray((mongoFilter.amenities as Record<string, unknown>).$in)) {
        ((mongoFilter.amenities as Record<string, unknown>).$in as string[]).push('EV Charging');
      } else {
        mongoFilter.amenities = { $in: ['EV Charging'] };
      }
    }

    // 24x7 Availability Filter
    if (query.is24x7 === true) {
      const andList = (mongoFilter.$and as unknown[]) || [];
      andList.push({
        $or: [{ isOpen24Hours: true }, { openingTime: '00:00', closingTime: '23:59' }],
      });
      mongoFilter.$and = andList;
    }

    // 3. Fetch candidate parking lots from MongoDB
    const candidateLots = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .find(mongoFilter)
      .lean()
      .exec();

    if (!candidateLots || candidateLots.length === 0) {
      return {
        parkingLots: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
        activeFilters: {
          search: query.search,
          vehicleType: query.vehicleType,
          maxDistanceKm: query.maxDistanceKm,
          priceRange: priceRangeFilter,
          minRating: query.minRating,
          hasUserLocation: Boolean(query.latitude !== undefined && query.longitude !== undefined),
        },
      };
    }

    const candidateLotIds = candidateLots.map((lot) => lot._id as mongoose.Types.ObjectId);

    // 4. Validate official structural hierarchy (ParkingLot -> ParkingFloor -> ParkingZone -> ParkingSlot)
    const [officialFloors, officialZones] = await Promise.all([
      (ParkingFloorModel as mongoose.Model<ParkingFloor>)
        .find(
          { parkingLotId: { $in: candidateLotIds } },
          '_id parkingLotId floorStatus',
        )
        .lean(),
      (ParkingZoneModel as mongoose.Model<ParkingZone>)
        .find(
          { parkingLotId: { $in: candidateLotIds } },
          '_id parkingLotId floorId zoneStatus',
        )
        .lean(),
    ]);

    // Build floor & zone relationship maps
    const lotFloorsMap = new Map<string, Set<string>>();
    for (const fl of officialFloors) {
      const lotIdStr = fl.parkingLotId.toString();
      const flIdStr = fl._id.toString();
      if (!lotFloorsMap.has(lotIdStr)) {
        lotFloorsMap.set(lotIdStr, new Set());
      }
      if (fl.floorStatus !== 'Closed') {
        lotFloorsMap.get(lotIdStr)!.add(flIdStr);
      }
    }

    const floorZonesMap = new Map<string, Set<string>>();
    const structurallyCorruptLots = new Set<string>();

    for (const zn of officialZones) {
      const lotIdStr = zn.parkingLotId.toString();
      const flIdStr = zn.floorId.toString();
      const znIdStr = zn._id.toString();

      const lotFloors = lotFloorsMap.get(lotIdStr);
      // If zone references a floor not belonging to that lot, mark as structurally corrupt
      if (!lotFloors || !lotFloors.has(flIdStr)) {
        structurallyCorruptLots.add(lotIdStr);
        continue;
      }

      if (!floorZonesMap.has(flIdStr)) {
        floorZonesMap.set(flIdStr, new Set());
      }
      floorZonesMap.get(flIdStr)!.add(znIdStr);
    }

    // 5. Query live official slot aggregations to guarantee authoritative live slot counts
    const slotAggregations = await (ParkingSlotModel as mongoose.Model<ParkingSlot>).aggregate<{
      _id: {
        parkingLotId: mongoose.Types.ObjectId;
        vehicleType: string;
        status: string;
        floorId: mongoose.Types.ObjectId;
        zoneId?: mongoose.Types.ObjectId | null;
      };
      count: number;
    }>([
      { $match: { parkingLotId: { $in: candidateLotIds } } },
      {
        $group: {
          _id: {
            parkingLotId: '$parkingLotId',
            vehicleType: '$supportedVehicleType',
            status: '$slotStatus',
            floorId: '$floorId',
            zoneId: '$zoneId',
          },
          count: { $sum: 1 },
        },
      },
    ]);

    interface VerifiedSlotStats {
      totalPhysical: number;
      operationalTotal: number;
      available: number;
      occupied: number;
      reserved: number;
      underMaintenance: number;
      byType: Record<
        'Car' | 'Bike' | 'SUV' | 'EV',
        {
          totalPhysical: number;
          operationalTotal: number;
          available: number;
          occupied: number;
          reserved: number;
          underMaintenance: number;
        }
      >;
    }

    const lotSlotStatsMap = new Map<string, VerifiedSlotStats>();

    for (const agg of slotAggregations) {
      const lotIdStr = agg._id.parkingLotId.toString();
      const floorIdStr = agg._id.floorId ? agg._id.floorId.toString() : '';
      const zoneIdStr = agg._id.zoneId ? agg._id.zoneId.toString() : null;

      // Validate slot floor reference belongs to the lot's official floors
      const lotFloors = lotFloorsMap.get(lotIdStr);
      if (!lotFloors || !lotFloors.has(floorIdStr)) {
        structurallyCorruptLots.add(lotIdStr);
        continue;
      }

      // Validate zone reference if present
      if (zoneIdStr) {
        const floorZones = floorZonesMap.get(floorIdStr);
        if (!floorZones || !floorZones.has(zoneIdStr)) {
          structurallyCorruptLots.add(lotIdStr);
          continue;
        }
      }

      if (!lotSlotStatsMap.has(lotIdStr)) {
        lotSlotStatsMap.set(lotIdStr, {
          totalPhysical: 0,
          operationalTotal: 0,
          available: 0,
          occupied: 0,
          reserved: 0,
          underMaintenance: 0,
          byType: {
            Car: { totalPhysical: 0, operationalTotal: 0, available: 0, occupied: 0, reserved: 0, underMaintenance: 0 },
            Bike: { totalPhysical: 0, operationalTotal: 0, available: 0, occupied: 0, reserved: 0, underMaintenance: 0 },
            SUV: { totalPhysical: 0, operationalTotal: 0, available: 0, occupied: 0, reserved: 0, underMaintenance: 0 },
            EV: { totalPhysical: 0, operationalTotal: 0, available: 0, occupied: 0, reserved: 0, underMaintenance: 0 },
          },
        });
      }

      const stats = lotSlotStatsMap.get(lotIdStr)!;
      const vType = agg._id.vehicleType as 'Car' | 'Bike' | 'SUV' | 'EV';
      const status = agg._id.status;
      const count = agg.count;

      stats.totalPhysical += count;
      if (stats.byType[vType]) {
        stats.byType[vType].totalPhysical += count;
      }

      if (status === 'Available') {
        stats.available += count;
        stats.operationalTotal += count;
        if (stats.byType[vType]) {
          stats.byType[vType].available += count;
          stats.byType[vType].operationalTotal += count;
        }
      } else if (status === 'Occupied') {
        stats.occupied += count;
        stats.operationalTotal += count;
        if (stats.byType[vType]) {
          stats.byType[vType].occupied += count;
          stats.byType[vType].operationalTotal += count;
        }
      } else if (status === 'Reserved') {
        stats.reserved += count;
        stats.operationalTotal += count;
        if (stats.byType[vType]) {
          stats.byType[vType].reserved += count;
          stats.byType[vType].operationalTotal += count;
        }
      } else if (status === 'Under Maintenance') {
        // Exclude Under Maintenance slots from operational capacity
        stats.underMaintenance += count;
        if (stats.byType[vType]) {
          stats.byType[vType].underMaintenance += count;
        }
      }
    }

    // 6. Post-process candidates: compute distance, openNow, vehicle-type eligibility, and slot reconciliation
    const processedLots: CustomerParkingLotResult[] = [];
    const hasUserLocation =
      query.latitude !== undefined &&
      query.longitude !== undefined &&
      !isNaN(query.latitude) &&
      !isNaN(query.longitude);

    for (const lot of candidateLots) {
      const lotIdStr = (lot._id as mongoose.Types.ObjectId).toString();

      // Priority 3: Disqualify facilities with missing floors or corrupted structural references
      const lotFloors = lotFloorsMap.get(lotIdStr);
      if (!lotFloors || lotFloors.size === 0 || structurallyCorruptLots.has(lotIdStr)) {
        continue;
      }

      // Priority 2: Exclude lots without authoritative physical ParkingSlot inventory (No Ghost Slots)
      const liveStats = lotSlotStatsMap.get(lotIdStr);
      if (!liveStats || liveStats.totalPhysical === 0 || liveStats.operationalTotal === 0) {
        continue;
      }

      // Priority 4: Available Slots Filter evaluated authoritatively against actual available slots
      if (query.availability === 'Available' && liveStats.available <= 0) {
        continue;
      }

      // Vehicle Type Filter: If specific vehicle requested, must have available slots for that type
      if (query.vehicleType && query.vehicleType !== 'All') {
        const typeStats = liveStats.byType[query.vehicleType];
        if (!typeStats || typeStats.available <= 0) {
          continue; // Does not have available slots for requested vehicle type
        }
      }

      // Open Now Filter
      const isOpenNow = evaluateIsOpenNow(
        Boolean(lot.isOpen24Hours),
        lot.openingTime || '00:00',
        lot.closingTime || '23:59',
      );
      if (query.openNow === true && !isOpenNow) {
        continue;
      }

      // Distance Calculation
      let distanceKm: number | null = null;
      if (hasUserLocation) {
        distanceKm = calculateHaversineDistanceKm(
          query.latitude!,
          query.longitude!,
          lot.latitude,
          lot.longitude,
        );

        // Max distance filter
        if (query.maxDistanceKm !== undefined && query.maxDistanceKm > 0) {
          if (distanceKm > query.maxDistanceKm) {
            continue; // Exceeds requested radius
          }
        }
      }

      const occupancyPercentage =
        liveStats.operationalTotal > 0
          ? Math.min(
              100,
              Math.max(
                0,
                Math.round(
                  ((liveStats.occupied + liveStats.reserved) / liveStats.operationalTotal) * 100,
                ),
              ),
            )
          : 0;

      processedLots.push({
        _id: lotIdStr,
        parkingName: lot.parkingName,
        description: lot.description ?? null,
        address: lot.address,
        city: lot.city,
        state: lot.state,
        postalCode: lot.postalCode,
        country: lot.country,
        latitude: lot.latitude,
        longitude: lot.longitude,
        distanceKm,
        hourlyRate: lot.hourlyRate,
        gracePeriodMinutes: lot.gracePeriodMinutes,
        openingTime: lot.openingTime,
        closingTime: lot.closingTime,
        isOpen24Hours: Boolean(lot.isOpen24Hours),
        isOpenNow,
        totalFloors: lot.totalFloors,
        totalSlots: liveStats.operationalTotal,
        availableSlots: liveStats.available,
        occupiedSlots: liveStats.occupied,
        reservedSlots: liveStats.reserved,
        occupancyPercentage,
        averageRating: lot.averageRating,
        totalReviews: lot.totalReviews,
        amenities: lot.amenities || [],
        parkingImages: lot.parkingImages || [],
        isVerified: lot.isVerified,
        parkingStatus: lot.parkingStatus,
        hasPublishedLayout: true,
        vehicleAvailability: {
          car: {
            total: liveStats.byType.Car.operationalTotal,
            available: liveStats.byType.Car.available,
            occupied: liveStats.byType.Car.occupied,
            reserved: liveStats.byType.Car.reserved,
          },
          bike: {
            total: liveStats.byType.Bike.operationalTotal,
            available: liveStats.byType.Bike.available,
            occupied: liveStats.byType.Bike.occupied,
            reserved: liveStats.byType.Bike.reserved,
          },
          suv: {
            total: liveStats.byType.SUV.operationalTotal,
            available: liveStats.byType.SUV.available,
            occupied: liveStats.byType.SUV.occupied,
            reserved: liveStats.byType.SUV.reserved,
          },
          ev: {
            total: liveStats.byType.EV.operationalTotal,
            available: liveStats.byType.EV.available,
            occupied: liveStats.byType.EV.occupied,
            reserved: liveStats.byType.EV.reserved,
          },
        },
      });
    }

    // 6. Sorting Logic
    const sortBy = query.sortBy || (hasUserLocation ? 'distance' : 'lowestPrice');
    const sortOrder = query.sortOrder || (sortBy === 'distance' || sortBy === 'lowestPrice' || sortBy === 'occupancyPercentage' ? 'asc' : 'desc');

    processedLots.sort((a, b) => {
      let comparison: number;
      switch (sortBy) {
        case 'distance':
          if (a.distanceKm != null && b.distanceKm != null) {
            comparison = a.distanceKm - b.distanceKm;
          } else if (a.distanceKm != null) {
            comparison = -1;
          } else if (b.distanceKm != null) {
            comparison = 1;
          } else {
            comparison = a.hourlyRate - b.hourlyRate;
          }
          break;
        case 'lowestPrice':
          comparison = a.hourlyRate - b.hourlyRate;
          break;
        case 'highestRated':
          comparison = b.averageRating - a.averageRating || b.totalReviews - a.totalReviews;
          break;
        case 'availableSlots':
          comparison = b.availableSlots - a.availableSlots;
          break;
        case 'occupancyPercentage':
          comparison = a.occupancyPercentage - b.occupancyPercentage;
          break;
        default:
          comparison = a.hourlyRate - b.hourlyRate;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // 7. In-Memory Pagination of Processed & Filtered Lots
    const total = processedLots.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedLots = processedLots.slice(startIndex, startIndex + limit);

    return {
      parkingLots: paginatedLots,
      total,
      page,
      limit,
      totalPages,
      activeFilters: {
        search: query.search,
        vehicleType: query.vehicleType,
        maxDistanceKm: query.maxDistanceKm,
        priceRange: priceRangeFilter,
        minRating: query.minRating,
        hasUserLocation,
      },
    };
  }

  /**
   * Retrieves single customer-safe parking facility details
   */
  async getParkingLotDetails(
    parkingLotId: string,
    userLat?: number,
    userLng?: number,
  ): Promise<CustomerParkingLotResult> {
    if (!mongoose.Types.ObjectId.isValid(parkingLotId)) {
      throw new AppError('Invalid parking lot ID format.', 400, 'INVALID_ID');
    }

    // Check published layout
    const publishedLayout = await (ParkingLayoutModel as mongoose.Model<ParkingLayout>).findOne({
      parkingLotId,
      isPublished: true,
      status: 'Published',
    });

    if (!publishedLayout) {
      throw new AppError(
        'Parking facility is not available for public discovery.',
        404,
        'FACILITY_NOT_AVAILABLE',
      );
    }

    const lot = await (ParkingLotModel as mongoose.Model<ParkingLot>).findById(parkingLotId).lean();

    if (!lot || lot.parkingStatus !== 'Active' || !lot.isVerified || lot.layoutReviewStatus !== 'Owner Confirmed') {
      throw new AppError(
        'Parking facility is not active or verified.',
        404,
        'FACILITY_NOT_ACTIVE',
      );
    }

    const lotObjectId = new mongoose.Types.ObjectId(parkingLotId);

    // Validate official floors exist
    const floors = await (ParkingFloorModel as mongoose.Model<ParkingFloor>)
      .find({ parkingLotId: lotObjectId }, '_id floorStatus floorName floorNumber totalSlots')
      .sort({ floorNumber: 1 })
      .lean();

    if (!floors || floors.length === 0 || floors.every((f) => f.floorStatus === 'Closed')) {
      throw new AppError(
        'Parking facility has no operational floors configured.',
        404,
        'FACILITY_NOT_ACTIVE',
      );
    }

    const floorIdsSet = new Set(floors.map((f) => f._id.toString()));

    // Live slot aggregation
    const slotAggregations = await (ParkingSlotModel as mongoose.Model<ParkingSlot>).aggregate<{
      _id: { vehicleType: string; status: string; floorId: mongoose.Types.ObjectId };
      count: number;
    }>([
      { $match: { parkingLotId: lotObjectId } },
      {
        $group: {
          _id: {
            vehicleType: '$supportedVehicleType',
            status: '$slotStatus',
            floorId: '$floorId',
          },
          count: { $sum: 1 },
        },
      },
    ]);

    if (!slotAggregations || slotAggregations.length === 0) {
      throw new AppError(
        'Parking facility has no official slots provisioned.',
        404,
        'FACILITY_NOT_AVAILABLE',
      );
    }

    const liveStats = {
      totalPhysical: 0,
      operationalTotal: 0,
      available: 0,
      occupied: 0,
      reserved: 0,
      underMaintenance: 0,
      byType: {
        Car: { totalPhysical: 0, operationalTotal: 0, available: 0, occupied: 0, reserved: 0, underMaintenance: 0 },
        Bike: { totalPhysical: 0, operationalTotal: 0, available: 0, occupied: 0, reserved: 0, underMaintenance: 0 },
        SUV: { totalPhysical: 0, operationalTotal: 0, available: 0, occupied: 0, reserved: 0, underMaintenance: 0 },
        EV: { totalPhysical: 0, operationalTotal: 0, available: 0, occupied: 0, reserved: 0, underMaintenance: 0 },
      },
    };

    for (const agg of slotAggregations) {
      // Confirm slot floor reference belongs to this facility's floors
      const flIdStr = agg._id.floorId ? agg._id.floorId.toString() : '';
      if (!floorIdsSet.has(flIdStr)) {
        throw new AppError('Parking facility has corrupt structural floor references.', 500, 'CORRUPT_STRUCTURE');
      }

      const vType = agg._id.vehicleType as 'Car' | 'Bike' | 'SUV' | 'EV';
      const status = agg._id.status;
      const count = agg.count;

      liveStats.totalPhysical += count;
      if (liveStats.byType[vType]) {
        liveStats.byType[vType].totalPhysical += count;
      }

      if (status === 'Available') {
        liveStats.available += count;
        liveStats.operationalTotal += count;
        if (liveStats.byType[vType]) {
          liveStats.byType[vType].available += count;
          liveStats.byType[vType].operationalTotal += count;
        }
      } else if (status === 'Occupied') {
        liveStats.occupied += count;
        liveStats.operationalTotal += count;
        if (liveStats.byType[vType]) {
          liveStats.byType[vType].occupied += count;
          liveStats.byType[vType].operationalTotal += count;
        }
      } else if (status === 'Reserved') {
        liveStats.reserved += count;
        liveStats.operationalTotal += count;
        if (liveStats.byType[vType]) {
          liveStats.byType[vType].reserved += count;
          liveStats.byType[vType].operationalTotal += count;
        }
      } else if (status === 'Under Maintenance') {
        liveStats.underMaintenance += count;
        if (liveStats.byType[vType]) {
          liveStats.byType[vType].underMaintenance += count;
        }
      }
    }

    if (liveStats.operationalTotal === 0) {
      throw new AppError(
        'Parking facility has no operational parking slots.',
        404,
        'FACILITY_NOT_AVAILABLE',
      );
    }

    let distanceKm: number | null = null;
    if (userLat !== undefined && userLng !== undefined && !isNaN(userLat) && !isNaN(userLng)) {
      distanceKm = calculateHaversineDistanceKm(userLat, userLng, lot.latitude, lot.longitude);
    }

    const isOpenNow = evaluateIsOpenNow(
      Boolean(lot.isOpen24Hours),
      lot.openingTime || '00:00',
      lot.closingTime || '23:59',
    );

    const occupancyPercentage =
      liveStats.operationalTotal > 0
        ? Math.min(
            100,
            Math.max(
              0,
              Math.round(
                ((liveStats.occupied + liveStats.reserved) / liveStats.operationalTotal) * 100,
              ),
            ),
          )
        : 0;

    let facilityType = 'Commercial Parking';
    let pricingDetails: FacilityPricingDetails = {
      carHourlyRate: lot.hourlyRate,
      suvHourlyRate: lot.hourlyRate,
      bikeHourlyRate: Math.max(0, Math.round(lot.hourlyRate * 0.5)),
      dailyRate: lot.hourlyRate * 8,
      overnightRate: lot.hourlyRate * 10,
      evChargingRatePerHour: lot.hourlyRate,
      gracePeriodMinutes: lot.gracePeriodMinutes,
      minParkingDurationHours: 1,
      maxParkingDurationHours: 24,
      additionalPricingNotes: 'Rates include applicable taxes. Digital receipt provided upon entry.',
    };

    let rulesDetails: FacilityRulesDetails = {
      rules: 'Park within marked bay boundaries. Follow on-site attendant instructions. Turn off engine when parked.',
      entryExitInstructions: 'Present digital QR code at entry and exit gates. Attendant will scan your pass.',
      vehicleRestrictions: 'Commercial heavy vehicles prohibited unless authorized.',
      heightWeightRestrictions: 'Standard clearance 2.4m applies across all floors.',
      evRules: 'EV charging points reserved strictly for active charging sessions.',
      accessibleParkingRules: 'Accessible bays reserved exclusively for persons with reduced mobility.',
      vipParkingRules: 'VIP reserved slots require authorized pass verification.',
      overnightRules: 'Overnight parking permitted. Inform security attendant upon entry.',
      otherInstructions: 'ParkEase accepts no liability for valuables left inside unattended vehicles.',
    };

    let operatingDetails: FacilityOperatingDetails = {
      isOpen24x7: Boolean(lot.isOpen24Hours),
      openingTime: lot.openingTime || '00:00',
      closingTime: lot.closingTime || '23:59',
      scheduleType: lot.isOpen24Hours ? '24x7' : 'Standard',
      dailySchedules: [],
    };

    if (lot.submissionId) {
      try {
        const submission = await (
          ParkingFacilitySubmissionModel as mongoose.Model<ParkingFacilitySubmission>
        )
          .findById(lot.submissionId)
          .lean();
        if (submission) {
          if (submission.facilityType) {
            facilityType = submission.facilityType;
          }
          if (submission.pricing) {
            const resolvedCarRate = submission.pricing.carHourlyRate || lot.hourlyRate;
            const rawEvRate =
              typeof submission.pricing.evChargingRatePerHour === 'number'
                ? submission.pricing.evChargingRatePerHour
                : 0;
            const effectiveEvRate = rawEvRate > 0 ? rawEvRate : resolvedCarRate;

            pricingDetails = {
              carHourlyRate: resolvedCarRate,
              suvHourlyRate: submission.pricing.suvHourlyRate || resolvedCarRate,
              bikeHourlyRate:
                submission.pricing.bikeHourlyRate || Math.max(0, Math.round(resolvedCarRate * 0.5)),
              dailyRate: submission.pricing.dailyRate || resolvedCarRate * 8,
              overnightRate: submission.pricing.overnightRate || resolvedCarRate * 10,
              evChargingRatePerHour: effectiveEvRate,
              gracePeriodMinutes: submission.pricing.gracePeriodMinutes ?? lot.gracePeriodMinutes,
              minParkingDurationHours: submission.pricing.minParkingDurationHours || 1,
              maxParkingDurationHours: submission.pricing.maxParkingDurationHours || 24,
              additionalPricingNotes:
                submission.pricing.additionalPricingNotes || pricingDetails.additionalPricingNotes,
            };
          }
          if (submission.parkingRules) {
            rulesDetails = {
              rules: submission.parkingRules.rules || rulesDetails.rules,
              entryExitInstructions: submission.parkingRules.entryExitInstructions || rulesDetails.entryExitInstructions,
              vehicleRestrictions: submission.parkingRules.vehicleRestrictions || rulesDetails.vehicleRestrictions,
              heightWeightRestrictions: submission.parkingRules.heightWeightRestrictions || rulesDetails.heightWeightRestrictions,
              evRules: submission.parkingRules.evRules || rulesDetails.evRules,
              accessibleParkingRules: submission.parkingRules.accessibleParkingRules || rulesDetails.accessibleParkingRules,
              vipParkingRules: submission.parkingRules.vipParkingRules || rulesDetails.vipParkingRules,
              overnightRules: submission.parkingRules.overnightRules || rulesDetails.overnightRules,
              otherInstructions: submission.parkingRules.otherInstructions || rulesDetails.otherInstructions,
            };
          }
          if (submission.operatingInfo) {
            operatingDetails = {
              isOpen24x7: submission.operatingInfo.isOpen24x7 ?? Boolean(lot.isOpen24Hours),
              openingTime: submission.operatingInfo.openingTime || lot.openingTime || '08:00',
              closingTime: submission.operatingInfo.closingTime || lot.closingTime || '22:00',
              scheduleType: submission.operatingInfo.scheduleType || (lot.isOpen24Hours ? '24x7' : 'Standard'),
              dailySchedules: (submission.operatingInfo.dailySchedules || []).map((ds) => ({
                day: ds.day,
                isOpen: Boolean(ds.isOpen),
                openingTime: ds.openingTime || '08:00',
                closingTime: ds.closingTime || '22:00',
              })),
            };
          }
        }
      } catch {
        // Fall back gracefully to ParkingLot base parameters
      }
    }

    const floorSummaries: FacilityFloorSummary[] = floors.map((f) => ({
      _id: f._id.toString(),
      floorName: (f as { floorName?: string }).floorName || `Floor ${(f as { floorNumber?: number }).floorNumber || 1}`,
      floorNumber: (f as { floorNumber?: number }).floorNumber || 1,
      floorStatus: f.floorStatus,
      totalSlots: (f as { totalSlots?: number }).totalSlots || 0,
    }));

    return {
      _id: (lot._id as mongoose.Types.ObjectId).toString(),
      parkingName: lot.parkingName,
      description: lot.description ?? null,
      address: lot.address,
      city: lot.city,
      state: lot.state,
      postalCode: lot.postalCode,
      country: lot.country,
      latitude: lot.latitude,
      longitude: lot.longitude,
      distanceKm,
      hourlyRate: lot.hourlyRate,
      gracePeriodMinutes: lot.gracePeriodMinutes,
      openingTime: lot.openingTime,
      closingTime: lot.closingTime,
      isOpen24Hours: Boolean(lot.isOpen24Hours),
      isOpenNow,
      totalFloors: lot.totalFloors,
      totalSlots: liveStats.operationalTotal,
      availableSlots: liveStats.available,
      occupiedSlots: liveStats.occupied,
      reservedSlots: liveStats.reserved,
      occupancyPercentage,
      averageRating: lot.averageRating,
      totalReviews: lot.totalReviews,
      amenities: lot.amenities || [],
      parkingImages: lot.parkingImages || [],
      isVerified: lot.isVerified,
      parkingStatus: lot.parkingStatus,
      hasPublishedLayout: true,
      contactNumber: lot.contactNumber,
      supportEmail: lot.supportEmail ?? null,
      facilityType,
      pricing: pricingDetails,
      rules: rulesDetails,
      operatingHours: operatingDetails,
      floors: floorSummaries,
      vehicleAvailability: {
        car: {
          total: liveStats.byType.Car.operationalTotal,
          available: liveStats.byType.Car.available,
          occupied: liveStats.byType.Car.occupied,
          reserved: liveStats.byType.Car.reserved,
        },
        bike: {
          total: liveStats.byType.Bike.operationalTotal,
          available: liveStats.byType.Bike.available,
          occupied: liveStats.byType.Bike.occupied,
          reserved: liveStats.byType.Bike.reserved,
        },
        suv: {
          total: liveStats.byType.SUV.operationalTotal,
          available: liveStats.byType.SUV.available,
          occupied: liveStats.byType.SUV.occupied,
          reserved: liveStats.byType.SUV.reserved,
        },
        ev: {
          total: liveStats.byType.EV.operationalTotal,
          available: liveStats.byType.EV.available,
          occupied: liveStats.byType.EV.occupied,
          reserved: liveStats.byType.EV.reserved,
        },
      },
    };
  }

  /**
   * Retrieves verified customer reviews and rating distribution
   */
  async getFacilityReviews(parkingLotId: string): Promise<FacilityReviewsResponse> {
    if (!mongoose.Types.ObjectId.isValid(parkingLotId)) {
      throw new AppError('Invalid parking lot ID format.', 400, 'INVALID_ID');
    }
    const lotObjectId = new mongoose.Types.ObjectId(parkingLotId);

    const reviews = await (ReviewModel as mongoose.Model<Review>)
      .find({
        parkingLotId: lotObjectId,
        moderationStatus: 'Published',
      })
      .populate('customerId', 'fullName profileImage')
      .sort({ createdAt: -1 })
      .lean();

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let ratingSum = 0;

    const formattedReviews: CustomerReviewItem[] = reviews.map((rev) => {
      const r = Math.min(5, Math.max(1, Math.round(rev.overallRating)));
      distribution[r as 1 | 2 | 3 | 4 | 5] = (distribution[r as 1 | 2 | 3 | 4 | 5] || 0) + 1;
      ratingSum += rev.overallRating;

      const customer = rev.customerId as unknown as { fullName?: string; profileImage?: string | null } | null;
      let customerName = 'Verified Customer';
      if (customer?.fullName) {
        const parts = customer.fullName.trim().split(/\s+/);
        if (parts.length > 1 && parts[parts.length - 1]) {
          customerName = `${parts[0]} ${parts[parts.length - 1]!.charAt(0)}.`;
        } else if (parts[0]) {
          customerName = parts[0];
        }
      }

      return {
        _id: rev._id.toString(),
        customerName,
        customerImage: customer?.profileImage ?? null,
        rating: rev.overallRating,
        comment: rev.comment ?? null,
        createdAt: rev.createdAt ? new Date(rev.createdAt).toISOString() : new Date().toISOString(),
        ownerReply: rev.ownerReply ?? null,
        replyDate: rev.replyDate ? new Date(rev.replyDate).toISOString() : null,
      };
    });

    const totalReviews = formattedReviews.length;
    const averageRating = totalReviews > 0 ? Number((ratingSum / totalReviews).toFixed(1)) : 0;

    return {
      averageRating,
      totalReviews,
      ratingDistribution: distribution,
      reviews: formattedReviews,
    };
  }

  /**
   * Retrieves user's favourite status for a parking facility
   */
  async getFavouriteStatus(userId: string, parkingLotId: string): Promise<{ isFavourite: boolean }> {
    if (!mongoose.Types.ObjectId.isValid(parkingLotId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return { isFavourite: false };
    }
    const fav = await (FavouriteLocationModel as mongoose.Model<FavouriteLocation>)
      .findOne({
        customerId: new mongoose.Types.ObjectId(userId),
        parkingLotId: new mongoose.Types.ObjectId(parkingLotId),
        isActive: true,
      })
      .lean();

    return { isFavourite: Boolean(fav) };
  }

  /**
   * Toggles customer's favourite status for a parking facility
   */
  async toggleFavourite(userId: string, parkingLotId: string): Promise<{ isFavourite: boolean }> {
    if (!mongoose.Types.ObjectId.isValid(parkingLotId)) {
      throw new AppError('Invalid parking lot ID format.', 400, 'INVALID_ID');
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID.', 401, 'UNAUTHORIZED');
    }

    const customerId = new mongoose.Types.ObjectId(userId);
    const lotObjectId = new mongoose.Types.ObjectId(parkingLotId);

    const existing = await (FavouriteLocationModel as mongoose.Model<FavouriteLocation>).findOne({
      customerId,
      parkingLotId: lotObjectId,
    });

    if (existing) {
      existing.isActive = !existing.isActive;
      await existing.save();
      return { isFavourite: existing.isActive };
    }

    await (FavouriteLocationModel as mongoose.Model<FavouriteLocation>).create({
      customerId,
      parkingLotId: lotObjectId,
      isActive: true,
    });

    return { isFavourite: true };
  }

  /**
   * Explicitly deactivates/removes customer's favourite status for a parking facility
   */
  async removeFavourite(userId: string, parkingLotId: string): Promise<{ isFavourite: boolean }> {
    if (!mongoose.Types.ObjectId.isValid(parkingLotId)) {
      throw new AppError('Invalid parking lot ID format.', 400, 'INVALID_ID');
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID.', 401, 'UNAUTHORIZED');
    }

    const customerId = new mongoose.Types.ObjectId(userId);
    const lotObjectId = new mongoose.Types.ObjectId(parkingLotId);

    const existing = await (FavouriteLocationModel as mongoose.Model<FavouriteLocation>).findOne({
      customerId,
      parkingLotId: lotObjectId,
    });

    if (existing && existing.isActive) {
      existing.isActive = false;
      await existing.save();
    }

    return { isFavourite: false };
  }

  /**
   * Retrieves all active favourite parking locations for the authenticated customer,
   * enriched with live slot availability, pricing, and optional distance.
   */
  async getCustomerFavourites(
    userId: string,
    userLat?: number,
    userLng?: number,
  ): Promise<Array<CustomerParkingLotResult & { favouritedAt: string }>> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID.', 401, 'UNAUTHORIZED');
    }

    const favDocs = await (FavouriteLocationModel as mongoose.Model<FavouriteLocation>)
      .find({
        customerId: new mongoose.Types.ObjectId(userId),
        isActive: true,
      })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    if (favDocs.length === 0) {
      return [];
    }

    const enriched: Array<CustomerParkingLotResult & { favouritedAt: string }> = [];
    for (const fav of favDocs) {
      try {
        const lotDetails = await this.getParkingLotDetails(
          fav.parkingLotId.toString(),
          userLat,
          userLng,
        );
        enriched.push({
          ...lotDetails,
          favouritedAt: fav.createdAt
            ? new Date(fav.createdAt).toISOString()
            : new Date().toISOString(),
        });
      } catch {
        // Facility is no longer active or bookable; skip gracefully
      }
    }

    return enriched;
  }
}

export const customerParkingService = new CustomerParkingService();
