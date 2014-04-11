'use strict';

/**
 * Run [Sauce Connect](https://saucelabs.com/docs/connect)
 * 
 * @class SauceConnect
 * @constructor
 * 
 * @param config {Object}
 * @param [config.user] {String} username for sauceLabs
 * @param [config.key] {String} key on sauceLabs
 */
var SauceConnect = function(config) {
	this.config = config;
};

/**
 * Start the tunnel
 * 
 * @method start
 * 
 * @param cb {function}
 * @return this
 */
SauceConnect.prototype.start = function(cb) {
	var options = {
		username: this.config.user,
		accessKey: this.config.key,
		verbose: false,
		logger: function() {}
	};
	var sauceConnectLauncher = require('sauce-connect-launcher');
	sauceConnectLauncher(options, function (err, sauceConnectProcess) {
		if (err) {
			cb('Error launching sauce connect: ' + err);
			return;
		}
		this.sauceConnect = sauceConnectProcess;
		cb();
	}.bind(this));
	return this;
};

/**
 * Stop the tunnel
 * 
 * @method stop
 * 
 * @param cb {function}
 */
SauceConnect.prototype.stop = function(cb) {
	this.sauceConnect.close(cb);
	delete this.sauceConnect;
};

exports = module.exports = SauceConnect;
