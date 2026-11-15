import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { emailService } from '../services/email.service.js';
import { AppError } from '../utils/AppError.js';
import { sendSuccess } from '../utils/apiResponse.js';

const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name cannot exceed 50 characters'),
  email: z
    .string()
    .trim()
    .email('Please provide a valid email address')
    .toLowerCase(),
  subject: z
    .string()
    .trim()
    .min(4, 'Subject must be at least 4 characters')
    .max(100, 'Subject cannot exceed 100 characters'),
  message: z
    .string()
    .trim()
    .min(10, 'Message must be at least 10 characters')
    .max(2000, 'Message cannot exceed 2000 characters'),
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function submitContactMessage(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parseResult = contactSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      throw new AppError(firstIssue?.message || 'Invalid contact form data', 400, 'E001');
    }

    const { name, email, subject, message } = parseResult.data;
    const recipientEmail = 'parkease@gmail.com';
    const submissionTime = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'full',
      timeStyle: 'medium',
    });

    const plainText = [
      `New Contact Message from: ${name} <${email}>`,
      `Date: ${submissionTime}`,
      `Subject: ${subject}`,
      '',
      '--- Message Content ---',
      message,
      '',
      '---',
      `Sent via ParkEase Contact Portal to ${recipientEmail}`,
      `Reply-To: ${email}`,
    ].join('\n');

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
        <div style="border-bottom: 2px solid #f97316; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #f97316; font-size: 20px; font-weight: 700;">ParkEase — New Contact Inquiry</h2>
          <p style="margin: 4px 0 0; color: #64748b; font-size: 13px;">Received via ParkEase Web Portal</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
          <tr>
            <td style="padding: 8px 12px; font-weight: 600; color: #475569; width: 100px; background: #f8fafc; border-radius: 6px 0 0 6px;">Sender:</td>
            <td style="padding: 8px 12px; color: #0f172a; background: #f8fafc; border-radius: 0 6px 6px 0;"><strong>${escapeHtml(name)}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: 600; color: #475569; background: #ffffff;">Email:</td>
            <td style="padding: 8px 12px; color: #0f172a; background: #ffffff;">
              <a href="mailto:${escapeHtml(email)}" style="color: #2563eb; text-decoration: none; font-weight: 500;">${escapeHtml(email)}</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: 600; color: #475569; background: #f8fafc; border-radius: 6px 0 0 6px;">Subject:</td>
            <td style="padding: 8px 12px; color: #0f172a; background: #f8fafc; border-radius: 0 6px 6px 0; font-weight: 600;">${escapeHtml(subject)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: 600; color: #475569; background: #ffffff;">Received At:</td>
            <td style="padding: 8px 12px; color: #64748b; font-size: 13px; background: #ffffff;">${escapeHtml(submissionTime)}</td>
          </tr>
        </table>

        <div style="margin-top: 20px;">
          <h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #334155; text-transform: uppercase; letter-spacing: 0.5px;">Message Content</h3>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-size: 14px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">${escapeHtml(message)}</div>
        </div>

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center;">
          <p style="margin: 0;">This email was sent to <strong>${recipientEmail}</strong> from <strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}).</p>
          <p style="margin: 4px 0 0;">You can reply directly to this email to reach the sender.</p>
        </div>
      </div>
    `;

    // Deliver email from sender to parkease@gmail.com
    const sent = await emailService.sendEmail({
      from: `"${name}" <${email}>`,
      to: recipientEmail,
      replyTo: email,
      subject: `[Contact Form] ${subject}`,
      text: plainText,
      html,
      emailType: 'CUSTOMER_COMMUNICATION',
    });

    if (!sent && !emailService.isFallbackActive()) {
      console.warn(`[ContactController] Email delivery to ${recipientEmail} reported failed by transporter.`);
    }

    sendSuccess(res, 'Your message has been sent successfully.', {
      recipient: recipientEmail,
      sender: email,
      subject,
    });
  } catch (error) {
    next(error);
  }
}
