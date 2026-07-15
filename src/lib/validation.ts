import { z } from "zod";

import { isValidTimeZone, parseISODate } from "@/lib/date";

export const MAX_NAME_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 1_000;
export const MAX_NOTE_LENGTH = 5_000;
export const MAX_UNIT_LENGTH = 40;
export const MAX_ID_LENGTH = 128;
export const MAX_NUMERIC_VALUE = 1_000_000_000;

export const recordIdSchema = z.string().min(1).max(MAX_ID_LENGTH);

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) => parseISODate(value).toISOString().slice(0, 10) === value,
    "Enter a real calendar date.",
  );

export function isISODate(value: string): boolean {
  return isoDateSchema.safeParse(value).success;
}

export const finiteNonNegativeNumberSchema = z
  .number()
  .finite()
  .min(0)
  .max(MAX_NUMERIC_VALUE);

const checkInValueSchema = z
  .object({
    outcomeMetricId: recordIdSchema,
    rating: z.number().int().min(1).max(5).nullable(),
    boolean: z.boolean().nullable(),
    numeric: finiteNonNegativeNumberSchema.nullable(),
  })
  .strict()
  .refine(
    (value) =>
      [value.rating, value.boolean, value.numeric].filter((item) => item !== null)
        .length <= 1,
    "Only one value may be recorded for an outcome.",
  );

export const checkInPayloadSchema = z
  .object({
    localDate: isoDateSchema,
    note: z.string().trim().max(MAX_NOTE_LENGTH).nullable(),
    values: z.array(checkInValueSchema).max(100),
    tagIds: z.array(recordIdSchema).max(100).transform((values) => [...new Set(values)]),
    newTagNames: z
      .array(z.string().trim().min(1).max(MAX_NAME_LENGTH))
      .max(50)
      .transform((values) => [...new Set(values)]),
  })
  .strict();

export const profilePreferencesSchema = z
  .object({
    timezone: z.string().trim().refine(isValidTimeZone, "Choose a valid timezone."),
    weekStartsOn: z.number().int().min(0).max(6),
  })
  .strict();

export const reminderSettingsSchema = z
  .object({
    isEnabled: z.boolean(),
    reminderTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable(),
    timezone: z.string().trim().refine(isValidTimeZone),
  })
  .strict();

export const pushSubscriptionSchema = z
  .object({
    endpoint: z.string().url().startsWith("https://").max(2_048),
    expirationTime: z.number().finite().nullable().optional(),
    keys: z
      .object({
        p256dh: z.string().min(16).max(512),
        auth: z.string().min(8).max(256),
      })
      .strict(),
  })
  .strict();

export const deviceNameSchema = z.string().trim().min(1).max(MAX_NAME_LENGTH).optional();

export function boundedText(value: FormDataEntryValue | null, maximum: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, maximum);
}
