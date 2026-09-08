import jwt, { type SignOptions } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { authConfig } from '../config/auth.js';

export interface JwtPayload {
  userId: string;
  roleId: string;
}

export function generateAccessToken(payload: JwtPayload): string {
  const expiresIn: StringValue = authConfig.jwtExpiresIn as StringValue;

  const options: SignOptions = {
    expiresIn,
  };

  return jwt.sign(payload, authConfig.jwtSecret, options);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, authConfig.jwtSecret) as JwtPayload;
}
