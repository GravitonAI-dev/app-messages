export interface VerifiedUser {
  uid: string;
  email?: string;
  name?: string;
}

/** Verifica el ID token de Firebase de la app. Lanza si no vale. */
export abstract class TokenVerifierPort {
  abstract verify(idToken: string): Promise<VerifiedUser>;
}
