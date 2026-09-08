import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { RefreshTokenModel, type RefreshToken } from '../models/RefreshToken.js';
import { SessionModel, type Session } from '../models/Session.js';
import { UserModel, type User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { generateAccessToken } from '../utils/jwt.js';
import { auditService } from './audit.service.js';

export interface CreateSessionParams {
  user: User & { _id: mongoose.Types.ObjectId };
  loginMethod: 'Email' | 'Mobile Number';
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
}

export interface ClientDeviceInfo {
  deviceName: string | null;
  operatingSystem: string | null;
  browser: string | null;
}

class SessionService {
  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  private generateRawRefreshToken(): string {
    return crypto.randomBytes(40).toString('hex');
  }

  public parseUserAgent(userAgent?: string | null | undefined): ClientDeviceInfo {
    if (!userAgent) {
      return { deviceName: null, operatingSystem: null, browser: null };
    }

    let operatingSystem: string | null = null;
    if (/windows/i.test(userAgent)) operatingSystem = 'Windows';
    else if (/macintosh|mac os x/i.test(userAgent)) operatingSystem = 'macOS';
    else if (/android/i.test(userAgent)) operatingSystem = 'Android';
    else if (/iphone|ipad|ipod/i.test(userAgent)) operatingSystem = 'iOS';
    else if (/linux/i.test(userAgent)) operatingSystem = 'Linux';

    let browser: string | null = null;
    if (/edg/i.test(userAgent)) browser = 'Edge';
    else if (/chrome|crios/i.test(userAgent)) browser = 'Chrome';
    else if (/firefox|fxios/i.test(userAgent)) browser = 'Firefox';
    else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = 'Safari';

    return {
      deviceName: operatingSystem ? `${operatingSystem} Device` : 'Unknown Device',
      operatingSystem,
      browser,
    };
  }

  public async createSession(params: CreateSessionParams): Promise<{
    session: Session & { _id: mongoose.Types.ObjectId };
    accessToken: string;
    rawRefreshToken: string;
  }> {
    const rawRefreshToken = this.generateRawRefreshToken();
    const tokenHash = this.hashToken(rawRefreshToken);

    const sessionIdStr = `SES-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const tokenFamilyId = `TF-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const deviceInfo = this.parseUserAgent(params.userAgent);

    // 1. Create Session
    const tempObjectId = new mongoose.Types.ObjectId();
    const sessionDoc = new SessionModel({
      userId: params.user._id,
      sessionId: sessionIdStr,
      refreshTokenId: tempObjectId,
      tokenFamilyId,
      loginMethod: params.loginMethod,
      sessionType: 'Standard',
      loginTime: new Date(),
      lastActivity: new Date(),
      logoutTime: null,
      logoutReason: null,
      revokedAt: null,
      revokedBy: null,
      ipAddress: params.ipAddress ?? null,
      deviceName: deviceInfo.deviceName,
      operatingSystem: deviceInfo.operatingSystem,
      browser: deviceInfo.browser,
      location: null,
      sessionStatus: 'Active',
      expiresAt: sessionExpiresAt,
    });
    await sessionDoc.save();

    // 2. Create RefreshToken linked to Session._id
    const refreshTokenDoc = new RefreshTokenModel({
      userId: params.user._id,
      sessionId: sessionDoc._id,
      tokenHash,
      tokenFamilyId,
      tokenStatus: 'Active',
      issuedAt: new Date(),
      expiresAt: sessionExpiresAt,
      revokedAt: null,
      revokedReason: null,
      lastUsedAt: null,
      rotatedAt: null,
      replacedByTokenId: null,
    });
    await refreshTokenDoc.save();

    // 3. Link real refreshToken._id to Session
    sessionDoc.refreshTokenId = refreshTokenDoc._id;
    await sessionDoc.save();

    // 4. Generate short-lived JWT Access Token
    const accessToken = generateAccessToken({
      userId: params.user._id.toString(),
      roleId: params.user.roleId.toString(),
      sessionId: sessionDoc.sessionId,
    });

    return {
      session: sessionDoc as unknown as Session & { _id: mongoose.Types.ObjectId },
      accessToken,
      rawRefreshToken,
    };
  }

  public async rotateRefreshToken(
    rawRefreshToken: string,
    context?: { ipAddress?: string | null | undefined; userAgent?: string | null | undefined },
  ): Promise<{
    accessToken: string;
    rawRefreshToken: string;
    user: User & { _id: mongoose.Types.ObjectId };
  }> {
    if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
      throw new AppError('Refresh token is required.', 401, 'E040');
    }

    const tokenHash = this.hashToken(rawRefreshToken.trim());
    const tokenRecord = await (RefreshTokenModel as mongoose.Model<RefreshToken>)
      .findOne({ tokenHash })
      .exec();

    if (!tokenRecord) {
      throw new AppError('Invalid refresh token.', 401, 'E040');
    }

    // Reuse Detection: token was previously Rotated or Revoked
    if (tokenRecord.tokenStatus === 'Rotated' || tokenRecord.tokenStatus === 'Revoked') {
      // Invalidate all tokens in the family
      await (RefreshTokenModel as mongoose.Model<RefreshToken>).updateMany(
        { tokenFamilyId: tokenRecord.tokenFamilyId, tokenStatus: 'Active' },
        {
          $set: {
            tokenStatus: 'Revoked',
            revokedAt: new Date(),
            revokedReason: 'Refresh Token Reuse Detected',
          },
        },
      );

      // Invalidate the session
      await (SessionModel as mongoose.Model<Session>).updateOne(
        { _id: tokenRecord.sessionId },
        {
          $set: {
            sessionStatus: 'Revoked',
            logoutReason: 'Refresh Token Reuse Detected',
            revokedAt: new Date(),
          },
        },
      );

      await auditService.log({
        userId: tokenRecord.userId,
        actionCode: 'AUTH_REFRESH_TOKEN_REUSE_DETECTED',
        module: 'Authentication',
        actionTitle: 'Refresh Token Reuse Detected',
        description:
          'An already rotated or revoked refresh token was submitted. Token family and session revoked.',
        ipAddress: context?.ipAddress,
        deviceInfo: context?.userAgent,
        actionStatus: 'Blocked',
      });

      throw new AppError(
        'Security alert: Refresh token reuse detected. Session has been revoked.',
        401,
        'E040',
      );
    }

    // Check expiration
    if (tokenRecord.tokenStatus === 'Expired' || tokenRecord.expiresAt.getTime() <= Date.now()) {
      tokenRecord.tokenStatus = 'Expired';
      await tokenRecord.save();
      throw new AppError('Refresh token has expired. Please login again.', 401, 'E040');
    }

    if (tokenRecord.tokenStatus !== 'Active') {
      throw new AppError('Refresh token is no longer active.', 401, 'E040');
    }

    // Verify session
    const session = await (SessionModel as mongoose.Model<Session>)
      .findOne({ _id: tokenRecord.sessionId })
      .exec();

    if (
      !session ||
      session.sessionStatus !== 'Active' ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      tokenRecord.tokenStatus = 'Revoked';
      tokenRecord.revokedAt = new Date();
      tokenRecord.revokedReason = 'Session Expired';
      await tokenRecord.save();
      throw new AppError('Session is invalid or expired. Please login again.', 401, 'E039');
    }

    // Verify user eligibility
    const user = await (UserModel as mongoose.Model<User>)
      .findOne({ _id: tokenRecord.userId })
      .exec();

    if (!user || user.accountStatus !== 'Active') {
      tokenRecord.tokenStatus = 'Revoked';
      tokenRecord.revokedAt = new Date();
      tokenRecord.revokedReason = 'Account Suspended';
      await tokenRecord.save();

      session.sessionStatus = 'Revoked';
      session.logoutReason = 'Account Suspended';
      session.revokedAt = new Date();
      await session.save();

      throw new AppError('Account is not eligible for authentication.', 403, 'E042');
    }

    // Generate replacement refresh token
    const newRawToken = this.generateRawRefreshToken();
    const newHash = this.hashToken(newRawToken);

    const replacementToken = new RefreshTokenModel({
      userId: user._id,
      sessionId: session._id,
      tokenHash: newHash,
      tokenFamilyId: tokenRecord.tokenFamilyId,
      tokenStatus: 'Active',
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revokedAt: null,
      revokedReason: null,
      lastUsedAt: null,
      rotatedAt: null,
      replacedByTokenId: null,
    });
    // Mark previous token as Rotated before saving the new Active token
    // to preserve unique partial index IDX_ActiveSessionToken ({ sessionId: 1, tokenStatus: 'Active' })
    tokenRecord.tokenStatus = 'Rotated';
    tokenRecord.rotatedAt = new Date();
    tokenRecord.lastUsedAt = new Date();
    tokenRecord.replacedByTokenId = replacementToken._id;
    await tokenRecord.save();

    await replacementToken.save();

    // Update Session
    session.refreshTokenId = replacementToken._id;
    session.lastActivity = new Date();
    await session.save();

    // Issue new Access Token
    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      roleId: user.roleId.toString(),
      sessionId: session.sessionId,
    });

    await auditService.log({
      userId: user._id,
      roleId: user.roleId,
      actionCode: 'AUTH_REFRESH_TOKEN_ROTATED',
      module: 'Authentication',
      actionTitle: 'Refresh Token Rotated',
      description: 'JWT session renewed and refresh token rotated successfully.',
      ipAddress: context?.ipAddress,
      deviceInfo: context?.userAgent,
      actionStatus: 'Success',
    });

    return {
      accessToken,
      rawRefreshToken: newRawToken,
      user: user as unknown as User & { _id: mongoose.Types.ObjectId },
    };
  }

  public async revokeSession(
    sessionIdStr: string,
    reason:
      | 'User Logout'
      | 'Session Expired'
      | 'Administrator Revoked'
      | 'Account Suspended'
      | 'Security Action' = 'User Logout',
    actorUserId?: mongoose.Types.ObjectId,
  ): Promise<void> {
    const session = await (SessionModel as mongoose.Model<Session>)
      .findOne({ sessionId: sessionIdStr })
      .exec();

    if (!session) return;

    session.sessionStatus = reason === 'User Logout' ? 'Logged Out' : 'Revoked';
    session.logoutTime = new Date();
    session.logoutReason = reason;
    session.revokedAt = reason !== 'User Logout' ? new Date() : null;
    session.revokedBy = actorUserId ?? null;
    await session.save();

    // Revoke active refresh token for this session
    await (RefreshTokenModel as mongoose.Model<RefreshToken>).updateMany(
      { sessionId: session._id, tokenStatus: 'Active' },
      {
        $set: {
          tokenStatus: 'Revoked',
          revokedAt: new Date(),
          revokedReason: reason,
        },
      },
    );

    await auditService.log({
      userId: session.userId,
      actionCode: reason === 'User Logout' ? 'AUTH_LOGOUT' : 'AUTH_SESSION_REVOKED',
      module: 'Authentication',
      actionTitle: reason === 'User Logout' ? 'User Logout' : 'Session Revoked',
      description: `Session ${session.sessionId} terminated. Reason: ${reason}`,
      actionStatus: 'Success',
    });
  }

  public async revokeSessionByToken(
    rawRefreshToken: string,
    reason:
      | 'User Logout'
      | 'Session Expired'
      | 'Administrator Revoked'
      | 'Account Suspended'
      | 'Security Action' = 'User Logout',
  ): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken.trim());
    const tokenRecord = await (RefreshTokenModel as mongoose.Model<RefreshToken>)
      .findOne({ tokenHash })
      .exec();

    if (!tokenRecord) return;

    const session = await (SessionModel as mongoose.Model<Session>)
      .findOne({ _id: tokenRecord.sessionId })
      .exec();

    if (session) {
      await this.revokeSession(session.sessionId, reason, tokenRecord.userId);
    }
  }
}

export const sessionService = new SessionService();
