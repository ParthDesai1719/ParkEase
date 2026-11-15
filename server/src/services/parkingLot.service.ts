import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { AuditLogModel } from '../models/AuditLog.js';
import { ParkingFacilitySubmissionModel, type ParkingFacilitySubmission } from '../models/ParkingFacilitySubmission.js';
import { ParkingLotModel, type ParkingLot } from '../models/ParkingLot.js';
import { ParkingFloorModel, type ParkingFloor } from '../models/ParkingFloor.js';
import { ParkingZoneModel, type ParkingZone } from '../models/ParkingZone.js';
import { ParkingSlotModel, type ParkingSlot } from '../models/ParkingSlot.js';
import { UserModel, type User } from '../models/User.js';
import { RoleModel, type Role } from '../models/Role.js';
import { notificationService } from './notification.service.js';
import { AppError } from '../utils/AppError.js';
import { normalizeIp } from '../utils/ip.js';

export interface GetOfficialParkingLotsFilter {
  search?: string | undefined;
  status?: string | undefined;
  ownerId?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface PaginatedParkingLotsResult {
  parkingLots: ParkingLot[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface OfficialHierarchySlot {
  _id: string;
  slotNumber: string;
  slotLabel: string;
  slotType: string;
  supportedVehicleType: string;
  slotStatus: string;
  qrIdentifier: string;
  remarks?: string | null | undefined;
}

export interface OfficialHierarchyZone {
  _id: string;
  zoneName: string;
  zoneCode: string;
  vehicleType?: string | null | undefined;
  totalSlots: number;
  availableSlots: number;
  zoneStatus: string;
  slots: OfficialHierarchySlot[];
}

export interface OfficialHierarchyFloor {
  _id: string;
  floorName: string;
  floorNumber: number;
  description?: string | null | undefined;
  totalZones: number;
  totalSlots: number;
  availableSlots: number;
  floorStatus: string;
  zones: OfficialHierarchyZone[];
}

export interface OfficialParkingLotHierarchy {
  parkingLot: ParkingLot;
  floors: OfficialHierarchyFloor[];
  stats: {
    totalFloors: number;
    totalZones: number;
    totalSlots: number;
    availableSlots: number;
    occupiedSlots: number;
    reservedSlots: number;
  };
}

export class ParkingLotService {
  /**
   * Helper: Map amenities from submission to ParkingLot enum
   */
  private mapAmenities(submittedAmenities: string[]): Array<
    | 'CCTV Surveillance'
    | 'Covered Parking'
    | 'EV Charging'
    | 'Disabled Parking'
    | 'Security Staff'
    | 'Car Wash'
    | 'Washroom'
    | 'Drinking Water'
    | 'Lift Access'
    | 'Fire Safety System'
  > {
    const validAmenities: Array<
      | 'CCTV Surveillance'
      | 'Covered Parking'
      | 'EV Charging'
      | 'Disabled Parking'
      | 'Security Staff'
      | 'Car Wash'
      | 'Washroom'
      | 'Drinking Water'
      | 'Lift Access'
      | 'Fire Safety System'
    > = [
      'CCTV Surveillance',
      'Covered Parking',
      'EV Charging',
      'Disabled Parking',
      'Security Staff',
      'Car Wash',
      'Washroom',
      'Drinking Water',
      'Lift Access',
      'Fire Safety System',
    ];

    const mapped = new Set<
      | 'CCTV Surveillance'
      | 'Covered Parking'
      | 'EV Charging'
      | 'Disabled Parking'
      | 'Security Staff'
      | 'Car Wash'
      | 'Washroom'
      | 'Drinking Water'
      | 'Lift Access'
      | 'Fire Safety System'
    >();

    for (const a of submittedAmenities) {
      if (validAmenities.includes(a as (typeof validAmenities)[number])) {
        mapped.add(a as (typeof validAmenities)[number]);
      } else if (a === 'Accessible Parking') {
        mapped.add('Disabled Parking');
      } else if (a === 'Security Personnel') {
        mapped.add('Security Staff');
      }
    }

    return Array.from(mapped);
  }

  /**
   * Helper: Map vehicle type to ParkingZone / ParkingSlot enum
   */
  private mapZoneVehicleType(type?: string): 'Bike' | 'Car' | 'SUV' | 'EV' | 'Accessible' {
    if (!type) return 'Car';
    const lower = type.toLowerCase();
    if (lower.includes('bike') || lower.includes('two') || lower.includes('motorcycle')) return 'Bike';
    if (lower.includes('suv') || lower.includes('large') || lower.includes('truck')) return 'SUV';
    if (lower.includes('ev') || lower.includes('electric')) return 'EV';
    if (lower.includes('access') || lower.includes('disabled')) return 'Accessible';
    return 'Car';
  }

  /**
   * Retrieve approved submissions eligible for official Parking Lot creation
   */
  public async getEligibleApprovedSubmissions(search?: string): Promise<ParkingFacilitySubmission[]> {
    const query: Record<string, unknown> = {
      submissionStatus: 'Approved',
      officialParkingLotId: null,
    };

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { facilityName: { $regex: term, $options: 'i' } },
        { submissionReference: { $regex: term, $options: 'i' } },
        { 'location.city': { $regex: term, $options: 'i' } },
      ];
    }

    const submissions = await (
      ParkingFacilitySubmissionModel as mongoose.Model<ParkingFacilitySubmission>
    )
      .find(query)
      .populate('ownerId', 'fullName email mobileNumber')
      .sort({ approvedAt: -1, createdAt: -1 })
      .lean();

    return submissions;
  }

  /**
   * Create an official Parking Lot and complete structure (Floors, Zones, Slots) from an approved submission
   */
  public async createOfficialParkingLotFromSubmission(
    submissionId: string,
    adminUserId: string,
    ipAddress?: string,
  ): Promise<{
    parkingLot: ParkingLot;
    floorsCount: number;
    zonesCount: number;
    slotsCount: number;
  }> {
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      throw new AppError('Invalid submission ID format.', 400, 'INVALID_ID');
    }

    // 1. Fetch submission
    const submission = await (
      ParkingFacilitySubmissionModel as mongoose.Model<ParkingFacilitySubmission>
    ).findById(submissionId);

    if (!submission) {
      throw new AppError('Facility submission not found.', 404, 'SUBMISSION_NOT_FOUND');
    }

    // 2. Business Rule: Only Approved submissions can be converted
    if (submission.submissionStatus !== 'Approved') {
      throw new AppError(
        `Only submissions in "Approved" status can be converted to an official Parking Lot. Current status: "${submission.submissionStatus}".`,
        400,
        'SUBMISSION_NOT_APPROVED',
      );
    }

    // 3. Business Rule: Prevent duplicate conversion
    if (submission.officialParkingLotId) {
      throw new AppError(
        'An official Parking Lot has already been created for this submission.',
        409,
        'SUBMISSION_ALREADY_CONVERTED',
      );
    }

    const existingLotBySubmission = await (ParkingLotModel as mongoose.Model<ParkingLot>).findOne({
      submissionId: submission._id,
    });
    if (existingLotBySubmission) {
      throw new AppError(
        'An official Parking Lot already exists for this submission.',
        409,
        'SUBMISSION_ALREADY_CONVERTED',
      );
    }

    // 4. Data validation
    if (!submission.facilityName || !submission.facilityName.trim()) {
      throw new AppError('Facility submission is missing a facility name.', 400, 'INVALID_SUBMISSION_DATA');
    }

    const totalCapacity = submission.capacity?.totalSlots || 0;
    if (totalCapacity < 1) {
      throw new AppError('Approved facility capacity must be at least 1 slot.', 400, 'INVALID_CAPACITY');
    }

    const floors = submission.floors || [];
    if (floors.length === 0) {
      throw new AppError('Facility submission must have at least one floor defined.', 400, 'NO_FLOORS_DEFINED');
    }

    // Floor capacity sum validation
    const floorSlotSum = floors.reduce((acc, f) => acc + (f.slotCount || 0), 0);
    if (floorSlotSum !== totalCapacity) {
      throw new AppError(
        `Floor slot counts sum (${floorSlotSum}) does not equal total approved facility capacity (${totalCapacity}). Cannot create official parking structure.`,
        400,
        'CAPACITY_MISMATCH',
      );
    }

    // Zone capacity sum validation (where zones exist per floor)
    const submittedZones = submission.zones || [];
    for (const fl of floors) {
      const flNameNorm = fl.floorName.trim().toLowerCase();
      const floorZones = submittedZones.filter((z) => z.floorName.trim().toLowerCase() === flNameNorm);

      if (floorZones.length > 0) {
        const zoneSlotSum = floorZones.reduce((acc, z) => acc + (z.slotCount || 0), 0);
        if (zoneSlotSum !== fl.slotCount) {
          throw new AppError(
            `Floor "${fl.floorName}" has capacity ${fl.slotCount}, but its zones sum to ${zoneSlotSum}. Zone capacities must match the corresponding floor capacity.`,
            400,
            'ZONE_CAPACITY_MISMATCH',
          );
        }
      }
    }

    // Verify Admin user & role for audit log
    const adminUser = await (UserModel as mongoose.Model<User>).findById(adminUserId);
    if (!adminUser) {
      throw new AppError('Admin user not found.', 401, 'USER_NOT_FOUND');
    }

    // Set up MongoDB session if supported
    let mongoSession: mongoose.ClientSession | null = null;
    let useTransaction = false;

    try {
      mongoSession = await mongoose.startSession();
      mongoSession.startTransaction();
      useTransaction = true;
    } catch {
      useTransaction = false;
      if (mongoSession) {
        await mongoSession.endSession();
        mongoSession = null;
      }
    }

    // Rollback cleanup stack in case transactions are unsupported
    let createdLotId: mongoose.Types.ObjectId | null = null;
    const createdFloorIds: mongoose.Types.ObjectId[] = [];
    const createdZoneIds: mongoose.Types.ObjectId[] = [];

    try {
      // 5. Create Official ParkingLot document
      // Note: Must remain Inactive initially (Rule 5 & 6)
      const locAddress =
        submission.location.address ||
        [
          submission.location.addressLine1,
          submission.location.addressLine2,
          submission.location.areaLocality,
        ]
          .filter(Boolean)
          .join(', ') ||
        'Official Location';

      const lotData: Partial<ParkingLot> = {
        ownerId: submission.ownerId,
        parkingName: submission.facilityName.trim(),
        description: submission.detailedDescription || submission.shortDescription || null,
        address: locAddress,
        city: submission.location.city || 'City',
        state: submission.location.state || 'State',
        country: 'India',
        postalCode: submission.location.postalCode || '000000',
        latitude: submission.location.latitude ?? 23.0225,
        longitude: submission.location.longitude ?? 72.5714,
        location: {
          type: 'Point',
          coordinates: [submission.location.longitude ?? 72.5714, submission.location.latitude ?? 23.0225],
        },
        contactNumber: submission.contactPhone || '0000000000',
        supportEmail: submission.contactEmail || null,
        openingTime: submission.operatingInfo?.openingTime || '00:00',
        closingTime: submission.operatingInfo?.closingTime || '23:59',
        isOpen24Hours: Boolean(submission.operatingInfo?.isOpen24x7),
        hourlyRate: submission.pricing?.carHourlyRate || 0,
        gracePeriodMinutes: submission.pricing?.gracePeriodMinutes ?? 15,
        totalFloors: floors.length,
        totalSlots: totalCapacity,
        availableSlots: totalCapacity,
        occupiedSlots: 0,
        reservedSlots: 0,
        occupancyPercentage: 0,
        averageRating: 0,
        totalReviews: 0,
        amenities: this.mapAmenities(submission.amenities || []),
        parkingImages: (submission.photos || []).map((p) => p.url).filter(Boolean),
        isVerified: true,
        parkingStatus: 'Inactive', // Strictly Inactive on initial structure creation
        submissionId: submission._id,
      };

      let createdLot: ParkingLot & { _id: mongoose.Types.ObjectId };

      if (useTransaction && mongoSession) {
        const [lot] = await (ParkingLotModel as mongoose.Model<ParkingLot>).create([lotData], {
          session: mongoSession,
        });
        createdLot = lot as unknown as ParkingLot & { _id: mongoose.Types.ObjectId };
      } else {
        const lot = await (ParkingLotModel as mongoose.Model<ParkingLot>).create(lotData);
        createdLot = lot as unknown as ParkingLot & { _id: mongoose.Types.ObjectId };
      }

      createdLotId = createdLot._id;

      // Track slot numbers within the lot to guarantee compound uniqueness IDX_SlotNumber
      const usedSlotNumbers = new Set<string>();
      let totalSlotsCreated = 0;
      let totalZonesCreated = 0;

      // 6. Create Floors, Zones, and Slots
      for (let fIdx = 0; fIdx < floors.length; fIdx++) {
        const fl = floors[fIdx]!;
        const flNameNorm = fl.floorName.trim().toLowerCase();
        const floorZones = submittedZones.filter((z) => z.floorName.trim().toLowerCase() === flNameNorm);

        const floorDocData: Partial<ParkingFloor> = {
          parkingLotId: createdLot._id,
          floorName: fl.floorName.trim(),
          floorNumber: fl.floorNumber >= 0 ? fl.floorNumber : fIdx,
          description: fl.floorDescription || null,
          totalZones: floorZones.length > 0 ? floorZones.length : 1,
          totalSlots: fl.slotCount,
          availableSlots: fl.slotCount,
          occupiedSlots: 0,
          reservedSlots: 0,
          occupancyPercentage: 0,
          floorStatus: 'Active',
        };

        let createdFloor: ParkingFloor & { _id: mongoose.Types.ObjectId };
        if (useTransaction && mongoSession) {
          const [floor] = await (ParkingFloorModel as mongoose.Model<ParkingFloor>).create([floorDocData], {
            session: mongoSession,
          });
          createdFloor = floor as unknown as ParkingFloor & { _id: mongoose.Types.ObjectId };
        } else {
          const floor = await (ParkingFloorModel as mongoose.Model<ParkingFloor>).create(floorDocData);
          createdFloor = floor as unknown as ParkingFloor & { _id: mongoose.Types.ObjectId };
        }

        createdFloorIds.push(createdFloor._id);

        // 7. Zones for this floor
        // Case A: Owner specified sub-zones
        // Case B: Open-plan floor without zones -> generate default "General" zone
        const targetZones =
          floorZones.length > 0
            ? floorZones
            : [
                {
                  zoneName: 'General',
                  floorName: fl.floorName,
                  slotCount: fl.slotCount,
                  zoneType: 'Standard',
                  supportedVehicleType: 'Car',
                  description: 'General Parking',
                },
              ];

        for (let zIdx = 0; zIdx < targetZones.length; zIdx++) {
          const zn = targetZones[zIdx]!;
          // Determine clean zoneCode: e.g. "A", "B", "C" or alphanumeric code
          let zoneCode = zn.zoneName
            .replace(/zone\s*/i, '')
            .trim()
            .toUpperCase();
          if (!zoneCode || zoneCode.length > 4) {
            zoneCode = String.fromCharCode(65 + (totalZonesCreated % 26));
          }

          const zoneVehicle = this.mapZoneVehicleType(zn.supportedVehicleType || zn.zoneType);

          const zoneDocData: Partial<ParkingZone> = {
            parkingLotId: createdLot._id,
            floorId: createdFloor._id,
            zoneName: zn.zoneName.trim(),
            zoneCode,
            description: ('description' in zn ? (zn as { description?: string }).description : null) || `Zone ${zoneCode} on ${createdFloor.floorName}`,
            vehicleType: zoneVehicle,
            totalSlots: zn.slotCount,
            availableSlots: zn.slotCount,
            occupiedSlots: 0,
            reservedSlots: 0,
            occupancyPercentage: 0,
            zoneStatus: 'Active',
          };

          let createdZone: ParkingZone & { _id: mongoose.Types.ObjectId };
          if (useTransaction && mongoSession) {
            const [zone] = await (ParkingZoneModel as mongoose.Model<ParkingZone>).create([zoneDocData], {
              session: mongoSession,
            });
            createdZone = zone as unknown as ParkingZone & { _id: mongoose.Types.ObjectId };
          } else {
            const zone = await (ParkingZoneModel as mongoose.Model<ParkingZone>).create(zoneDocData);
            createdZone = zone as unknown as ParkingZone & { _id: mongoose.Types.ObjectId };
          }

          createdZoneIds.push(createdZone._id);
          totalZonesCreated++;

          // 8. Generate individual Parking Slots for this Zone
          // Numbering follows the documented pattern: ZoneCode + 2-digit number (e.g. A01, A02 ... A20)
          const slotDocsToInsert: Array<Partial<ParkingSlot>> = [];

          for (let sIdx = 1; sIdx <= zn.slotCount; sIdx++) {
            const numPart = String(sIdx).padStart(2, '0');
            let candidateSlotNum = `${zoneCode}${numPart}`;

            // Ensure slotNumber is unique within the entire Parking Lot (per IDX_SlotNumber)
            if (usedSlotNumbers.has(candidateSlotNum)) {
              candidateSlotNum = `F${createdFloor.floorNumber + 1}-${zoneCode}${numPart}`;
            }
            usedSlotNumbers.add(candidateSlotNum);

            // Determine slotType from zone characteristics
            let slotType: 'Standard' | 'Compact' | 'Premium' | 'EV Charging' | 'Accessible' | 'Reserved' =
              'Standard';
            const znTypeLower = ((zn.zoneType || '') + ' ' + (zn.supportedVehicleType || '')).toLowerCase();
            if (znTypeLower.includes('ev')) slotType = 'EV Charging';
            else if (znTypeLower.includes('access') || znTypeLower.includes('disabled')) slotType = 'Accessible';
            else if (znTypeLower.includes('reserve')) slotType = 'Reserved';
            else if (znTypeLower.includes('vip') || znTypeLower.includes('suv') || znTypeLower.includes('large')) slotType = 'Premium';
            else if (znTypeLower.includes('compact')) slotType = 'Compact';

            // Unique QR Identifier (per appendix-8.txt line 5266-5277)
            const qrIdentifier = `PK-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${sIdx}`;

            slotDocsToInsert.push({
              parkingLotId: createdLot._id,
              floorId: createdFloor._id,
              zoneId: createdZone._id,
              slotNumber: candidateSlotNum,
              slotLabel: candidateSlotNum,
              slotType,
              supportedVehicleType: zoneVehicle === 'Accessible' ? 'Car' : zoneVehicle,
              slotStatus: 'Available',
              qrIdentifier,
            });
          }

          if (useTransaction && mongoSession) {
            await (ParkingSlotModel as mongoose.Model<ParkingSlot>).insertMany(slotDocsToInsert, {
              session: mongoSession,
            });
          } else {
            await (ParkingSlotModel as mongoose.Model<ParkingSlot>).insertMany(slotDocsToInsert);
          }

          totalSlotsCreated += slotDocsToInsert.length;
        }
      }

      // 9. Update the original submission record with officialParkingLotId
      if (useTransaction && mongoSession) {
        await (ParkingFacilitySubmissionModel as mongoose.Model<ParkingFacilitySubmission>).updateOne(
          { _id: submission._id },
          { $set: { officialParkingLotId: createdLot._id } },
          { session: mongoSession },
        );
        await mongoSession.commitTransaction();
      } else {
        await (ParkingFacilitySubmissionModel as mongoose.Model<ParkingFacilitySubmission>).updateOne(
          { _id: submission._id },
          { $set: { officialParkingLotId: createdLot._id } },
        );
      }

      // 10. Record Audit Log entry
      await AuditLogModel.create({
        userId: adminUser._id,
        roleId: adminUser.roleId,
        actionCode: 'OFFICIAL_PARKING_LOT_CREATED',
        module: 'Parking Management',
        actionTitle: 'Official Parking Lot Created',
        description: `Administrator ${adminUser.fullName} created official Parking Lot "${createdLot.parkingName}" from approved submission ${submission.submissionReference}`,
        targetCollection: 'parkingLots',
        targetDocumentId: createdLot._id,
        parkingLotId: createdLot._id,
        ipAddress: normalizeIp(ipAddress),
        actionStatus: 'Success',
        metadata: {
          submissionId: submission._id.toString(),
          submissionReference: submission.submissionReference,
          parkingLotId: createdLot._id.toString(),
          parkingName: createdLot.parkingName,
          totalFloors: floors.length,
          totalZones: totalZonesCreated,
          totalSlots: totalSlotsCreated,
          initialStatus: 'Inactive',
        },
      });

      // In-App Notification to Owner
      try {
        await notificationService.createNotification({
          userId: submission.ownerId,
          senderId: adminUser._id,
          notificationType: 'Parking Facility',
          eventType: 'Parking Facility Structure Created',
          title: 'Official Parking Structure Created',
          message: `The official structure for "${createdLot.parkingName}" (${totalSlotsCreated} slots across ${floors.length} floor${floors.length === 1 ? '' : 's'}) has been generated by the Administrator.`,
          priority: 'Normal',
          actionUrl: `/owner/dashboard`,
          metadata: {
            parkingLotId: createdLot._id.toString(),
            parkingName: createdLot.parkingName,
            totalSlots: totalSlotsCreated,
            totalFloors: floors.length,
            status: 'Inactive',
          },
        });
      } catch (notifErr) {
        console.warn('Failed to send structure creation notification:', notifErr);
      }

      return {
        parkingLot: createdLot,
        floorsCount: floors.length,
        zonesCount: totalZonesCreated,
        slotsCount: totalSlotsCreated,
      };
    } catch (creationError) {
      // Abort transaction or run manual rollback
      if (useTransaction && mongoSession) {
        await mongoSession.abortTransaction();
      } else if (createdLotId) {
        // Safe rollback stack
        try {
          await (ParkingSlotModel as mongoose.Model<ParkingSlot>).deleteMany({ parkingLotId: createdLotId });
          await (ParkingZoneModel as mongoose.Model<ParkingZone>).deleteMany({ parkingLotId: createdLotId });
          await (ParkingFloorModel as mongoose.Model<ParkingFloor>).deleteMany({ parkingLotId: createdLotId });
          await (ParkingLotModel as mongoose.Model<ParkingLot>).deleteOne({ _id: createdLotId });
          await (ParkingFacilitySubmissionModel as mongoose.Model<ParkingFacilitySubmission>).updateOne(
            { _id: submission._id },
            { $set: { officialParkingLotId: null } },
          );
        } catch (rollbackErr) {
          console.error('Manual rollback encountered an error:', rollbackErr);
        }
      }

      throw creationError;
    } finally {
      if (mongoSession) {
        await mongoSession.endSession();
      }
    }
  }

  /**
   * Retrieve paginated official parking lots
   */
  public async getOfficialParkingLots(
    filter: GetOfficialParkingLotsFilter = {},
  ): Promise<PaginatedParkingLotsResult> {
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 10));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (filter.status && filter.status !== 'All') {
      query.parkingStatus = filter.status;
    }

    if (filter.ownerId) {
      query.ownerId = new mongoose.Types.ObjectId(filter.ownerId);
    }

    if (filter.search && filter.search.trim()) {
      const term = filter.search.trim();
      query.$or = [
        { parkingName: { $regex: term, $options: 'i' } },
        { city: { $regex: term, $options: 'i' } },
        { state: { $regex: term, $options: 'i' } },
        { address: { $regex: term, $options: 'i' } },
      ];
    }

    const [total, parkingLots] = await Promise.all([
      (ParkingLotModel as mongoose.Model<ParkingLot>).countDocuments(query),
      (ParkingLotModel as mongoose.Model<ParkingLot>)
        .find(query)
        .populate('ownerId', 'fullName email mobileNumber')
        .populate('submissionId', 'submissionReference submissionStatus facilityType')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return {
      parkingLots: parkingLots as ParkingLot[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieve official parking lot by ID with owner and submission metadata
   */
  public async getOfficialParkingLotById(
    id: string,
    ownerId?: string,
  ): Promise<ParkingLot & { sourceSubmission?: ParkingFacilitySubmission | null }> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid parking lot ID format.', 400, 'INVALID_ID');
    }

    const lot = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .findById(id)
      .populate('ownerId', 'fullName email mobileNumber')
      .populate('submissionId')
      .lean();

    if (!lot) {
      throw new AppError('Parking lot not found.', 404, 'PARKING_LOT_NOT_FOUND');
    }

    if (ownerId) {
      const lotOwnerId = (lot.ownerId as { _id?: mongoose.Types.ObjectId })?._id?.toString() || lot.ownerId?.toString();
      if (lotOwnerId !== ownerId) {
        throw new AppError('Access denied: You do not own this parking facility.', 403, 'FORBIDDEN');
      }
    }

    return lot as unknown as ParkingLot & { sourceSubmission?: ParkingFacilitySubmission | null };
  }

  /**
   * Retrieve full official structural hierarchy: Lot -> Floors -> Zones -> Slots
   */
  public async getOfficialParkingLotHierarchy(
    id: string,
    ownerId?: string,
  ): Promise<OfficialParkingLotHierarchy> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid parking lot ID format.', 400, 'INVALID_ID');
    }

    const lot = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .findById(id)
      .populate('ownerId', 'fullName email mobileNumber')
      .populate('submissionId', 'submissionReference submissionStatus facilityType')
      .lean();

    if (!lot) {
      throw new AppError('Parking lot not found.', 404, 'PARKING_LOT_NOT_FOUND');
    }

    if (ownerId) {
      const lotOwnerId = (lot.ownerId as { _id?: mongoose.Types.ObjectId })?._id?.toString() || lot.ownerId?.toString();
      if (lotOwnerId !== ownerId) {
        throw new AppError('Access denied: You do not own this parking facility.', 403, 'FORBIDDEN');
      }
    }

    const lotObjectId = new mongoose.Types.ObjectId(id);

    // Fetch all floors, zones, and slots in parallel
    const [floors, zones, slots] = await Promise.all([
      (ParkingFloorModel as mongoose.Model<ParkingFloor>)
        .find({ parkingLotId: lotObjectId })
        .sort({ floorNumber: 1, floorName: 1 })
        .lean(),
      (ParkingZoneModel as mongoose.Model<ParkingZone>)
        .find({ parkingLotId: lotObjectId })
        .sort({ zoneCode: 1, zoneName: 1 })
        .lean(),
      (ParkingSlotModel as mongoose.Model<ParkingSlot>)
        .find({ parkingLotId: lotObjectId })
        .sort({ slotNumber: 1 })
        .lean(),
    ]);

    // Build hierarchy tree
    const hierarchyFloors: OfficialHierarchyFloor[] = floors.map((fl) => {
      const flIdStr = fl._id.toString();
      const floorZones = zones.filter((z) => z.floorId.toString() === flIdStr);

      const mappedZones: OfficialHierarchyZone[] = floorZones.map((zn) => {
        const znIdStr = zn._id.toString();
        const zoneSlots = slots.filter((s) => s.zoneId.toString() === znIdStr);

        return {
          _id: znIdStr,
          zoneName: zn.zoneName,
          zoneCode: zn.zoneCode,
          vehicleType: zn.vehicleType,
          totalSlots: zn.totalSlots,
          availableSlots: zn.availableSlots,
          zoneStatus: zn.zoneStatus,
          slots: zoneSlots.map((s) => ({
            _id: s._id.toString(),
            slotNumber: s.slotNumber,
            slotLabel: s.slotLabel,
            slotType: s.slotType,
            supportedVehicleType: s.supportedVehicleType,
            slotStatus: s.slotStatus,
            qrIdentifier: s.qrIdentifier,
            remarks: s.remarks,
          })),
        };
      });

      return {
        _id: flIdStr,
        floorName: fl.floorName,
        floorNumber: fl.floorNumber,
        description: fl.description,
        totalZones: fl.totalZones,
        totalSlots: fl.totalSlots,
        availableSlots: fl.availableSlots,
        floorStatus: fl.floorStatus,
        zones: mappedZones,
      };
    });

    const stats = {
      totalFloors: floors.length,
      totalZones: zones.length,
      totalSlots: slots.length,
      availableSlots: slots.filter((s) => s.slotStatus === 'Available').length,
      occupiedSlots: slots.filter((s) => s.slotStatus === 'Occupied').length,
      reservedSlots: slots.filter((s) => s.slotStatus === 'Reserved').length,
    };

    return {
      parkingLot: lot as ParkingLot,
      floors: hierarchyFloors,
      stats,
    };
  }
}

export const parkingLotService = new ParkingLotService();
