import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("hashes passwords with a random salt", async () => {
    const hashA = await hashPassword("secret-value");
    const hashB = await hashPassword("secret-value");
    expect(hashA).not.toBe("secret-value");
    expect(hashA).not.toBe(hashB);
  });

  it("verifies stored hashes", async () => {
    const hash = await hashPassword("hunter2!");
    expect(await verifyPassword("hunter2!", hash)).toBe(true);
    expect(await verifyPassword("nope", hash)).toBe(false);
  });
});
