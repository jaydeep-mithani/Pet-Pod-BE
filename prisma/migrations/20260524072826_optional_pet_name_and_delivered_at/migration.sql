-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "deliveredAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Pet" ALTER COLUMN "name" DROP NOT NULL;
