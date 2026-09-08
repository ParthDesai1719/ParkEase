import mongoose, { type InferSchemaType } from 'mongoose';

const paymentTypeValues = [
  'Parking Booking',
  'Parking Booking Extension',
  'Overstay Charges',
  'Parking Owner Registration Fee',
] as const;

const paymentTypeCodeValues = ['BOOKING', 'EXTENSION', 'OVERSTAY', 'OWNER_REGISTRATION'] as const;

const paymentMethodValues = ['RAZORPAY', 'CASH'] as const;

const paymentStatusValues = [
  'PENDING',
  'SUCCESSFUL',
  'FAILED',
  'REFUNDED',
  'CASH_REVERSAL_PENDING',
] as const;

const refundStatusValues = [
  'Refund Pending',
  'Refund Processing',
  'Refund Completed',
  'Refund Failed',
] as const;

const refundSchema = new mongoose.Schema(
  {
    refundReference: {
      type: String,
      required: true,
      trim: true,
    },

    refundAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    refundStatus: {
      type: String,
      required: true,
      enum: refundStatusValues,
    },

    refundReason: {
      type: String,
      required: true,
      trim: true,
    },

    gatewayRefundId: {
      type: String,
      default: null,
      trim: true,
    },

    refundTransactionId: {
      type: String,
      default: null,
      trim: true,
    },

    initiatedAt: {
      type: Date,
      required: true,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    remarks: {
      type: String,
      default: null,
      maxlength: 500,
    },
  },
  {
    _id: false,
  },
);

const paymentSchema = new mongoose.Schema(
  {
    paymentReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      immutable: true,
    },

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },

    ownerApplicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OwnerApplication',
      default: null,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    parkingLotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLot',
      default: null,
    },

    paymentType: {
      type: String,
      required: true,
      enum: paymentTypeValues,
      immutable: true,
    },

    paymentTypeCode: {
      type: String,
      required: true,
      enum: paymentTypeCodeValues,
      immutable: true,
    },

    paymentMethod: {
      type: String,
      required: true,
      enum: paymentMethodValues,
    },

    paymentStatus: {
      type: String,
      required: true,
      enum: paymentStatusValues,
      default: 'PENDING',
    },

    transactionId: {
      type: String,
      default: null,
      trim: true,
    },

    gatewayOrderId: {
      type: String,
      default: null,
      trim: true,
    },

    gatewayPaymentId: {
      type: String,
      default: null,
      trim: true,
    },

    gatewaySignature: {
      type: String,
      default: null,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    additionalCharges: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    refundAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    refunds: {
      type: [refundSchema],
      required: true,
      default: [],
    },

    paymentDate: {
      type: Date,
      default: null,
    },

    refundDate: {
      type: Date,
      default: null,
    },

    remarks: {
      type: String,
      default: null,
      maxlength: 500,
    },
  },
  {
    collection: 'payments',
    timestamps: true,
  },
);

paymentSchema.index(
  { paymentReference: 1 },
  {
    name: 'IDX_PaymentReference',
    unique: true,
  },
);

paymentSchema.index(
  { bookingId: 1 },
  {
    name: 'IDX_Booking',
  },
);

paymentSchema.index(
  { ownerApplicationId: 1 },
  {
    name: 'IDX_OwnerApplication',
  },
);

paymentSchema.index(
  { customerId: 1 },
  {
    name: 'IDX_Customer',
  },
);

paymentSchema.index(
  { ownerId: 1 },
  {
    name: 'IDX_Owner',
  },
);

paymentSchema.index(
  { parkingLotId: 1 },
  {
    name: 'IDX_ParkingLot',
  },
);

paymentSchema.index(
  { paymentStatus: 1 },
  {
    name: 'IDX_Status',
  },
);

paymentSchema.index(
  { paymentTypeCode: 1 },
  {
    name: 'IDX_Type',
  },
);

paymentSchema.index(
  { paymentDate: -1 },
  {
    name: 'IDX_Date',
  },
);

paymentSchema.index(
  { transactionId: 1 },
  {
    name: 'IDX_Transaction',
    unique: true,
    sparse: true,
  },
);

paymentSchema.index(
  { gatewayOrderId: 1 },
  {
    name: 'IDX_GatewayOrder',
    unique: true,
    sparse: true,
  },
);

paymentSchema.index(
  { gatewayPaymentId: 1 },
  {
    name: 'IDX_GatewayPayment',
    unique: true,
    sparse: true,
  },
);

export type Payment = InferSchemaType<typeof paymentSchema>;

export type PaymentRefund = InferSchemaType<typeof refundSchema>;

export const PaymentModel =
  mongoose.models.Payment ?? mongoose.model<Payment>('Payment', paymentSchema);
