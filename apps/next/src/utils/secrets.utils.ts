import { timingSafeEqual } from "node:crypto";

export const isCronAuthorized = (
  authorization: string | null | undefined,
  secret: string | undefined
) => {
  if (!secret || secret.length < 32 || !authorization) {
    return false;
  }

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization);

  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
};
