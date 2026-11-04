import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// Every export of a "use server" module is a server action anyone can call with a POST,
// whether or not a page renders it. The audit created accounts through the disabled
// email/password sign-up this way, so disabled sign-in code must not live in one.
function serverActionExports(dir: string): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      for (const [file, names] of serverActionExports(path)) found.set(file, names);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name)) continue;
    const source = readFileSync(path, "utf8");
    if (!/^\s*["']use server["'];?/.test(source)) continue;
    found.set(path, [...source.matchAll(/export\s+async\s+function\s+(\w+)/g)].map((m) => m[1]));
  }
  return found;
}

test("no server action can create an account or sign in without GitHub", () => {
  const exported = [...serverActionExports("src").values()].flat();
  for (const disabled of ["signUpWithPassword", "signInWithPassword", "sendMagicLink"]) {
    assert.equal(exported.includes(disabled), false, `${disabled} is still a server action`);
  }
  assert.ok(exported.includes("signInWithGitHub"));
});

test("email sign-in is gone: no email or password provider, and no Resend or bcrypt dependency", () => {
  const auth = readFileSync("src/auth.ts", "utf8");
  assert.doesNotMatch(auth, /next-auth\/providers\/(resend|email|nodemailer|credentials)/);
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const name of ["resend", "bcryptjs", "@types/bcryptjs", "nodemailer"]) {
    assert.equal(name in deps, false, `${name} is still a dependency`);
  }
});
