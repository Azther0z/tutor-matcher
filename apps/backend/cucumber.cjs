/** @type {import('@cucumber/cucumber').IConfiguration} */
module.exports = {
  default: {
    paths: ["features/**/*.feature"],
    loader: ["ts-node/esm"],
    import: ["features/support/**/*.ts", "features/step_definitions/**/*.ts"],
    format: ["progress"],
  },
};
