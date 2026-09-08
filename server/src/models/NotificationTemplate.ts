import mongoose, { type InferSchemaType } from 'mongoose';

const notificationTypeValues = [
  'Booking',
  'Payment',
  'Refund',
  'No Show',
  'Overstay',
  'Walk-in',
  'Parking Owner Registration',
  'Review',
  'Incident',
  'Account',
  'System',
] as const;

const deliveryChannelValues = ['In-App', 'Email', 'Push Notification'] as const;

const notificationTemplateSchema = new mongoose.Schema(
  {
    templateName: {
      type: String,
      required: true,
      unique: true,
      maxlength: 100,
      trim: true,
    },

    templateCode: {
      type: String,
      required: true,
      maxlength: 100,
      trim: true,
      uppercase: true,
      match: /^[A-Z][A-Z_]*$/,
      immutable: true,
    },

    notificationType: {
      type: String,
      required: true,
      enum: notificationTypeValues,
      default: 'System',
    },

    deliveryChannel: {
      type: String,
      required: true,
      enum: deliveryChannelValues,
      default: 'In-App',
    },

    subject: {
      type: String,
      default: null,
      maxlength: 150,
      trim: true,
    },

    title: {
      type: String,
      required: true,
      maxlength: 100,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      maxlength: 5000,
      trim: true,
    },

    placeholders: {
      type: [String],
      default: [],
    },

    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    collection: 'notificationTemplates',
    timestamps: true,
  },
);

notificationTemplateSchema.index({ templateName: 1 }, { name: 'IDX_TemplateName', unique: true });

notificationTemplateSchema.index({ templateCode: 1 }, { name: 'IDX_TemplateCode', unique: true });

notificationTemplateSchema.index({ notificationType: 1 }, { name: 'IDX_Type' });

notificationTemplateSchema.index({ deliveryChannel: 1 }, { name: 'IDX_Channel' });

notificationTemplateSchema.index({ isActive: 1 }, { name: 'IDX_Status' });

export type NotificationTemplate = InferSchemaType<typeof notificationTemplateSchema>;

export const NotificationTemplateModel =
  mongoose.models.NotificationTemplate ??
  mongoose.model<NotificationTemplate>('NotificationTemplate', notificationTemplateSchema);
