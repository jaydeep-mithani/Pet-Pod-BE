-- Make passwordHash optional (Google-signed-up users won't have one).
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Add googleId column to link Google OAuth identities.
ALTER TABLE "User" ADD COLUMN "googleId" TEXT;

-- Each Google account can be linked to at most one Pet Pod user.
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
