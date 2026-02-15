import { greet } from "./utils";
import { boot } from "./bootstrap";

export function main() {
  boot();
  console.log(greet("world"));
}

main();
