import { z } from 'zod';

// D9: zod v4 native RFC 9562 validator — version-checked, no custom regex.
export const UuidV7Schema = z.uuidv7();

export type UuidV7 = z.infer<typeof UuidV7Schema>;
