import { config } from "./lib";
import { greet } from "./utils";

export function boot(): void {
  if (config.enabled) {
    console.log(greet("bootstrap"));
  }
}
