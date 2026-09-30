-- CreateTable
CREATE TABLE "ExhibitImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exhibitId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT NOT NULL,
    CONSTRAINT "ExhibitImage_exhibitId_fkey" FOREIGN KEY ("exhibitId") REFERENCES "PhysicalExhibit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExhibitImage_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExhibitTransferLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exhibitId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromLocation" TEXT,
    "toLocation" TEXT,
    "reason" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExhibitTransferLog_exhibitId_fkey" FOREIGN KEY ("exhibitId") REFERENCES "PhysicalExhibit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExhibitTransferLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PhysicalExhibit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "exhibitNumber" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL,
    "serialNumber" TEXT,
    "identifyingMarks" TEXT,
    "recoveryDate" DATETIME,
    "recoveryLocation" TEXT,
    "recoveringOfficerId" TEXT,
    "sourcePerson" TEXT,
    "witnesses" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_CUSTODY',
    "currentLocation" TEXT NOT NULL,
    "storageRequirements" TEXT,
    "disposalEligibilityDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PhysicalExhibit_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PhysicalExhibit_recoveringOfficerId_fkey" FOREIGN KEY ("recoveringOfficerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PhysicalExhibit" ("caseId", "createdAt", "currentLocation", "description", "exhibitNumber", "id", "status", "updatedAt") SELECT "caseId", "createdAt", "currentLocation", "description", "exhibitNumber", "id", "status", "updatedAt" FROM "PhysicalExhibit";
DROP TABLE "PhysicalExhibit";
ALTER TABLE "new_PhysicalExhibit" RENAME TO "PhysicalExhibit";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
