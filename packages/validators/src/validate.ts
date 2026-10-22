import type { RequestHandler } from "express";
import type { ZodType } from "zod";

/**
 * Validates `req.body`, `req.params` and/or `req.query` against the given
 * schemas. Responds 400 with the issues on failure; on success replaces them
 * with the parsed values.
 */
export function validate(schemas: {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}): RequestHandler {
  return (req, res, next) => {
    for (const part of ["body", "params", "query"] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part]);
      if (!result.success) {
        res.status(400).json({
          error: "invalid_request",
          issues: result.error.issues.map((i) => ({
            path: [part, ...i.path].join("."),
            message: i.message,
          })),
        });
        return;
      }
      // Express 5 makes `req.query` a getter, so shadow it on the instance.
      Object.defineProperty(req, part, {
        value: result.data,
        writable: true,
        configurable: true,
      });
    }
    next();
  };
}
