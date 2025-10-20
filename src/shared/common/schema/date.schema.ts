import z from 'zod';

/**
 * Date schema in YYYY-MM-DD format
 *
 * date.parse("2020-01-01"); // ✅
 * date.parse("2020-1-1"); // ❌
 * date.parse("2020-01-32"); // ❌
 */
export const DateSchema = z.iso.date();

/**
 * Date and time schema in ISO 8601 format
 *
 *
 * // Z is still supported
 * datetime.parse("2020-01-01T06:15:00Z"); // ✅
 * datetime.parse("2020-01-01T06:15:00.123Z"); // ✅
 * datetime.parse("2020-01-01T06:15:00.123456Z"); // ✅ (arbitrary precision)
 * datetime.parse("2020-01-01T06:15:00+02:00"); // ❌ (offsets not allowed)
 * datetime.parse("2020-01-01T06:15:00"); // ❌ (local not allowed)
 *
 * // allows timezone offsets
 * datetime.parse("2020-01-01T06:15:00+02:00"); // ✅
 *
 * // basic offsets not allowed
 * datetime.parse("2020-01-01T06:15:00+02");    // ❌
 * datetime.parse("2020-01-01T06:15:00+0200");  // ❌
 */
export const DateTimeSchema = z.iso.datetime({ offset: true });
