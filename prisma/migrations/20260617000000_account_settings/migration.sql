-- Account settings: anonymize-delete support.

-- Listing status for taken-down pets (owner deleted account). Kept as a
-- status instead of deleting the row so conversations that cascade from Pet
-- survive for the other participant.
ALTER TYPE "PetStatus" ADD VALUE 'REMOVED';

-- Anonymize-delete marker: non-null blocks login/refresh/JWT validation while
-- the scrubbed row keeps conversations readable for the other side.
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
