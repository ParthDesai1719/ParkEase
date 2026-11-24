import crypto from 'node:crypto';
import mongoose from 'mongoose';
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
    | 'SYSTEM_NOTIFICATION'
    | 'ADMIN_COMMUNICATION'
    | 'ANNOUNCEMENT';
  senderId?: mongoose.Types.ObjectId | null;
  source?: 'System' | 'Owner' | 'Admin';
  recipientIds?: mongoose.Types.ObjectId[] | undefined;
  recipientCategory?: 'ALL_OWNERS' | 'ALL_CUSTOMERS' | 'SPECIFIC_OWNER' | 'SPECIFIC_CUSTOMER' | 'OTHER' | undefined;
  recipientCount?: number | undefined;
  htmlBody?: string | undefined;
  parkingLotId?: mongoose.Types.ObjectId | null | undefined;
  bookingId?: mongoose.Types.ObjectId | null | undefined;
  templateId?: mongoose.Types.ObjectId | null | undefined;
}

export interface EmailLayoutOptions {
  title: string;
  subtitle?: string;
  badge?: {
    text: string;
    variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  };
  bodyHtml: string;
  ctaButton?: {
    text: string;
    url: string;
    variant?: 'primary' | 'success' | 'danger';
  };
  footerNotice?: string;
}

/**
 * Standardized responsive ParkEase-branded HTML email layout generator.
 * Follows design requirements from finalproject-5.txt:
 * Consistent ParkEase logo, navy accent border, typography, badges, CTA buttons, and document footer.
 */
export function generateParkEaseEmailHtml(options: EmailLayoutOptions): string {
  const clientUrl = env.CLIENT_URL || 'http://localhost:5173';
  const logoUrl = `${clientUrl}/brand/document-logo.png`;
  const footerImgUrl = `${clientUrl}/brand/document-footer.png`;

  let badgeHtml = '';
  if (options.badge) {
    let bg = '#dbeafe';
    let color = '#1e40af';
    let border = '#93c5fd';
    if (options.badge.variant === 'success') {
      bg = '#dcfce7';
      color = '#166534';
      border = '#86efac';
    } else if (options.badge.variant === 'warning') {
      bg = '#fef3c7';
      color = '#92400e';
      border = '#fde68a';
    } else if (options.badge.variant === 'danger') {
      bg = '#fee2e2';
      color = '#991b1b';
      border = '#fca5a5';
    } else if (options.badge.variant === 'neutral') {
      bg = '#f1f5f9';
      color = '#475569';
      border = '#cbd5e1';
    }
    badgeHtml = `
      <span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;background:${bg};color:${color};border:1px solid ${border};">
        ${options.badge.text}
      </span>
    `;
  }

  let ctaHtml = '';
  if (options.ctaButton) {
    let btnBg = '#2563eb';
    if (options.ctaButton.variant === 'success') btnBg = '#16a34a';
    if (options.ctaButton.variant === 'danger') btnBg = '#dc2626';

    ctaHtml = `
      <div style="text-align:center;margin:28px 0 16px 0;">
        <a href="${options.ctaButton.url}" style="background-color:${btnBg};color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:8px;font-size:14px;font-weight:700;display:inline-block;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
          ${options.ctaButton.text}
        </a>
      </div>
    `;
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title}</title>
  <style>
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; border-radius: 0 !important; }
      .email-header { padding: 16px 20px !important; }
      .email-body { padding: 20px !important; }
      .meta-grid { width: 100% !important; display: block !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;-webkit-font-smoothing:antialiased;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 8px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table class="email-container" width="620" border="0" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background-color:#ffffff;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
          
          <!-- Official Header -->
          <tr>
            <td class="email-header" style="background-color:#ffffff;padding:22px 28px;border-bottom:4px solid #1e3a8a;">
              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left" valign="middle">
                    <img src="${logoUrl}" alt="ParkEase — Smart Parking Made Simple" style="height:48px;width:auto;display:block;border:0;outline:none;" />
                    <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-top:6px;">Smart Parking Management &amp; Reservation System</div>
                  </td>
                  <td align="right" valign="middle">
                    ${badgeHtml}
                    ${options.subtitle ? `<div style="font-size:11px;font-weight:700;color:#1e3a8a;margin-top:6px;text-transform:uppercase;">${options.subtitle}</div>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Email Content Body -->
          <tr>
            <td class="email-body" style="padding:28px;background-color:#ffffff;font-size:14px;line-height:1.6;color:#334155;">
              ${options.bodyHtml}
              ${ctaHtml}
            </td>
          </tr>

          <!-- Official Document Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 28px 12px 28px;text-align:center;font-size:12px;color:#64748b;line-height:1.5;">
              ${options.footerNotice ? `<div style="font-size:11px;color:#475569;margin-bottom:8px;">${options.footerNotice}</div>` : ''}
              <div style="font-weight:700;color:#0f172a;margin-bottom:4px;">ParkEase Platform Operations</div>
              <div style="margin-bottom:4px;">
                Support: <a href="mailto:support@parkease.com" style="color:#2563eb;text-decoration:none;">support@parkease.com</a> &bull; Website: <a href="${clientUrl}" style="color:#2563eb;text-decoration:none;">www.parkease.com</a>
              </div>
              <div style="font-size:11px;color:#94a3b8;margin-top:6px;">
                &copy; ${new Date().getFullYear()} ParkEase. All rights reserved.
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0;background-color:#f8fafc;">
              <img src="${footerImgUrl}" alt="ParkEase Official Footer" style="width:100%;height:auto;display:block;border:0;" />
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
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
        source: options.source || 'System',
        recipientIds: options.recipientIds || [],
        recipientEmails,
        recipientCategory: options.recipientCategory || 'OTHER',
        recipientCount: options.recipientCount || recipientEmails.length || 1,
        parkingLotId: options.parkingLotId ?? null,
        bookingId: options.bookingId ?? null,
        templateId: options.templateId ?? null,
        emailType,
        subject: options.subject.slice(0, 200),
        body: (plainText || options.html || '').slice(0, 50000),
        htmlBody: options.htmlBody || options.html || null,
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
    const text = `Hello,\n\nYour 6-digit verification code for ${purpose} is: ${otp}\n\nThis code is valid for 5 minutes. Please do not share this code with anyone.\n\nThank you,\nParkEase Operations Team`;
    const html = generateParkEaseEmailHtml({
      title: 'ParkEase One-Time Verification Code',
      subtitle: 'Security Verification',
      badge: {
        text: 'OTP Verification',
        variant: 'info',
      },
      bodyHtml: `
        <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 8px;">Authentication Code</h2>
        <p style="color: #475569; margin-bottom: 16px;">Hello,</p>
        <p style="color: #475569; margin-bottom: 20px;">
          Use the following 6-digit verification code to complete your request for <strong>${purpose}</strong>.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <div style="font-size: 34px; font-weight: 800; letter-spacing: 8px; font-family: monospace; color: #1e3a8a; background: #f1f5f9; border: 2px dashed #93c5fd; padding: 16px 28px; border-radius: 10px; display: inline-block;">
            ${otp}
          </div>
        </div>
        <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 20px 0; border-radius: 4px; font-size: 13px; color: #475569;">
          <strong>Security Notice:</strong> This code is valid for <strong>5 minutes</strong>. Never share this code with anyone. ParkEase staff will never ask for your verification code.
        </div>
      `,
      footerNotice: 'If you did not request this verification code, please ignore this email or contact security support immediately.',
    });

    return this.sendEmail({
      to,
      subject,
      text,
      html,
      emailType: 'SYSTEM_NOTIFICATION',
    });
  }

  public async sendWelcomeEmail(to: string, fullName: string): Promise<boolean> {
    const subject = 'Welcome to ParkEase — Smart Parking Platform';
    const text = `Hello ${fullName},\n\nWelcome to ParkEase! Your customer account has been created successfully.\n\nYou can now search, reserve, and navigate parking spaces seamlessly across all supported locations.\n\nThank you,\nParkEase Operations Team`;
    const html = generateParkEaseEmailHtml({
      title: 'Welcome to ParkEase',
      subtitle: 'Account Activated',
      badge: {
        text: 'Welcome',
        variant: 'success',
      },
      bodyHtml: `
        <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 8px;">Welcome aboard, ${fullName}!</h2>
        <p style="color: #475569; margin-bottom: 16px;">
          Your customer account has been created successfully. You can now experience hassle-free urban parking with automated gate access and guaranteed reservations.
        </p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <div style="font-weight: 700; font-size: 13px; color: #1e293b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Platform Capabilities:</div>
          <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 13px; line-height: 1.7;">
            <li>Instant real-time parking discovery and guaranteed bay allocation.</li>
            <li>High-speed QR entry and exit verification at barrier gates.</li>
            <li>Contactless digital payments and centralized receipt tracking.</li>
            <li>Real-time overstay alerts and reservation extension tools.</li>
          </ul>
        </div>
      `,
      ctaButton: {
        text: 'Explore Available Parking',
        url: `${env.CLIENT_URL}/search`,
        variant: 'primary',
      },
      footerNotice: 'Thank you for choosing ParkEase. Drive safe and park easy!',
    });

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
    const html = generateParkEaseEmailHtml({
      title: 'Security Staff Assignment Notice',
      subtitle: 'Facility Assignment',
      badge: {
        text: 'Staff Invitation',
        variant: 'info',
      },
      bodyHtml: `
        <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 8px;">Welcome to the Security Team</h2>
        <p style="color: #475569; margin-bottom: 16px;">Hello <strong>${staffName}</strong>,</p>
        <p style="color: #475569; margin-bottom: 20px;">
          You have been designated as official <strong>Security Staff</strong> for <strong>${facilityName}</strong> by parking facility owner <strong>${ownerName}</strong>.
        </p>
        <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; border-radius: 6px;">
          <div style="margin: 0 0 8px 0; color: #1e293b; font-weight: 700; font-size: 13px; text-transform: uppercase;">Assignment Context:</div>
          <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 0; color: #64748b; width: 35%;">Assigned Facility</td>
              <td style="padding: 4px 0; font-weight: 700; color: #0f172a;">${facilityName}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Facility Owner</td>
              <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${ownerName}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Role Designation</td>
              <td style="padding: 4px 0; font-weight: 600; color: #2563eb;">Security Staff (Gate Check-In &amp; Checkout)</td>
            </tr>
          </table>
        </div>
        <p style="color: #475569; font-size: 13px; line-height: 1.6;">
          ParkEase operates on seamless, passwordless authentication. To access your barrier console, sign in with your registered email (<strong>${to}</strong>) and verify the instant code delivered to your inbox.
        </p>
      `,
      ctaButton: {
        text: 'Access Gate Security Console',
        url: resolvedLoginUrl,
        variant: 'primary',
      },
      footerNotice: 'Official personnel credential notice generated by ParkEase Gate Operations.',
    });

    return this.sendEmail({
      to,
      subject,
      text,
      html,
      emailType: 'SYSTEM_NOTIFICATION',
    });
  }

  public async sendSecurityStaffSuspendedEmail(params: {
    to: string;
    staffName: string;
    reason: string;
  }): Promise<boolean> {
    const { to, staffName, reason } = params;
    const subject = `Your ParkEase Security Staff Account has been Suspended`;
    const text = `Hello ${staffName},\n\nYour ParkEase Security Staff account has been suspended by the platform administrator.\nReason: ${reason}\n\nDuring suspension, access to the gate security terminal and check-in/check-out functions is disabled.\n\nThank you,\nParkEase Operations Team`;
    const html = generateParkEaseEmailHtml({
      title: 'Security Account Suspended',
      subtitle: 'Disciplinary Action',
      badge: {
        text: 'Suspended',
        variant: 'danger',
      },
      bodyHtml: `
        <h2 style="font-size: 20px; font-weight: 700; color: #991b1b; margin-top: 0; margin-bottom: 8px;">Security Account Suspended</h2>
        <p style="color: #475569; margin-bottom: 16px;">Hello <strong>${staffName}</strong>,</p>
        <p style="color: #475569; margin-bottom: 20px;">
          Your Security Staff account on ParkEase has been placed under administrative suspension.
        </p>
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0; border-radius: 6px;">
          <div style="margin: 0 0 6px 0; color: #991b1b; font-weight: 700; font-size: 13px; text-transform: uppercase;">Reason for Suspension:</div>
          <div style="margin: 0; color: #7f1d1d; font-size: 14px; font-weight: 500;">${reason}</div>
        </div>
        <p style="color: #64748b; font-size: 13px; line-height: 1.6;">
          All active terminal sessions have been revoked immediately. Gate operations, QR check-in, and vehicle movement validation are disabled for this account. If you believe this action was made in error, please contact your facility owner or platform governance at support@parkease.com.
        </p>
      `,
      footerNotice: 'Compliance record logged under ParkEase Administrator Security Audit.',
    });

    return this.sendEmail({
      to,
      subject,
      text,
      html,
      emailType: 'SYSTEM_NOTIFICATION',
    });
  }

  public async sendSecurityStaffActivatedEmail(params: {
    to: string;
    staffName: string;
  }): Promise<boolean> {
    const { to, staffName } = params;
    const subject = `Your ParkEase Security Staff Account has been Reactivated`;
    const resolvedLoginUrl = `${env.CLIENT_URL}/login`;
    const text = `Hello ${staffName},\n\nYour ParkEase Security Staff account has been reactivated by the administrator.\nYou can now log in and resume duty at your assigned parking facility.\n\nThank you,\nParkEase Operations Team`;
    const html = generateParkEaseEmailHtml({
      title: 'Security Staff Reactivated',
      subtitle: 'Account Restored',
      badge: {
        text: 'Active',
        variant: 'success',
      },
      bodyHtml: `
        <h2 style="font-size: 20px; font-weight: 700; color: #166534; margin-top: 0; margin-bottom: 8px;">Security Account Restored</h2>
        <p style="color: #475569; margin-bottom: 16px;">Hello <strong>${staffName}</strong>,</p>
        <p style="color: #475569; margin-bottom: 20px;">
          Your Security Staff account on ParkEase has been successfully restored to <strong>Active</strong> status by an Administrator.
        </p>
        <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 14px 16px; margin: 20px 0; border-radius: 6px; font-size: 13px; color: #166534;">
          You can now log in to the gate terminal and resume vehicle verification, check-in, and check-out duties.
        </div>
      `,
      ctaButton: {
        text: 'Sign in to Gate Terminal',
        url: resolvedLoginUrl,
        variant: 'success',
      },
      footerNotice: 'Restoration confirmed by ParkEase Platform Governance.',
    });

    return this.sendEmail({
      to,
      subject,
      text,
      html,
      emailType: 'SYSTEM_NOTIFICATION',
    });
  }

  public async sendSecurityStaffTransferEmail(params: {
    to: string;
    staffName: string;
    newFacilityName: string;
    newOwnerName: string;
  }): Promise<boolean> {
    const { to, staffName, newFacilityName, newOwnerName } = params;
    const subject = `Facility Reassignment Notice: Security Staff Duty at ${newFacilityName}`;
    const resolvedLoginUrl = `${env.CLIENT_URL}/login`;
    const text = `Hello ${staffName},\n\nYou have been transferred to a new facility assignment by an Administrator.\nNew Facility: ${newFacilityName}\nOwner: ${newOwnerName}\n\nPlease sign in to access the gate console for your new post.\n\nThank you,\nParkEase Operations Team`;
    const html = generateParkEaseEmailHtml({
      title: 'Facility Assignment Transferred',
      subtitle: 'Reassignment Notice',
      badge: {
        text: 'Reassigned',
        variant: 'info',
      },
      bodyHtml: `
        <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 8px;">Facility Assignment Updated</h2>
        <p style="color: #475569; margin-bottom: 16px;">Hello <strong>${staffName}</strong>,</p>
        <p style="color: #475569; margin-bottom: 20px;">
          Your operational duty has been reassigned by an Administrator to a new parking facility.
        </p>
        <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; border-radius: 6px;">
          <div style="margin: 0 0 8px 0; color: #1e293b; font-weight: 700; font-size: 13px; text-transform: uppercase;">New Duty Assignment:</div>
          <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 0; color: #64748b; width: 35%;">Facility Name</td>
              <td style="padding: 4px 0; font-weight: 700; color: #0f172a;">${newFacilityName}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Facility Owner</td>
              <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${newOwnerName}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Operational Role</td>
              <td style="padding: 4px 0; font-weight: 600; color: #2563eb;">Security Staff</td>
            </tr>
          </table>
        </div>
      `,
      ctaButton: {
        text: 'Open Gate Terminal',
        url: resolvedLoginUrl,
        variant: 'primary',
      },
      footerNotice: 'Facility transfer executed in accordance with platform partner agreement.',
    });

    return this.sendEmail({
      to,
      subject,
      text,
      html,
      emailType: 'SYSTEM_NOTIFICATION',
    });
  }

  public async sendBookingCancelledEmail(params: {
    to: string;
    customerName: string;
    bookingReference: string;
    parkingName: string;
    slotNumber: string;
    cancellationReason: string;
    cancelledBy: string;
    refundAmount: number;
    paymentMethod: string;
    refundStatus: string;
  }): Promise<boolean> {
    const {
      to,
      customerName,
      bookingReference,
      parkingName,
      slotNumber,
      cancellationReason,
      cancelledBy,
      refundAmount,
      paymentMethod,
      refundStatus,
    } = params;

    const subject = `[ParkEase] Reservation Cancelled & Refund Notice — ${bookingReference}`;
    const text = `Hello ${customerName},\n\nYour parking booking (${bookingReference}) at ${parkingName} has been cancelled by ${cancelledBy}.\nReason: ${cancellationReason}\n\nRefund Details:\nAmount: ₹${refundAmount.toFixed(2)}\nStatus: ${refundStatus}\nPayment Method: ${paymentMethod}\n\nThank you,\nParkEase Operations Team`;

    const html = generateParkEaseEmailHtml({
      title: 'Booking Cancellation Notice',
      subtitle: 'Reservation Cancelled',
      badge: {
        text: 'Cancelled',
        variant: 'danger',
      },
      bodyHtml: `
        <h2 style="font-size: 20px; font-weight: 700; color: #991b1b; margin-top: 0; margin-bottom: 8px;">Reservation Cancelled</h2>
        <p style="color: #475569; margin-bottom: 16px;">Hello <strong>${customerName}</strong>,</p>
        <p style="color: #475569; margin-bottom: 20px;">
          Your parking reservation at <strong>${parkingName}</strong> has been cancelled by <strong>${cancelledBy}</strong>.
        </p>
        
        <!-- Booking Context Card -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Reservation Information</div>
          <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 0; color: #64748b; width: 40%;">Booking Reference</td>
              <td style="padding: 4px 0; font-family: monospace; font-weight: 700; color: #2563eb;">${bookingReference}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Parking Facility</td>
              <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${parkingName}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Allocated Bay</td>
              <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">Bay ${slotNumber}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Cancelled By</td>
              <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${cancelledBy}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Cancellation Reason</td>
              <td style="padding: 4px 0; font-weight: 500; color: #991b1b;">${cancellationReason}</td>
            </tr>
          </table>
        </div>

        <!-- Refund Breakdown Card -->
        <div style="background-color: ${refundAmount > 0 ? '#f0fdf4' : '#f8fafc'}; border: 1px solid ${refundAmount > 0 ? '#bbf7d0' : '#e2e8f0'}; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <div style="font-size: 12px; font-weight: 700; color: ${refundAmount > 0 ? '#166534' : '#64748b'}; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid ${refundAmount > 0 ? '#bbf7d0' : '#e2e8f0'}; padding-bottom: 4px;">Refund Details</div>
          <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 0; color: #64748b; width: 40%;">Refund Amount</td>
              <td style="padding: 4px 0; font-weight: 800; font-size: 16px; color: ${refundAmount > 0 ? '#16a34a' : '#0f172a'};">₹${refundAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Payment Method</td>
              <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${paymentMethod}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Refund Status</td>
              <td style="padding: 4px 0; font-weight: 700; color: ${refundStatus.includes('Completed') ? '#16a34a' : '#ca8a04'};">${refundStatus}</td>
            </tr>
          </table>
          <p style="font-size: 12px; color: #64748b; margin: 10px 0 0 0;">
            ${paymentMethod === 'RAZORPAY' ? 'Your online refund will be credited back to your original payment method in 5-7 business days.' : 'For cash / walk-in bookings, please collect your cash refund from the parking facility counter.'}
          </p>
        </div>
      `,
      ctaButton: {
        text: 'View Your Bookings',
        url: `${env.CLIENT_URL}/customer/bookings`,
        variant: 'primary',
      },
      footerNotice: 'ParkEase automated reservation and payment reconciliation notification.',
    });

    return this.sendEmail({
      to,
      subject,
      text,
      html,
      emailType: 'BOOKING_CANCELLATION',
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

    const clientUrl = env.CLIENT_URL || 'http://localhost:5173';
    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 640px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background: #ffffff; color: #0f172a;">
        <!-- Receipt Header (Official ParkEase Document Logo) -->
        <div style="background: #ffffff; padding: 20px 28px; border-bottom: 4px solid #1e3a8a;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
            <div>
              <img src="${clientUrl}/brand/document-logo.png" alt="ParkEase — Smart Parking Made Simple" style="height: 52px; width: auto; object-fit: contain; display: block;" />
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
            <a href="${clientUrl}/customer/dashboard" style="background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 22px; border-radius: 8px; font-size: 13px; font-weight: 700; display: inline-block;">
              View Booking in Dashboard
            </a>
          </div>
        </div>

        <!-- Receipt Footer (Official ParkEase Document Footer) -->
        <div style="background: #f8fafc; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0;">
          <div style="padding: 16px 28px 12px 28px;">
            <p style="margin: 0 0 4px 0; font-weight: 700; color: #0f172a;">Thank you for choosing ParkEase! Drive safely.</p>
            <p style="margin: 0 0 4px 0;">Support Email: <a href="mailto:support@parkease.com" style="color: #2563eb;">support@parkease.com</a> | Website: <a href="${clientUrl}" style="color: #2563eb;">www.parkease.com</a></p>
            <p style="margin: 0 0 4px 0;">Terms &amp; Conditions: Subject to ParkEase booking, grace period, cancellation, and overstay policies.</p>
            <p style="margin: 4px 0 0 0; color: #94a3b8;">© ${new Date().getFullYear()} ParkEase. All rights reserved.</p>
          </div>
          <img src="${clientUrl}/brand/document-footer.png" alt="ParkEase Official Document Footer" style="width: 100%; height: auto; display: block; object-fit: cover;" />
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

  /**
   * Dispatches an itemized official receipt email for extra charges, cash extension, or overstay settlement.
   */
  public async sendExtraChargesReceiptEmail(params: {
    to: string;
    customerName: string;
    receiptNumber: string;
    bookingReference: string;
    parkingName: string;
    parkingAddress?: string | undefined;
    slotNumber: string;
    vehicleNumber: string;
    vehicleType?: string | undefined;
    settlementDate: Date;
    paymentMethod: 'CASH' | 'RAZORPAY';
    collectedByName?: string | undefined;
    chargeTitle: string;
    breakdown: {
      extensionMinutes?: number | undefined;
      extensionAmount?: number | undefined;
      overstayMinutes?: number | undefined;
      overstayAmount?: number | undefined;
      totalAmountPaid: number;
    };
    newScheduledExitTime?: Date | string | undefined;
    notes?: string | undefined;
    bookingId?: string | undefined;
    parkingLotId?: string | undefined;
  }): Promise<boolean> {
    const formattedDate = params.settlementDate.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const subject = `[ParkEase] ${params.chargeTitle} — ${params.receiptNumber}`;
    const clientUrl = env.CLIENT_URL || 'http://localhost:5173';

    let breakdownRowsHtml = '';
    let breakdownText = '';

    if (params.breakdown.extensionAmount && params.breakdown.extensionAmount > 0) {
      breakdownRowsHtml += `
        <tr>
          <td style="padding: 6px 0; color: #475569;">Extension Duration (${params.breakdown.extensionMinutes || 0} mins)</td>
          <td style="padding: 6px 0; font-weight: 600; text-align: right; color: #0f172a;">₹${params.breakdown.extensionAmount.toFixed(2)}</td>
        </tr>
      `;
      breakdownText += `- Extension Fee (${params.breakdown.extensionMinutes || 0} mins): ₹${params.breakdown.extensionAmount.toFixed(2)}\n`;
    }

    if (params.breakdown.overstayAmount && params.breakdown.overstayAmount > 0) {
      breakdownRowsHtml += `
        <tr>
          <td style="padding: 6px 0; color: #475569;">Overstay Parking Fee (${params.breakdown.overstayMinutes || 0} mins)</td>
          <td style="padding: 6px 0; font-weight: 600; text-align: right; color: #b91c1c;">₹${params.breakdown.overstayAmount.toFixed(2)}</td>
        </tr>
      `;
      breakdownText += `- Overstay Fee (${params.breakdown.overstayMinutes || 0} mins): ₹${params.breakdown.overstayAmount.toFixed(2)}\n`;
    }

    breakdownRowsHtml += `
      <tr style="border-top: 2px solid #e2e8f0;">
        <td style="padding: 8px 0; font-weight: 700; color: #0f172a; font-size: 14px;">Total Amount Paid</td>
        <td style="padding: 8px 0; font-weight: 800; text-align: right; color: #16a34a; font-size: 16px;">₹${params.breakdown.totalAmountPaid.toFixed(2)}</td>
      </tr>
    `;

    const text = `ParkEase Smart Parking — Official Payment Receipt\n${params.chargeTitle}\n\nReceipt Number: ${params.receiptNumber}\nBooking Reference: ${params.bookingReference}\nDate: ${formattedDate}\nCustomer: ${params.customerName}\nVehicle: ${params.vehicleNumber} (${params.vehicleType || 'Vehicle'})\nFacility: ${params.parkingName}\nBay: ${params.slotNumber}\n\nITEMIZED BREAKDOWN:\n${breakdownText}Total Amount Paid: ₹${params.breakdown.totalAmountPaid.toFixed(2)}\nPayment Method: ${params.paymentMethod === 'CASH' ? 'Cash Collected at Gate' : 'Online Payment (Razorpay)'}\nVerified By: ${params.collectedByName || 'Security Staff'}\n${params.notes ? `Notes: ${params.notes}\n` : ''}\nThank you for choosing ParkEase!\nSupport: support@parkease.com`;

    const bodyHtml = `
      <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 6px;">${params.chargeTitle}</h2>
      <p style="color: #475569; margin-bottom: 16px; font-size: 13px;">
        Dear <strong>${params.customerName}</strong>, your payment for parking charges has been received and verified. Below is your official receipt.
      </p>

      <!-- Receipt Information Card -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 16px;">
        <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
          Receipt Information
        </div>
        <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
          <tr>
            <td style="padding: 3px 0; color: #64748b; width: 42%;">Receipt Number</td>
            <td style="padding: 3px 0; font-family: monospace; font-weight: 700; color: #2563eb;">${params.receiptNumber}</td>
          </tr>
          <tr>
            <td style="padding: 3px 0; color: #64748b;">Booking Reference</td>
            <td style="padding: 3px 0; font-family: monospace; font-weight: 600; color: #0f172a;">${params.bookingReference}</td>
          </tr>
          <tr>
            <td style="padding: 3px 0; color: #64748b;">Facility</td>
            <td style="padding: 3px 0; font-weight: 600; color: #0f172a;">${params.parkingName}</td>
          </tr>
          <tr>
            <td style="padding: 3px 0; color: #64748b;">Designated Bay</td>
            <td style="padding: 3px 0; font-weight: 600; color: #0f172a;">Bay ${params.slotNumber}</td>
          </tr>
          <tr>
            <td style="padding: 3px 0; color: #64748b;">Vehicle Registration</td>
            <td style="padding: 3px 0; font-family: monospace; font-weight: 600; color: #0f172a;">${params.vehicleNumber} (${params.vehicleType || 'Vehicle'})</td>
          </tr>
          <tr>
            <td style="padding: 3px 0; color: #64748b;">Date &amp; Time</td>
            <td style="padding: 3px 0; color: #0f172a;">${formattedDate}</td>
          </tr>
        </table>
      </div>

      <!-- Itemized Charges Table -->
      <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px 18px; margin-bottom: 16px;">
        <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
          Payment Breakdown
        </div>
        <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
          ${breakdownRowsHtml}
        </table>
      </div>

      <!-- Settlement Status & Verification -->
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-size: 12px; color: #166534;">
        <div style="font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
          <span>✓ Payment Confirmed</span> • <span>${params.paymentMethod === 'CASH' ? 'Cash Collected at Gate' : 'Online Payment (Razorpay)'}</span>
        </div>
        <div>
          Collected / Verified by: <strong>${params.collectedByName || 'Security Staff'}</strong>
        </div>
        ${params.notes ? `<div style="margin-top: 4px; color: #15803d;">Staff Notes: ${params.notes}</div>` : ''}
        <div style="margin-top: 6px; font-size: 11px; color: #166534; border-top: 1px dashed #86efac; padding-top: 4px;">
          Vehicle departure clearance granted. Exit barrier authorized.
        </div>
      </div>
    `;

    const html = generateParkEaseEmailHtml({
      title: 'Payment Settlement Receipt',
      subtitle: params.chargeTitle,
      badge: {
        text: 'Paid & Settled',
        variant: 'success',
      },
      bodyHtml,
      ctaButton: {
        text: 'View Booking & History',
        url: `${clientUrl}/customer/bookings`,
        variant: 'primary',
      },
      footerNotice: 'ParkEase automated official transaction & gate clearance notification.',
    });

    return this.sendEmail({
      to: params.to,
      subject,
      text,
      html,
      emailType: 'PAYMENT_RECEIVED',
      bookingId: params.bookingId && mongoose.isValidObjectId(params.bookingId) ? new mongoose.Types.ObjectId(params.bookingId) : undefined,
      parkingLotId: params.parkingLotId && mongoose.isValidObjectId(params.parkingLotId) ? new mongoose.Types.ObjectId(params.parkingLotId) : undefined,
    });
  }

  /**
   * Automated Booking Completion Email with "Review Parking" Call-to-Action
   * Dispatched upon successful exit gate verification and session termination.
   */
  public async sendBookingCompletionEmail(params: {
    to: string;
    customerName: string;
    bookingId: mongoose.Types.ObjectId | string;
    parkingLotId: mongoose.Types.ObjectId | string;
    bookingReference: string;
    parkingName: string;
    parkingAddress: string;
    vehicleNumber: string;
    vehicleType: string;
    slotNumber?: string | undefined;
    floorName?: string | undefined;
    zoneCode?: string | undefined;
    entryTime?: Date | undefined;
    exitTime: Date;
    stayDurationMinutes?: number | undefined;
    totalAmount?: number | undefined;
  }): Promise<boolean> {
    const clientUrl = env.CLIENT_URL || 'http://localhost:5173';
    const subject = `Parking Session Completed — ${params.parkingName} [${params.bookingReference}]`;
    const reviewUrl = `${clientUrl}/customer/reviews?bookingId=${params.bookingId.toString()}`;

    const entryFormatted = params.entryTime
      ? params.entryTime.toLocaleString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'N/A';

    const exitFormatted = params.exitTime.toLocaleString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const durationText = params.stayDurationMinutes
      ? `${Math.floor(params.stayDurationMinutes / 60)}h ${params.stayDurationMinutes % 60}m`
      : 'Completed';

    const text = `Dear ${params.customerName},\n\nYour parking session at ${params.parkingName} is complete.\n\nBooking Reference: ${params.bookingReference}\nVehicle: ${params.vehicleNumber} (${params.vehicleType})\nSlot: ${params.slotNumber || 'Assigned Bay'}\nEntry: ${entryFormatted}\nExit: ${exitFormatted}\nDuration: ${durationText}\n\nWe hope you had a smooth parking experience! Please take a moment to review this parking facility:\n${reviewUrl}\n\nThank you for choosing ParkEase.`;

    const bodyHtml = `
      <div style="font-size: 14px; color: #334155; line-height: 1.6;">
        <p style="margin-top: 0; margin-bottom: 16px;">
          Dear <strong>${params.customerName}</strong>,
        </p>
        <p style="margin-bottom: 16px;">
          Your parking session has been successfully completed and your vehicle has exited <strong>${params.parkingName}</strong>. Thank you for choosing ParkEase!
        </p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; width: 40%;">Booking Reference:</td>
              <td style="padding: 6px 0; font-weight: 700; font-family: monospace; color: #0f172a;">${params.bookingReference}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Facility:</td>
              <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${params.parkingName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Location:</td>
              <td style="padding: 6px 0; color: #334155;">${params.parkingAddress}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Vehicle:</td>
              <td style="padding: 6px 0; font-weight: 700; font-family: monospace; color: #0f172a;">${params.vehicleNumber} (${params.vehicleType})</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Bay / Slot:</td>
              <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${params.slotNumber || 'Standard Bay'}${params.floorName ? ` • ${params.floorName}` : ''}${params.zoneCode ? ` (Zone ${params.zoneCode})` : ''}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Checked In:</td>
              <td style="padding: 6px 0; color: #0f172a;">${entryFormatted}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Checked Out:</td>
              <td style="padding: 6px 0; font-weight: 600; color: #16a34a;">${exitFormatted}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Total Stay Duration:</td>
              <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">${durationText}</td>
            </tr>
            ${params.totalAmount !== undefined ? `
            <tr style="border-top: 1px dashed #cbd5e1;">
              <td style="padding: 8px 0 4px 0; font-weight: 700; color: #0f172a;">Total Paid:</td>
              <td style="padding: 8px 0 4px 0; font-weight: 800; color: #ea580c; font-size: 15px;">₹${params.totalAmount}</td>
            </tr>
            ` : ''}
          </table>
        </div>

        <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: center;">
          <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: #9a3412;">
            How was your parking experience?
          </p>
          <p style="margin: 0 0 16px 0; font-size: 12px; color: #7c2d12;">
            Your feedback helps other drivers and lets the facility owner maintain quality standards.
          </p>
          <a href="${reviewUrl}" style="display: inline-block; background: #ea580c; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 13px; padding: 10px 24px; border-radius: 8px; box-shadow: 0 2px 4px rgba(234, 88, 12, 0.2);">
            ⭐ Review Parking Facility
          </a>
        </div>
      </div>
    `;

    const html = generateParkEaseEmailHtml({
      title: 'Parking Session Completed',
      subtitle: `${params.parkingName} • ${params.bookingReference}`,
      badge: {
        text: 'Session Completed',
        variant: 'success',
      },
      bodyHtml,
      ctaButton: {
        text: 'Review Parking',
        url: reviewUrl,
        variant: 'primary',
      },
      footerNotice: 'ParkEase automated official transaction & session completion notification.',
    });

    return this.sendEmail({
      to: params.to,
      subject,
      text,
      html,
      emailType: 'CUSTOMER_COMMUNICATION',
      bookingId: new mongoose.Types.ObjectId(params.bookingId),
      parkingLotId: new mongoose.Types.ObjectId(params.parkingLotId),
    });
  }
}

export const emailService = new EmailService();
