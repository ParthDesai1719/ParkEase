import crypto from 'node:crypto';
import type mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { EmailLogModel } from '../models/EmailLog.js';

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: nodemailer.SendMailOptions['attachments'];
  emailType?:
    | 'CUSTOMER_COMMUNICATION'
    | 'BOOKING_CONFIRMATION'
    | 'BOOKING_CANCELLATION'
    | 'WALK_IN_BOOKING'
    | 'PAYMENT_RECEIVED'
    | 'OWNER_REGISTRATION'
    | 'INCIDENT_NOTIFICATION'
    | 'SYSTEM_NOTIFICATION';
  senderId?: mongoose.Types.ObjectId | null;
  parkingLotId?: mongoose.Types.ObjectId | null;
  bookingId?: mongoose.Types.ObjectId | null;
  templateId?: mongoose.Types.ObjectId | null;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isUsingFallback = false;

  constructor() {
    this.initTransporter();
  }

  private initTransporter(): void {
    if (env.SMTP_HOST) {
      const isSecure = env.SMTP_SECURE !== undefined ? env.SMTP_SECURE : env.SMTP_PORT === 465;
      const auth =
        env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined;

      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: isSecure,
        ...(auth ? { auth } : {}),
      });
      this.isUsingFallback = false;
      console.log(
        `[EmailService] SMTP transport configured -> ${env.SMTP_HOST}:${env.SMTP_PORT} (secure: ${isSecure})`,
      );
    } else {
      if (env.NODE_ENV === 'production') {
        throw new Error(
          '[EmailService] Fatal configuration error: SMTP transport must be configured in production environment (SMTP_HOST is required).',
        );
      }

      // Safe development fallback: in-memory JSON mock transporter that does not throw or send network packets
      this.transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
      this.isUsingFallback = true;
      console.log(
        '[EmailService] SMTP_HOST not set. Running in safe development fallback mode (jsonTransport).',
      );
    }
  }

  public isFallbackActive(): boolean {
    return this.isUsingFallback;
  }

  public async verifyConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.transporter) {
      return { success: false, message: 'Email transporter is not initialized.' };
    }
    if (this.isUsingFallback) {
      return {
        success: true,
        message: 'Email service is running in development fallback mode (jsonTransport).',
      };
    }
    try {
      await this.transporter.verify();
      return { success: true, message: 'SMTP connection established and verified successfully.' };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown SMTP verification failure';
      return { success: false, message: `SMTP connection verification failed: ${errorMsg}` };
    }
  }

  public async sendEmail(options: SendMailOptions): Promise<boolean> {
    const configuredFrom = `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`;
    const fromAddress = options.from || process.env.SMTP_FROM || configuredFrom;
    const emailRef = `EMAIL-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const emailType = options.emailType || 'SYSTEM_NOTIFICATION';

    // Normalize recipients
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    const extractEmailAddress = (addr: string): string => {
      const matches = [...addr.matchAll(/<([^>]+)>/g)];
      const emailWithAt = matches.map((m) => m[1]).find((val) => val && val.includes('@'));
      if (emailWithAt) return emailWithAt.trim().toLowerCase();
      const match = addr.match(/<([^>]+)>/);
      return (match?.[1] ?? addr).trim().toLowerCase();
    };
    const recipientEmails = recipients.map(extractEmailAddress);

    // Ensure plain-text fallback exists if only HTML was provided
    const plainText =
      options.text ||
      (options.html
        ? options.html
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        : '');

    let deliveryStatus: 'Pending' | 'Sending' | 'Sent' | 'Failed' | 'Retrying';
    let failureReason: string | null = null;
    let providerMessageId: string | null = null;

    try {
      if (!this.transporter) {
        throw new Error('Email transporter is not initialized');
      }

      const mailOptions: nodemailer.SendMailOptions = {
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        text: plainText,
        html: options.html,
        replyTo: options.replyTo,
        cc: options.cc,
        bcc: options.bcc,
        attachments: options.attachments,
      };

      const info = await this.transporter.sendMail(mailOptions);

      providerMessageId = info?.messageId || null;

      // Check SMTP provider rejection semantics
      if (
        info?.rejected &&
        Array.isArray(info.rejected) &&
        info.rejected.length > 0 &&
        (!info.accepted || info.accepted.length === 0)
      ) {
        deliveryStatus = 'Failed';
        failureReason = `SMTP provider rejected all recipients: ${info.rejected.join(', ')}`;
      } else {
        deliveryStatus = 'Sent';
        if (this.isUsingFallback) {
          // Never log OTP values or sensitive secrets
          const sanitizedSubject = options.subject.replace(/\b\d{6}\b/g, '******');
          console.log(
            `[EmailService:Fallback] Generated email "${sanitizedSubject}" for recipient(s): ${recipientEmails.join(', ')} (Message-ID: ${providerMessageId})`,
          );
        }
      }
    } catch (err: unknown) {
      deliveryStatus = 'Failed';
      failureReason = err instanceof Error ? err.message.slice(0, 500) : 'Unknown delivery failure';
      const sanitizedSubject = options.subject.replace(/\b\d{6}\b/g, '******');
      console.error(`[EmailService] Failed to deliver email "${sanitizedSubject}":`, failureReason);
    }

    try {
      await EmailLogModel.create({
        emailReference: emailRef,
        senderId: options.senderId ?? null,
        source: 'System',
        recipientIds: [],
        recipientEmails,
        parkingLotId: options.parkingLotId ?? null,
        bookingId: options.bookingId ?? null,
        templateId: options.templateId ?? null,
        emailType,
        subject: options.subject.slice(0, 200),
        body: (plainText || options.html || '').slice(0, 5000),
        deliveryStatus,
        providerMessageId,
        failureReason,
        retryCount: 0,
        lastAttemptAt: new Date(),
        sentAt: deliveryStatus === 'Sent' ? new Date() : null,
      });
    } catch (logErr) {
      console.error('Failed to record EmailLog:', logErr);
    }

    return deliveryStatus === 'Sent';
  }

  public async sendOtpEmail(to: string, otp: string, purpose: string): Promise<boolean> {
    const subject = `[${purpose}] Your ParkEase Verification Code: ${otp}`;
    const text = `Hello,\n\nYour 6-digit verification code for ${purpose} is: ${otp}\n\nThis code is valid for 5 minutes. Please do not share this code with anyone.\n\nThank you,\nParkEase Team`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2563eb; margin-top: 0;">ParkEase Verification</h2>
        <p>Hello,</p>
        <p>Your 6-digit verification code for <strong>${purpose}</strong> is:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1e293b; background: #f1f5f9; padding: 12px 24px; display: inline-block; border-radius: 6px; margin: 16px 0;">
          ${otp}
        </div>
        <p style="color: #64748b; font-size: 14px;">This code is valid for 5 minutes. Do not share this code with anyone.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px;">© ${new Date().getFullYear()} ParkEase. All rights reserved.</p>
      </div>
    `;

    return this.sendEmail({
      to,
      subject,
      text,
      html,
      emailType: 'SYSTEM_NOTIFICATION',
    });
  }

  public async sendWelcomeEmail(to: string, fullName: string): Promise<boolean> {
    const subject = 'Welcome to ParkEase!';
    const text = `Hello ${fullName},\n\nWelcome to ParkEase! Your customer account has been created successfully.\n\nYou can now search, reserve, and navigate parking spaces seamlessly.\n\nThank you,\nParkEase Team`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2563eb; margin-top: 0;">Welcome to ParkEase!</h2>
        <p>Hello <strong>${fullName}</strong>,</p>
        <p>Your customer account has been created successfully.</p>
        <p>You can now search, reserve, and navigate parking spaces seamlessly across all supported locations.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px;">© ${new Date().getFullYear()} ParkEase. All rights reserved.</p>
      </div>
    `;

    return this.sendEmail({
      to,
      subject,
      text,
      html,
      emailType: 'SYSTEM_NOTIFICATION',
    });
  }

  public async sendSecurityStaffInvitationEmail(params: {
    to: string;
    staffName: string;
    ownerName: string;
    facilityName: string;
    loginUrl?: string;
  }): Promise<boolean> {
    const { to, staffName, ownerName, facilityName, loginUrl } = params;
    const resolvedLoginUrl = loginUrl || `${env.CLIENT_URL}/login`;
    const subject = `You've been invited as Security Staff for ${facilityName} on ParkEase`;
    const text = `Hello ${staffName},\n\nYou have been invited by ${ownerName} to join ParkEase as Security Staff for ${facilityName}.\n\nParkEase uses secure, passwordless authentication. To access your security console, visit:\n${resolvedLoginUrl}\n\nEnter your registered email address (${to}) and verify with the one-time password (OTP) sent to you.\n\nThank you,\nParkEase Operations Team`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #1e293b; margin-top: 0;">Welcome to ParkEase Security Team</h2>
        <p style="color: #475569; font-size: 15px;">Hello <strong>${staffName}</strong>,</p>
        <p style="color: #475569; font-size: 15px;">
          You have been designated as <strong>Security Staff</strong> for <strong>${facilityName}</strong> by parking facility owner <strong>${ownerName}</strong>.
        </p>
        <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0 0 8px 0; color: #1e293b; font-weight: 600;">Facility Assignment:</p>
          <p style="margin: 0; color: #334155; font-size: 14px;"><strong>Facility:</strong> ${facilityName}</p>
          <p style="margin: 4px 0 0 0; color: #334155; font-size: 14px;"><strong>Role:</strong> Security Staff (Vehicle Check-in & Gate Operations)</p>
        </div>
        <p style="color: #475569; font-size: 14px;">
          ParkEase uses passwordless login for security and convenience. There are no passwords to create or remember.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resolvedLoginUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block;">
            Access Security Console
          </a>
        </div>
        <p style="color: #64748b; font-size: 13px;">
          Simply sign in using your registered email (<strong>${to}</strong>) or registered mobile number to receive your instant verification code.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px;">© ${new Date().getFullYear()} ParkEase. All rights reserved.</p>
      </div>
    `;

    return this.sendEmail({
      to,
      subject,
      text,
      html,
      emailType: 'SYSTEM_NOTIFICATION',
    });
  }

  public async sendBookingConfirmationEmail(params: {
    to: string;
    customerName: string;
    customerEmail: string;
    customerMobile: string;
    bookingId: mongoose.Types.ObjectId;
    parkingLotId: mongoose.Types.ObjectId;
    bookingReference: string;
    parkingName: string;
    parkingAddress: string;
    floorName: string;
    zoneCode: string;
    slotNumber: string;
    vehicleNumber: string;
    vehicleType: string;
    vehicleBrand?: string | undefined;
    vehicleModel?: string | undefined;
    bookingType: string;
    scheduledEntryTime: Date;
    scheduledExitTime: Date;
    bookingDurationMinutes: number;
    qrCode: string;
    paymentReference: string;
    paymentMethod: string;
    paymentStatus: string;
    paymentDate: Date;
    razorpayOrderId?: string | null | undefined;
    razorpayPaymentId?: string | null | undefined;
    paymentVerificationReference?: string | null | undefined;
    baseAmount: number;
    additionalCharges: number;
    totalAmount: number;
  }): Promise<boolean> {
    const entryFormatted = params.scheduledEntryTime.toLocaleString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const exitFormatted = params.scheduledExitTime.toLocaleString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const paymentDateFormatted = params.paymentDate.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const hours = Math.floor(params.bookingDurationMinutes / 60);
    const mins = params.bookingDurationMinutes % 60;
    const durationText = `${hours > 0 ? `${hours}h ` : ''}${mins > 0 ? `${mins}m` : ''}`.trim();
    const vehicleDesc = [params.vehicleBrand, params.vehicleModel].filter(Boolean).join(' ');

    const subject = `[ParkEase] Booking Confirmed & Official Receipt — ${params.bookingReference}`;
    const text = `ParkEase — Smart Parking Management & Reservation System
Official Parking Booking & Payment Receipt

Hello ${params.customerName},

Your parking reservation at ${params.parkingName} is confirmed!

CUSTOMER DETAILS
- Customer Name: ${params.customerName}
- Email Address: ${params.customerEmail}
- Mobile Number: ${params.customerMobile}

BOOKING DETAILS
- Booking ID: ${params.bookingReference}
- Parking Name: ${params.parkingName}
- Parking Address: ${params.parkingAddress}
- Slot Number: ${params.slotNumber} (${params.floorName}, Zone ${params.zoneCode})
- Vehicle Number: ${params.vehicleNumber}
- Vehicle Type: ${params.vehicleType}${vehicleDesc ? ` (${vehicleDesc})` : ''}
- Booking Type: ${params.bookingType}
- Entry Time: ${entryFormatted}
- Exit Time: ${exitFormatted}
- Booking Duration: ${durationText}

PAYMENT DETAILS
- Payment ID: ${params.paymentReference}
- Payment Method: ${params.paymentMethod}
- Payment Status: ${params.paymentStatus}
- Transaction Date: ${paymentDateFormatted}
- Razorpay Order ID: ${params.razorpayOrderId || 'N/A'}
- Razorpay Payment ID: ${params.razorpayPaymentId || 'N/A'}
- Payment Verification Reference: ${params.paymentVerificationReference || params.paymentReference}

CHARGES
- Parking Charges: ₹${params.baseAmount.toFixed(2)}
- Taxes: ₹0.00
- Discounts: ₹0.00
- Additional Charges: ₹${params.additionalCharges.toFixed(2)}
- Total Amount: ₹${params.totalAmount.toFixed(2)}

BOOKING QR CODE
${params.qrCode}
Present this QR code at the parking entrance.

Thank you for choosing ParkEase!
Support: support@parkease.com | Website: www.parkease.com`;

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 640px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background: #ffffff; color: #0f172a;">
        <!-- Receipt Header (Official ParkEase Document Logo) -->
        <div style="background: #ffffff; padding: 20px 28px; border-bottom: 4px solid #1e3a8a;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
            <div>
              <img src="http://localhost:5173/brand/document-logo.png" alt="ParkEase — Smart Parking Made Simple" style="height: 52px; width: auto; object-fit: contain; display: block;" />
              <div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.6px; margin-top: 4px;">Smart Parking Management &amp; Reservation System</div>
            </div>
            <div style="text-align: right;">
              <span style="background: #dcfce7; color: #166534; border: 1px solid #86efac; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; text-transform: uppercase;">
                ${params.paymentStatus}
              </span>
              <div style="font-size: 12px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; margin-top: 8px;">Official Parking Booking &amp; Payment Receipt</div>
              <div style="font-size: 12px; font-family: monospace; font-weight: 700; color: #0f172a; margin-top: 2px;">${params.bookingReference}</div>
            </div>
          </div>
        </div>

        <div style="padding: 24px 28px;">
          <!-- Customer Details -->
          <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin: 0 0 10px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">Customer Details</h3>
          <table style="width: 100%; font-size: 13px; margin-bottom: 20px; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 0; color: #64748b; width: 40%;">Customer Name</td>
              <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${params.customerName}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Email Address</td>
              <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${params.customerEmail}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Mobile Number</td>
              <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${params.customerMobile}</td>
            </tr>
          </table>

          <!-- Booking Details -->
          <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin: 0 0 10px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">Booking Details</h3>
          <table style="width: 100%; font-size: 13px; margin-bottom: 20px; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 0; color: #64748b; width: 40%;">Booking ID</td>
              <td style="padding: 4px 0; font-weight: 700; font-family: monospace; color: #2563eb;">${params.bookingReference}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Parking Name</td>
              <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${params.parkingName}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Parking Address</td>
              <td style="padding: 4px 0; color: #0f172a;">${params.parkingAddress}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Slot Number</td>
              <td style="padding: 4px 0; font-weight: 700; color: #0f172a;">${params.slotNumber} (${params.floorName} • Zone ${params.zoneCode})</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Vehicle Number</td>
              <td style="padding: 4px 0; font-weight: 700; font-family: monospace; color: #0f172a;">${params.vehicleNumber}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Vehicle Type</td>
              <td style="padding: 4px 0; color: #0f172a;">${params.vehicleType}${vehicleDesc ? ` — ${vehicleDesc}` : ''}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Booking Type</td>
              <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${params.bookingType}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Entry Time</td>
              <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${entryFormatted}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Exit Time</td>
              <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${exitFormatted}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Booking Duration</td>
              <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${durationText}</td>
            </tr>
          </table>

          <!-- Payment Details -->
          <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin: 0 0 10px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">Payment &amp; Razorpay Verification Details</h3>
          <table style="width: 100%; font-size: 13px; margin-bottom: 20px; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 0; color: #64748b; width: 40%;">Payment ID</td>
              <td style="padding: 4px 0; font-weight: 700; font-family: monospace; color: #0f172a;">${params.paymentReference}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Payment Method</td>
              <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${params.paymentMethod}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Payment Status</td>
              <td style="padding: 4px 0; font-weight: 700; color: #16a34a;">${params.paymentStatus}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Transaction Date</td>
              <td style="padding: 4px 0; color: #0f172a;">${paymentDateFormatted}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Razorpay Order ID</td>
              <td style="padding: 4px 0; font-family: monospace; color: #0f172a;">${params.razorpayOrderId || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Razorpay Payment ID</td>
              <td style="padding: 4px 0; font-family: monospace; color: #0f172a;">${params.razorpayPaymentId || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Payment Verification Reference</td>
              <td style="padding: 4px 0; font-family: monospace; color: #0f172a;">${params.paymentVerificationReference || params.paymentReference}</td>
            </tr>
          </table>

          <!-- Charges -->
          <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin: 0 0 10px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">Charges Breakdown</h3>
          <table style="width: 100%; font-size: 13px; margin-bottom: 20px; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Parking Charges</td>
              <td style="padding: 4px 0; text-align: right; font-weight: 600;">₹${params.baseAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Taxes (if applicable)</td>
              <td style="padding: 4px 0; text-align: right;">₹0.00</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Discounts</td>
              <td style="padding: 4px 0; text-align: right;">₹0.00</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Additional Charges</td>
              <td style="padding: 4px 0; text-align: right;">₹${params.additionalCharges.toFixed(2)}</td>
            </tr>
            <tr style="border-top: 2px solid #e2e8f0;">
              <td style="padding: 10px 0 4px 0; font-weight: 800; font-size: 15px; color: #0f172a;">Total Amount</td>
              <td style="padding: 10px 0 4px 0; text-align: right; font-weight: 800; font-size: 16px; color: #16a34a;">₹${params.totalAmount.toFixed(2)}</td>
            </tr>
          </table>

          <!-- QR Code Section -->
          <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px; padding: 16px; text-align: center; margin-bottom: 20px;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #475569; margin-bottom: 6px;">Digital Entry / Exit QR Pass</div>
            <div style="font-family: monospace; font-size: 13px; font-weight: 700; color: #0f172a; background: #ffffff; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; display: inline-block;">
              ${params.qrCode}
            </div>
            <div style="font-size: 12px; color: #2563eb; font-weight: 600; margin-top: 8px;">
              Present this QR code at the parking entrance.
            </div>
          </div>

          <div style="text-align: center; margin: 20px 0;">
            <a href="http://localhost:5173/customer/dashboard" style="background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 22px; border-radius: 8px; font-size: 13px; font-weight: 700; display: inline-block;">
              View Booking in Dashboard
            </a>
          </div>
        </div>

        <!-- Receipt Footer (Official ParkEase Document Footer) -->
        <div style="background: #f8fafc; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0;">
          <div style="padding: 16px 28px 12px 28px;">
            <p style="margin: 0 0 4px 0; font-weight: 700; color: #0f172a;">Thank you for choosing ParkEase! Drive safely.</p>
            <p style="margin: 0 0 4px 0;">Support Email: <a href="mailto:support@parkease.com" style="color: #2563eb;">support@parkease.com</a> | Website: <a href="http://localhost:5173" style="color: #2563eb;">www.parkease.com</a></p>
            <p style="margin: 0 0 4px 0;">Terms &amp; Conditions: Subject to ParkEase booking, grace period, cancellation, and overstay policies.</p>
            <p style="margin: 4px 0 0 0; color: #94a3b8;">© ${new Date().getFullYear()} ParkEase. All rights reserved.</p>
          </div>
          <img src="http://localhost:5173/brand/document-footer.png" alt="ParkEase Official Document Footer" style="width: 100%; height: auto; display: block; object-fit: cover;" />
        </div>
      </div>
    `;

    return this.sendEmail({
      to: params.to,
      subject,
      text,
      html,
      emailType: 'BOOKING_CONFIRMATION',
      bookingId: params.bookingId,
      parkingLotId: params.parkingLotId,
    });
  }
}

export const emailService = new EmailService();
