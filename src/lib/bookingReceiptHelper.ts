import type {
  CustomerBookingItem,
  VerifyBookingPaymentResponse,
} from '@/api/customerParking.api';

export function buildReceiptConfirmationFromBooking(
  booking: CustomerBookingItem,
  customerUser?: {
    fullName?: string | null;
    email?: string | null;
    mobileNumber?: string | null;
  } | null,
): VerifyBookingPaymentResponse | null {
  if (!booking.payment) return null;

  const paymentStatusNormalized: 'SUCCESSFUL' | 'REFUNDED' | 'FAILED' =
    booking.payment.paymentStatus === 'REFUNDED'
      ? 'REFUNDED'
      : booking.payment.paymentStatus === 'SUCCESSFUL'
        ? 'SUCCESSFUL'
        : 'FAILED';

  return {
    bookingStatus:
      booking.bookingStatus === 'Cancelled' || booking.bookingStatus === 'No Show'
        ? 'Cancelled'
        : 'Confirmed',
    bookingReference: booking.bookingReference,
    bookingId: booking.bookingId,
    qrCode: booking.qrCode,
    paymentReference: booking.payment.paymentReference,
    paymentStatus: paymentStatusNormalized,
    transactionId: booking.payment.transactionId,
    message: `Official receipt for booking ${booking.bookingReference}`,
    customerDetails: {
      fullName: customerUser?.fullName || 'Valued Customer',
      email: customerUser?.email || '',
      mobileNumber: customerUser?.mobileNumber || '',
    },
    paymentDetails: {
      paymentReference: booking.payment.paymentReference,
      paymentMethod: booking.payment.paymentMethod,
      paymentStatus: paymentStatusNormalized,
      paymentDate: booking.payment.paymentDate || booking.createdAt,
      razorpayOrderId: booking.payment.razorpayOrderId || 'N/A',
      razorpayPaymentId: booking.payment.razorpayPaymentId || 'N/A',
      paymentVerificationReference:
        booking.payment.transactionId || booking.payment.paymentReference,
    },
    bookingDetails: {
      facilityName: booking.parkingName,
      address: booking.parkingAddress,
      floorName: booking.floor.floorName,
      zoneName: booking.zone.zoneName,
      zoneCode: booking.zone.zoneCode,
      slotNumber: booking.currentSlot.slotNumber,
      slotLabel: booking.currentSlot.slotLabel,
      vehicleNumber: booking.vehicle.vehicleNumber,
      vehicleType: booking.vehicle.vehicleType,
      vehicleBrand: booking.vehicle.vehicleBrand,
      vehicleModel: booking.vehicle.vehicleModel,
      bookingType: booking.bookingType,
      scheduledEntryTime: booking.scheduledEntryTime,
      scheduledExitTime: booking.scheduledExitTime,
      gracePeriodMinutes: booking.gracePeriodMinutes,
      bookingDurationMinutes: booking.bookingDurationMinutes,
      parkingRateAtBooking: booking.parkingRateAtBooking,
      baseAmount: booking.baseAmount,
      taxes: 0,
      discountAmount: 0,
      additionalCharges: booking.additionalCharges,
      totalAmount: booking.totalAmount,
    },
  };
}

