import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { EmailLogModel } from '../models/EmailLog.js';

interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  emailType?:
    | 'CUSTOMER_COMMUNICATION'
    | 'BOOKING_CONFIRMATION'
    | 'BOOKING_CANCELLATION'
    | 'WALK_IN_BOOKING'
    | 'PAYMENT_RECEIVED'
    | 'OWNER_REGISTRATION'
    | 'INCIDENT_NOTIFICATION'
    | 'SYSTEM_NOTIFICATION';
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter(): void {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    } else {
      // In development / testing without SMTP credentials, use a JSON / mock transporter that doesn't throw
      this.transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
    }
  }

  public async sendEmail(options: SendMailOptions): Promise<boolean> {
    const fromAddress = process.env.SMTP_FROM || 'ParkEase <no-reply@parkease.com>';
    const emailRef = `EMAIL-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const emailType = options.emailType || 'SYSTEM_NOTIFICATION';

    let deliveryStatus: 'Pending' | 'Sending' | 'Sent' | 'Failed' | 'Retrying';
    let failureReason: string | null = null;
    let providerMessageId: string | null = null;

    try {
      const info = await this.transporter?.sendMail({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      providerMessageId = info?.messageId || null;
      deliveryStatus = 'Sent';
    } catch (err: unknown) {
      deliveryStatus = 'Failed';
      failureReason = err instanceof Error ? err.message.slice(0, 500) : 'Unknown delivery failure';
    }

    try {
      await EmailLogModel.create({
        emailReference: emailRef,
        senderId: null,
        source: 'System',
        recipientIds: [],
        recipientEmails: [options.to],
        parkingLotId: null,
        bookingId: null,
        templateId: null,
        emailType,
        subject: options.subject.slice(0, 200),
        body: (options.text || options.html || '').slice(0, 5000),
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
    const subject = `Your ParkEase Verification Code: ${otp}`;
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
}

export const emailService = new EmailService();
