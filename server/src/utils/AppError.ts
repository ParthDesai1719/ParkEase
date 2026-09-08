export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  errorCode?: string;

  constructor(message: string, statusCode = 500, errorCode?: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = true;
    if (errorCode !== undefined) {
      this.errorCode = errorCode;
    }

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
