export interface JwtPayload {
  sub: string;
  email: string;
  // Standard JWT issued-at (seconds since epoch). passport-jwt populates
  // this automatically; we read it in the strategy to revoke tokens issued
  // before the user's last passwordChangedAt.
  iat?: number;
}

export interface AuthenticatedRequestUser {
  id: string;
  email: string;
}
