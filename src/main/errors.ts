import * as z from 'zod'
import type { Failure } from '$shared/api'

const SystemError = z.object({ code: z.string() })

export function errorCode(cause: unknown): string | undefined {
  return SystemError.safeParse(cause).data?.code
}

export function failure(cause: unknown): Failure {
  return { status: 'failed', message: cause instanceof Error ? cause.message : String(cause) }
}
