-- AlterTable: Add packedOwned and looseOwned fields
ALTER TABLE "Variant" ADD COLUMN "packedOwned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Variant" ADD COLUMN "looseOwned" BOOLEAN NOT NULL DEFAULT false;

-- Migrate existing owned values to packedOwned
UPDATE "Variant" SET "packedOwned" = "owned" WHERE "owned" = true;








