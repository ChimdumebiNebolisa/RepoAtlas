import { greet } from "./utils";

test("greet returns hello", () => {
  expect(greet("world")).toBe("Hello, world!");
});
