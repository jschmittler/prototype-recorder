/** Thin re-export of the shared core so API routes don't import adapters directly. */
export { createJob, getPublicJob, getServerJob, artifactRef, getStorage } from "@ptw/core";
export type { CreateResult, ArtifactRef } from "@ptw/core";
