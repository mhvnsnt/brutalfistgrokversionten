/**
 * Minimal structural type for imported move-string follow-up metadata.
 *
 * Some generated move data carries this field even when the current runtime
 * does not consume the optional metadata. Keep the declaration permissive so
 * imported JSON can be represented without making the combat FSM depend on a
 * specific source schema.
 */
interface StringFollowup {
  move?: string;
  from?: number;
  to?: number;
  [key: string]: unknown;
}
