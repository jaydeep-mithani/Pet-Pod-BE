export interface JwtPayload {
  sub: string;
  email: string;
}

export interface AuthenticatedRequestUser {
  id: string;
  email: string;
}
