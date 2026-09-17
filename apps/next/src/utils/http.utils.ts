import "server-only";
import { z } from "zod";

import type { ApiHandler, ApiInputs } from "@/types/http.types";
import type { ResponseBodyError } from "@/types/http.types";
import type { ResponseBodySuccess } from "@/types/http.types";

export const httpStatus = {
  ok: 200,
  badRequest: 400,
  unauthorized: 401,
  unprocessableContent: 422,
  internalServerError: 500
} as const;

const DEFAULT_ERROR_LABEL = "Internal server error";

const errorLabels: Record<number, string> = {
  [httpStatus.badRequest]: "Malformed JSON body",
  [httpStatus.unauthorized]: "Unauthorized",
  [httpStatus.unprocessableContent]: "Invalid request input",
  [httpStatus.internalServerError]: DEFAULT_ERROR_LABEL
};

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const getErrorLabel = (status: number) => {
  return errorLabels[status] ?? DEFAULT_ERROR_LABEL;
};

const jsonError = (status: number, body?: Partial<ResponseBodyError>) => {
  const error = getErrorLabel(status);
  const payload = { error, ...body };

  return Response.json(payload, { status });
};

export const HttpResponse = {
  ok: <T>(body: ResponseBodySuccess<T>) => {
    return Response.json(body, { status: httpStatus.ok });
  },
  badRequest: (body?: Partial<ResponseBodyError>) => {
    return jsonError(httpStatus.badRequest, body);
  },
  unauthorized: (body?: Partial<ResponseBodyError>) => {
    return jsonError(httpStatus.unauthorized, body);
  },
  unprocessableContent: (body?: Partial<ResponseBodyError>) => {
    return jsonError(httpStatus.unprocessableContent, body);
  },
  internalServerError: (body?: Partial<ResponseBodyError>) => {
    return jsonError(httpStatus.internalServerError, body);
  }
};

export const parseJsonBody = async (request: Request): Promise<unknown> => {
  const text = await request.text();

  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(httpStatus.badRequest, "Malformed JSON body");
  }
};

const toErrorResponse = (error: unknown) => {
  if (error instanceof HttpError) {
    return jsonError(error.status, { error: error.message });
  }

  return HttpResponse.internalServerError();
};

const toInputErrorResponse = (error: unknown) => {
  if (!(error instanceof z.ZodError)) {
    return toErrorResponse(error);
  }

  const paths = error.issues.map(issue => {
    return issue.path.join(".");
  });
  const details = { paths };

  return HttpResponse.unprocessableContent({ details });
};

const validateOutput = async <T extends z.ZodType>(
  response: Promise<Response>,
  validation: T
) => {
  const result = await response;

  if (!result.ok) {
    return result;
  }

  try {
    const schema = z.object({ data: validation });
    const body = schema.parse(await result.json());

    return Response.json(body, { status: result.status });
  } catch {
    return HttpResponse.internalServerError();
  }
};

export const api = (
  request: Request,
  body?: unknown,
  params: ApiInputs["params"] = {}
) => {
  return {
    input: <T extends z.ZodType>(validation: T) => {
      return {
        handle: (handler: ApiHandler<z.output<T>>) => {
          const response = (async () => {
            let inputs: z.output<T>;

            try {
              const headers = Object.fromEntries(request.headers);
              const searchParams = Object.fromEntries(
                new URL(request.url).searchParams
              );
              const rawBody =
                body === undefined ? await parseJsonBody(request) : body;
              const raw = { headers, searchParams, body: rawBody, params };

              inputs = validation.parse(raw);
            } catch (error) {
              return toInputErrorResponse(error);
            }

            try {
              return await handler(inputs);
            } catch (error) {
              return toErrorResponse(error);
            }
          })();

          return {
            response,
            output: <TOutput extends z.ZodType>(schema: TOutput) => {
              return validateOutput(response, schema);
            }
          };
        }
      };
    }
  };
};
