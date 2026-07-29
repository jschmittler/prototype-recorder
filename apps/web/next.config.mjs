import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Compile the workspace TS packages (they ship source, no build step).
  transpilePackages: ["@ptw/job-contracts", "@ptw/engine-adapter", "@ptw/script-generator"],
  reactStrictMode: true,
  // Pin the monorepo root so file tracing ignores unrelated parent lockfiles.
  outputFileTracingRoot: path.resolve(here, "../.."),
};

export default nextConfig;
