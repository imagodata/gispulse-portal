/**
 * api/client.ts — Barrel re-export for backward compatibility.
 *
 * Issue #194 (A7-S3): client.ts was a 813-line monolith. It has been split into
 * focused domain modules. This file re-exports everything so existing imports
 * continue to work without modification.
 *
 * New code should import directly from the domain module:
 *   import { uploadDataset } from "@/api/datasets"
 *   import { listProjects }   from "@/api/projects"
 *   import { createScenario } from "@/api/scenarios"
 *   import { searchFlux }     from "@/api/catalog"
 */

// Core request helpers
export { request, isBackendAlive } from "./request"

// Datasets, features, SQL, capabilities
export {
  DuplicateDatasetError,
  isProjectDataset,
  isSessionDataset,
  uploadDataset,
  listDatasets,
  deleteDatasetApi,
  renameDatasetApi,
  getDatasetStyles,
  exportGpkg,
  exportLayers,
  importDatasetFromUrl,
  getFeatures,
  listCapabilities,
  createFeature,
  deleteFeature,
  updateFeatureApi,
  sqlExecute,
  sqlExport,
  previewSQL,
  getDistinctValues,
  getFieldStats,
} from "./datasets"
export type { FeatureCollection, SQLPreviewResult, DistinctValuesResult, FieldStatsResult } from "./datasets"

// Projects, rules, triggers, jobs, stats
export {
  listProjects,
  createProject,
  deleteProjectApi,
  getProjectStats,
  getProjectActivity,
  listRules,
  createRuleApi,
  updateRuleApi,
  deleteRuleApi,
  getRuleAsNode,
  createRuleFromNode,
  listTriggers,
  createTriggerApi,
  updateTriggerApi,
  deleteTriggerApi,
  toggleTriggerApi,
  evaluateTriggerApi,
  openEvalStream,
  createJob,
  getJob,
} from "./projects"
export type {
  ProjectStats,
  ActivityEventItem,
  ActivityResponse,
  NodeDefinition,
  EvaluateChangeRecord,
  JobResponse,
} from "./projects"

// Scenarios
export {
  listScenarios,
  createScenario,
  getScenario,
  updateScenario,
  deleteScenario,
  runScenario,
  runScenarioNode,
} from "./scenarios"
export type {
  ScenarioResponse,
  ScenarioListResponse,
  NodeResult,
  ScenarioRunResult,
  RunNodeResult,
} from "./scenarios"

// Catalog
export {
  listCatalogProviders,
  searchProjections,
  getCachedBasemaps,
  searchBasemaps,
  searchFlux,
  searchOpenData,
  searchCatalog,
  getCatalogEntry,
  searchWorldwide,
  createVirtualDataset,
  previewVirtualDataset,
  materializeVirtualDataset,
} from "./catalog"

// Relations (Hybrid Schema)
export {
  listRelations,
  getRelation,
  createRelation,
  updateRelation,
  deleteRelation,
  confirmRelation,
  attachTrigger,
  detachTrigger,
  addComputation,
  removeComputation,
  previewSQL as previewRelationSQL,
  detectRelationsApi,
} from "./relations"
export type { TableRelation, ComputedField, RelationCreate } from "./relations"

// Filter (interactive spatial filtering)
export {
  listPredicates,
  previewFilter,
  applyFilter,
} from "./filter"
export type {
  FilterRequest,
  FilterPreviewResponse,
  FilterApplyResponse,
  SpatialPredicateInfo,
} from "./filter"
