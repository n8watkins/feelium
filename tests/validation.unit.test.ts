import assert from "node:assert/strict";
import test from "node:test";

import {
  checkInPayloadSchema,
  finiteNonNegativeNumberSchema,
  isoDateSchema,
  profilePreferencesSchema,
  pushSubscriptionSchema,
} from "@/lib/validation";

test("rejects impossible dates and invalid timezone preferences", () => {
  assert.equal(isoDateSchema.safeParse("2026-02-30").success, false);
  assert.equal(isoDateSchema.safeParse("2024-02-29").success, true);
  assert.equal(
    profilePreferencesSchema.safeParse({ timezone: "Mars/Olympus", weekStartsOn: 1 }).success,
    false,
  );
});

test("rejects non-finite, negative, and excessive numeric values", () => {
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -1, 1_000_000_001]) {
    assert.equal(finiteNonNegativeNumberSchema.safeParse(value).success, false);
  }
  assert.equal(finiteNonNegativeNumberSchema.safeParse(0).success, true);
});

test("allows at most one typed value for each check-in outcome", () => {
  const payload = {
    localDate: "2026-07-14",
    note: null,
    values: [
      {
        outcomeMetricId: "metric-1",
        rating: 4,
        boolean: true as boolean | null,
        numeric: null,
      },
    ],
    tagIds: [],
    newTagNames: [],
  };

  assert.equal(checkInPayloadSchema.safeParse(payload).success, false);
  payload.values[0].boolean = null;
  assert.equal(checkInPayloadSchema.safeParse(payload).success, true);
});

test("push subscriptions must point at a browser push service", () => {
  const keys = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQt", auth: "tBHItJI5svbpez7KI4CCXg" };
  for (const endpoint of [
    "https://fcm.googleapis.com/fcm/send/abc123",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://web.push.apple.com/QGuQyavXutnMH",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
  ]) {
    assert.equal(pushSubscriptionSchema.safeParse({ endpoint, keys }).success, true, endpoint);
  }
  // The audit's reproduction pointed 60 subscriptions at https://127.0.0.1:8443/push/N.
  for (const endpoint of [
    "https://127.0.0.1:8443/push/1",
    "https://evil.example/push",
    "https://fcm.googleapis.com.evil.example/fcm/send/abc",
    "https://fcm.googleapis.com:8443/fcm/send/abc",
    "https://user:pass@fcm.googleapis.com/fcm/send/abc",
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://notify.windows.com.evil.example/w",
  ]) {
    assert.equal(pushSubscriptionSchema.safeParse({ endpoint, keys }).success, false, endpoint);
  }
});
