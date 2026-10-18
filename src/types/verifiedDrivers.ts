import type { DriverParticipationStatus } from './index';

export interface VerifiedDriverAddition {
  driverId: string;
  upstreamId: string;
  givenName: string;
  familyName: string;
  dateOfBirth: string | null;
  nationality: string;
  entryCount: number;
  participationStatus: DriverParticipationStatus;
  participationNote: string;
  verificationNotes: string;
  recentConstructorId: string | null;
  recentConstructorName: string | null;
  sourceUrls: string[];
}
