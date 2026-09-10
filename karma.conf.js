/**
 * Karma runs headless by default here.
 *
 * The builder's default browser is headed `Chrome`, which meant `npm test`
 * could not run in CI, in a container, or on any machine without Chrome
 * installed — which is why the README carried a CHROME_BIN workaround. With
 * this config the suite runs anywhere a Chromium binary exists, and CHROME_BIN
 * still points it at Edge or another build when Chrome itself is absent.
 *
 * --no-sandbox is required inside the usual CI containers and is harmless
 * locally; the pages under test are this project's own specs.
 */
module.exports = function (config) {
  config.set({
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    reporters: ['progress', 'kjhtml'],
    browsers: ['ChromeHeadlessCI'],
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu'],
      },
    },
    restartOnFileChange: true,
  });
};
