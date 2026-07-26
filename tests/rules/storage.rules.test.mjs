import { after, before, beforeEach, describe, test } from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";
import { contextFor, PROJECT_ID, seedBaseData, USERS } from "./test-helpers.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const image = new Uint8Array([137, 80, 78, 71]);
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId:PROJECT_ID,
    firestore:{ rules:await readFile(resolve(here, "../../firestore.rules"), "utf8") },
    storage:{ rules:await readFile(resolve(here, "../../storage.rules"), "utf8") }
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await seedBaseData(env);
});

after(async () => {
  await env?.cleanup();
});

function upload(context, path, metadata = { contentType:"image/png" }) {
  return uploadBytes(ref(context.storage(), path), image, metadata);
}

describe("public storage reads", () => {
  test("公開画像は読め、未定義パスは読めない", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await uploadBytes(ref(context.storage(), "casts/public.png"), image, { contentType:"image/png" });
      await uploadBytes(ref(context.storage(), "private/secret.png"), image, { contentType:"image/png" });
    });
    const storage = env.unauthenticatedContext().storage();
    await assertSucceeds(getBytes(ref(storage, "casts/public.png")));
    await assertFails(getBytes(ref(storage, "private/secret.png")));
  });
});

describe("role based uploads", () => {
  test("ownerは全パスを管理できる", async () => {
    const owner = contextFor(env, USERS.owner);
    await assertSucceeds(upload(owner, "gallery/owner.png"));
    await assertSucceeds(upload(owner, "system/owner.png"));
    await assertSucceeds(upload(owner, "private/owner.txt", { contentType:"text/plain" }));
  });

  test("managerはキャスト画像だけ管理できる", async () => {
    const manager = contextFor(env, USERS.manager);
    await assertSucceeds(upload(manager, "casts/manager.png"));
    await assertFails(upload(manager, "gallery/manager.png"));
    await assertFails(upload(manager, "news/manager.png"));
    await assertFails(upload(manager, "system/manager.png"));
  });

  test("staffはNEWS画像だけ管理できる", async () => {
    const staff = contextFor(env, USERS.staff);
    await assertSucceeds(upload(staff, "news/staff.png"));
    await assertFails(upload(staff, "casts/staff.png"));
    await assertFails(upload(staff, "gallery/staff.png"));
    await assertFails(upload(staff, "system/staff.png"));
  });

  test("画像パスは非画像と10MB超を拒否する", async () => {
    const manager = contextFor(env, USERS.manager);
    await assertFails(upload(manager, "casts/not-image.txt", { contentType:"text/plain" }));
    const oversized = new Uint8Array(10 * 1024 * 1024 + 1);
    await assertFails(uploadBytes(ref(manager.storage(), "casts/large.png"), oversized, { contentType:"image/png" }));
  });
});

describe("cast profile images", () => {
  test("キャストは自分のUID配下へ正しいcastId付きで保存できる", async () => {
    const cast = contextFor(env, USERS.cast);
    const ownPath = `cast-profiles/${USERS.cast.uid}/profile.png`;
    await assertSucceeds(upload(cast, ownPath, { contentType:"image/png", customMetadata:{ castId:"cast-a" } }));
    await assertSucceeds(deleteObject(ref(cast.storage(), ownPath)));
    await assertFails(upload(cast, `cast-profiles/${USERS.otherCast.uid}/profile.png`, { contentType:"image/png", customMetadata:{ castId:"cast-a" } }));
    await assertFails(upload(cast, `cast-profiles/${USERS.cast.uid}/wrong.png`, { contentType:"image/png", customMetadata:{ castId:"cast-b" } }));
  });
});
