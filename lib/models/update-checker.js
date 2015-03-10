'use strict';

var Promise         = require('../ext/promise');
var emberCLIVersion = require('../utilities/ember-cli-version');
var chalk           = require('chalk');
var debug           = require('debug')('ember-cli:update-checker');

module.exports = UpdateChecker;

function UpdateChecker(ui, settings, localVersion) {
  this.ui = ui;
  this.settings = settings;
  this.localVersion = localVersion || emberCLIVersion();
  this.versionConfig = null;

  debug('version: %s', this.localVersion);
  debug('version: %o', this.settings);
}

/**
* Checks local config or npm for most recent version of ember-cli
*/
UpdateChecker.prototype.checkForUpdates = function() {
  // if 'checkForUpdates' is true, check for an updated ember-cli version
  debug('checkingcheckForUpdates: %o', this.settings.checkingcheckForUpdates);
  if (this.settings.checkForUpdates) {
    return this.doCheck().then(function(updateInfo) {
      debug('updatedNeeded %o', updateInfo.updateNeeded);
      if (updateInfo.updateNeeded) {
        this.ui.writeLine('');
        this.ui.writeLine('A new version of ember-cli is available (' +
                          updateInfo.newestVersion + '). To install it, type ' +
                          chalk.green('ember update') + '.');
      }
      return updateInfo;
    }.bind(this));
  } else {
    return Promise.resolve({
      updateNeeded: false
    });
  }
};

UpdateChecker.prototype.doCheck = function() {
  this.versionConfig = this.versionConfig || new (require('configstore'))('ember-cli-version');
  var lastVersionCheckAt = this.versionConfig.get('lastVersionCheckAt');
  var now = new Date().getTime();

  return new Promise(function(resolve, reject) {
    // if the last check was less than a day ago, don't remotely check version
    if (lastVersionCheckAt && lastVersionCheckAt > (now - 86400000)) {
      resolve(this.versionConfig.get('newestVersion'));
    }

    reject();
  }.bind(this)).catch(function() {
    return this.checkNPM();
  }.bind(this)).then(function(version) {
    return {
      updateNeeded: version && require('semver').lt(this.localVersion, version),
      newestVersion: version
    };
  }.bind(this));
};

UpdateChecker.prototype.checkNPM = function() {
  // make an http call to npm to get the latest version
  var http = require('http');
  var concat = require('concat-stream');

  return new Promise(function(resolve, reject) {

    // default host and path, w/o proxy
    var reqOptions = {
      host: 'http://registry.npmjs.org',
      path: '/ember-cli/latest'
    };

    if (this.settings.http_proxy){
      var proxy = require('url').parse(this.settings.http_proxy);
      reqOptions = {
        host: proxy.hostname,
        port: proxy.port,
        path: 'http://registry.npmjs.org/ember-cli/latest'
      };
    }

    http.get(reqOptions, function(res) {
      res.setEncoding('utf8');

      res.pipe(concat(function (data) {
        try {

          resolve(JSON.parse(data).version);
        } catch(error) {
          reject(error);
        }
      }));
      res.on('error', reject);
    }).on('error', function(error){
        reject(error);
    });

  }.bind(this)).then(function(version) {
    // we only want to save the version information when we check NPM
    return this.saveVersionInformation(version);
  }.bind(this)).catch(function(error) {
    this.ui.writeLine(chalk.red('There was an error checking NPM for an update.'));
    this.ui.writeLine(chalk.red('This is most likely not a problem with npm ' +
                      'itself and in most cases you are behind a proxy or bad ' +
                      'network settings. If you are beind the proxy make sure ' +
                      'your environment variable http_proxy is set.\n'));
    throw error;
  }.bind(this));
};

UpdateChecker.prototype.saveVersionInformation = function(version) {
  var versionConfig = this.versionConfig;
  var now = new Date().getTime();

  // save version so we don't have to check again for another day
  versionConfig.set('newestVersion', version);
  versionConfig.set('lastVersionCheckAt', now);
};
