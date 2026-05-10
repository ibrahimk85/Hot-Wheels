-- AlterTable
ALTER TABLE "Image" ADD COLUMN "name" TEXT;
ALTER TABLE "Image" ADD COLUMN "isGalleryImage" BOOLEAN NOT NULL DEFAULT false;



