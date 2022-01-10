export class BadRequestError extends Error {
  constructor(message) {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    this.name = "BadRequestError";
    this.stack = new Error().stack;
  }
}
