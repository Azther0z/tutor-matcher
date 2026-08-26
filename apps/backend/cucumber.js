/** @type {import('@cucumber/cucumber').IConfiguration} */
module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    requireModule: ['ts-node/register'],
    require: ['features/support/**/*.ts', 'features/step_definitions/**/*.ts'],
    format: ['progress'],
  },
};
