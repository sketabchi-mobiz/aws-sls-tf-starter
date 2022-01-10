import "reflect-metadata";
const Jasmine = require("jasmine");
const SpecReporter = require("jasmine-spec-reporter").SpecReporter;

const runner = new Jasmine();

// A single spec file can be passed in as an argument to execute just that file
// If not provided, then all tests will execute
const specFile = process.argv[2];

runner.loadConfig({
  spec_dir: "src",
  spec_files: [
    specFile ?? "**/*[sS]pec.[jt]s"
  ],
  helpers: []
});

// Setup reporter
runner.env.clearReporters();
runner.env.addReporter(new SpecReporter({  // add jasmine-spec-reporter
  spec: {
    displayPending: true
  }
}));

runner.execute();
