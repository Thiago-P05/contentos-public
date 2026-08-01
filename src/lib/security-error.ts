import "server-only";

export class SecurityError extends Error {
  status: number;
  publicMessage: string;

  constructor(status: number, publicMessage: string) {
    super(publicMessage);
    this.name = "SecurityError";
    this.status = status;
    this.publicMessage = publicMessage;
  }
}
