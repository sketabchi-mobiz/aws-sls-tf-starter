/**
 * Declares IoC identifiers as symbols for declaration
 * and injection throughout the application.
 */
export const ContainerKeys = {
  envConfig: Symbol.for("envConfig"),
  requestService: Symbol.for("requestService"),
  exampleDynamoRepositoryInterface: Symbol.for("exampleDynamoRepositoryInterface"),
  apiRequestFactory: Symbol.for("apiRequestFactory")
};
