-- dedup previa: seeds antiguos podían insertar filas repetidas (no había unique)
DELETE FROM "model_config" mc WHERE EXISTS (
  SELECT 1 FROM "model_config" other
  WHERE other."provider" = mc."provider" AND other."purpose" = mc."purpose" AND other."id" < mc."id"
);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_model_config_provider_purpose" ON "model_config" USING btree ("provider","purpose");
