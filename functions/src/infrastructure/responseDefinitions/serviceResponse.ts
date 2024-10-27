type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INTERNAL_ERROR"
  | "BAD_REQUEST"
interface ServiceError {
  code: ErrorCode
  message: string
  details?: unknown
}

export class ServiceResponse<T = unknown> {
  public readonly success: boolean
  public readonly data: T | null
  public readonly error: ServiceError | null

  private constructor(
    success: boolean,
    data: T | null,
    error: ServiceError | null
  ) {
    this.success = success
    this.data = data
    this.error = error

    // Log asynchronously
    //this.log();
  }

  static success<T>(data: T): ServiceResponse<T> {
    return new ServiceResponse<T>(true, data, null)
  }

  static error<T = never>(
    error: Error | ServiceError | string
  ): ServiceResponse<T> {
    let serviceError: ServiceError

    if (typeof error === "string") {
      serviceError = {
        code: "INTERNAL_ERROR",
        message: error,
      }
    } else if (error instanceof Error) {
      serviceError = {
        code: (error as any).code || "INTERNAL_ERROR",
        message: error.message,
        details: error.stack,
      }
    } else {
      serviceError = error
    }

    return new ServiceResponse<T>(false, null, serviceError)
  }

  // Helper method to easily check if response has data
  hasData(): this is ServiceResponse<T> & { data: T } {
    return this.data !== null
  }

  // Helper method to check if response has error
  hasError(): this is ServiceResponse<T> & { error: ServiceError } {
    return this.error !== null
  }
}
