import type { DbOrTx } from "@kuki/drizzle";
import { documentEvents } from "@kuki/drizzle/schema";
import type { DocumentEventType } from "@kuki/types";

export async function recordEvent(
  db: DbOrTx,
  documentId: string,
  type: DocumentEventType,
  message: string,
  attempt?: number,
) {
  await db
    .insert(documentEvents)
    .values({ documentId, type, message, attempt });
}
