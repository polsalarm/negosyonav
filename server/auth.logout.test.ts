import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function makeCtx(user: TrpcContext["user"] = null): TrpcContext {
  return {
    user,
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("auth.logout", () => {
  it("returns success without touching cookies (Firebase signOut is client-side)", async () => {
    const caller = appRouter.createCaller(makeCtx());
    expect(await caller.auth.logout()).toEqual({ success: true });
  });

  it("returns success even when authenticated", async () => {
    const caller = appRouter.createCaller(makeCtx({
      uid: "u1",
      email: "a@b.com",
      name: "A",
      role: "user",
    }));
    expect(await caller.auth.logout()).toEqual({ success: true });
  });
});
