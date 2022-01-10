export class ProxyError extends Error {
  constructor(message) {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    this.name = "ProxyError";
    this.stack = new Error().stack;
  }
}
