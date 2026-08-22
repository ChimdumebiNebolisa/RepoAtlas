import { normalizeLabel } from "./label";

if (normalizeLabel(" RepoAtlas ") !== "RepoAtlas") {
  throw new Error("label normalization failed");
}
