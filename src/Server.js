
var HTTP_HEADERS = {
	'Connection': 'close', // Prevents the browser to keep the connection open. It allows the server to exit quickly.
	'Cache-Control': 'no-cache' //Make sure that resources are always up-to-date
};
/**
 * Server used to run unit tests
 * 
 * @class Server
 * @constructor
 * 
 * @param config {Object}
 * @param config.path {String} Path to use as root web folder
 * @param [config.port] {Number} Port to use for web server
 * @param [config.coverageDir] {String} Path to coverage directory. Used to write reports from browsers
 */
var Server = function(config) {
	this.config = config;
	this.coverage = null;
};

Server.prototype.start = function(cb) {
	console.log('starting server...');
	var nodeStatic = require('node-static');
	var staticServer = new nodeStatic.Server(this.config.path, {headers: HTTP_HEADERS});
	this.server = require('http').createServer(this.handleRequest.bind(this, staticServer));
	this.server.listen(this.config.port, (function() {
		cb(null, this.server.address());
	}).bind(this));
};

Server.prototype.stop = function(cb) {
	if (this.server) {
		console.log('stoping server');
		this.server.close();
		delete this.server;
		cb();
	}
};

Server.prototype.setCoverage = function(coverage) {
	this.coverage = coverage;
};

Server.prototype.handleRequest = function(staticServer, request, response) {
	if (request.url === '/postResults' && this.coverage && request.method === 'POST') {
		var qs = require('querystring');
		var body = '';
		request.on('data', function (data) {
			body += data;
		});
		request.on('end', function () {
			var postData = qs.parse(body);
			if (postData.coverage) {
				console.log('Adding coverage data for ' + (request.headers['user-agent'] || 'unknown browser'));
				this.coverage.writeFile(postData.coverage);
				response.writeHead(200, HTTP_HEADERS);
				response.end('ok\n');
			} else {
				response.writeHead(400, HTTP_HEADERS);
				response.end('Missing coverage data.\n');
			}
		}.bind(this));
	} else {
		request.addListener('end', function () {
			staticServer.serve(request, response);
		}).resume();
	}
};

module.exports = Server;
