-- AlterTable
ALTER TABLE "Theme" ADD COLUMN     "bgEffect" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "entranceEffect" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "textEffect" TEXT NOT NULL DEFAULT 'none';
