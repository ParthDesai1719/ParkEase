import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export interface CreateOrderParams {
  amountPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResult {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

export interface VerifySignatureParams {
  orderId: string;
  paymentId: string;
  signature: string;
}

class RazorpayService {
  private client: Razorpay | null = null;

  private getClient(): Razorpay {
    if (!this.client) {
      if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
        throw new AppError(
          'Razorpay payment gateway is not properly configured with API keys.',
          500,
          'PAYMENT_CONFIG_ERROR',
        );
      }
      this.client = new Razorpay({
        key_id: env.RAZORPAY_KEY_ID,
        key_secret: env.RAZORPAY_KEY_SECRET,
      });
    }
    return this.client;
  }

  /**
   * Create a Razorpay order in test mode.
   */
  public async createOrder(params: CreateOrderParams): Promise<RazorpayOrderResult> {
    const rzp = this.getClient();
    const currency = params.currency || 'INR';

    try {
      const order = await rzp.orders.create({
        amount: Math.round(params.amountPaise),
        currency,
        receipt: params.receipt,
        notes: params.notes || {},
      });

      return {
        id: order.id,
        amount: Number(order.amount),
        currency: order.currency,
        receipt: order.receipt || params.receipt,
        status: order.status,
      };
    } catch (err: unknown) {
      console.error('[RazorpayService] Order creation error:', err);
      const msg = err && typeof err === 'object' && 'error' in err
        ? (err as { error: { description?: string } }).error.description
        : 'Failed to initiate Razorpay order.';
      throw new AppError(`Payment order creation failed: ${msg}`, 502, 'GATEWAY_ERROR');
    }
  }

  /**
   * Server-side cryptographic signature verification of Razorpay payment.
   */
  public verifySignature(params: VerifySignatureParams): boolean {
    if (!params.orderId || !params.paymentId || !params.signature) {
      return false;
    }

    if (!env.RAZORPAY_KEY_SECRET) {
      throw new AppError('Razorpay secret key is not configured.', 500, 'PAYMENT_CONFIG_ERROR');
    }

    const payload = `${params.orderId}|${params.paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(payload)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'utf-8'),
        Buffer.from(params.signature, 'utf-8'),
      );
    } catch {
      return false;
    }
  }
}

export const razorpayService = new RazorpayService();
