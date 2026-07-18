import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";

const nextDir = path.resolve(".next");
const buildManifestPath = path.join(nextDir, "build-manifest.json");

const routeBudgets = [
  {
    name: "homepage entry",
    manifest: "server/app/(homepage)/page_client-reference-manifest.js",
    moduleSuffix: "src/components/HomePage.tsx",
    maxGzipBytes: 245_000,
  },
  {
    name: "completed report",
    manifest: "server/app/report/[id]/page_client-reference-manifest.js",
    moduleSuffix: "src/app/report/[id]/page.tsx",
    maxGzipBytes: 242_000,
  },
  {
    name: "shared report",
    manifest: "server/app/share/[token]/page_client-reference-manifest.js",
    moduleSuffix: "src/app/share/[token]/page.tsx",
    maxGzipBytes: 242_000,
  },
];

function fail(message) {
  console.error(`Client bundle budget check failed: ${message}`);
  process.exitCode = 1;
}

function readRouteManifest(relativePath) {
  const manifestPath = path.join(nextDir, relativePath);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`missing route manifest ${relativePath}; run the production build first`);
  }

  const context = { globalThis: {} };
  vm.runInNewContext(fs.readFileSync(manifestPath, "utf8"), context, {
    filename: manifestPath,
  });
  const manifests = context.globalThis.__RSC_MANIFEST;
  const manifest = manifests && Object.values(manifests)[0];
  if (!manifest?.clientModules) {
    throw new Error(`could not read client modules from ${relativePath}`);
  }
  return manifest;
}

function routeFiles(buildManifest, route) {
  const routeManifest = readRouteManifest(route.manifest);
  const routeModule = Object.entries(routeManifest.clientModules).find(([modulePath]) =>
    modulePath.replaceAll("\\", "/").endsWith(route.moduleSuffix)
  );
  if (!routeModule) {
    throw new Error(`could not find ${route.moduleSuffix} in ${route.manifest}`);
  }

  const routeChunks = routeModule[1].chunks.filter((entry) =>
    String(entry).endsWith(".js")
  );
  return [...new Set([...buildManifest.rootMainFiles, ...routeChunks])].map((file) =>
    decodeURIComponent(file)
  );
}

function measure(files) {
  let rawBytes = 0;
  let gzipBytes = 0;
  for (const file of files) {
    const filePath = path.join(nextDir, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`missing client chunk ${file}`);
    }
    const contents = fs.readFileSync(filePath);
    rawBytes += contents.byteLength;
    gzipBytes += zlib.gzipSync(contents).byteLength;
  }
  return { rawBytes, gzipBytes };
}

try {
  if (!fs.existsSync(buildManifestPath)) {
    throw new Error("missing .next/build-manifest.json; run the production build first");
  }
  const buildManifest = JSON.parse(fs.readFileSync(buildManifestPath, "utf8"));

  for (const route of routeBudgets) {
    const files = routeFiles(buildManifest, route);
    const result = measure(files);
    const status = result.gzipBytes <= route.maxGzipBytes ? "PASS" : "FAIL";
    console.log(
      `${status} ${route.name}: ${result.gzipBytes.toLocaleString()} gzip bytes ` +
        `(${result.rawBytes.toLocaleString()} raw), budget ${route.maxGzipBytes.toLocaleString()}`
    );
    if (status === "FAIL") {
      fail(
        `${route.name} is ${(result.gzipBytes - route.maxGzipBytes).toLocaleString()} gzip bytes over budget`
      );
    }
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
