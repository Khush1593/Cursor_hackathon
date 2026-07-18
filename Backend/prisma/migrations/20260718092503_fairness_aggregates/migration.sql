-- Non-PHI fairness aggregates (durable Nest storage; Python counters reset on restart)
CREATE TABLE "FairnessAggregate" (
    "id" TEXT NOT NULL,
    "ageBand" TEXT NOT NULL,
    "sexGroup" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "detectedMode" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FairnessAggregate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FairnessAggregate_ageBand_sexGroup_actionType_detectedMode_key"
  ON "FairnessAggregate"("ageBand", "sexGroup", "actionType", "detectedMode");

CREATE INDEX "FairnessAggregate_actionType_detectedMode_idx"
  ON "FairnessAggregate"("actionType", "detectedMode");
