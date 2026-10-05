import { Injectable } from '@nestjs/common';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { TokenVerifierPort, type VerifiedUser } from '../../application/ports/token-verifier.port';
import { config } from '../../config';

/**
 * Verifica el ID token con las claves públicas de Firebase: basta el project
 * ID, sin cuenta de servicio. Con FIREBASE_AUTH_EMULATOR_HOST va al emulador.
 */
@Injectable()
export class FirebaseTokenVerifier extends TokenVerifierPort {
  private readonly auth = getAuth(getApps()[0] ?? initializeApp({ projectId: config.FIREBASE_PROJECT_ID }));

  async verify(idToken: string): Promise<VerifiedUser> {
    const t = await this.auth.verifyIdToken(idToken);
    return { uid: t.uid, email: t.email, name: typeof t.name === 'string' ? t.name : undefined };
  }
}
