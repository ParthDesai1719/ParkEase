export const authConfig = {
  jwtSecret: process.env.JWT_SECRET ?? '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
};

if (!authConfig.jwtSecret) {
  throw new Error('JWT_SECRET is not defined in the environment variables');
}
