
var url = require('url');
var qs = require('querystring');

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
 */
var Server = function(config) {
	this.config = config;
	this.coverage = null;
	this.requestHandlers = [];
};

Server.prototype.start = function(cb) {
	var nodeStatic = require('node-static');
	this.staticServer = new nodeStatic.Server(this.config.path, {headers: HTTP_HEADERS});
	this.server = require('http').createServer(this.handleRequest.bind(this));
	this.server.listen(this.config.port, function() {
		this.addPingHandler();
		cb(null, this.server.address());
	}.bind(this));
};

Server.prototype.stop = function(cb) {
	if (this.server) {
		this.server.close(function() {
			delete this.server;
			cb();
		}.bind(this));
	}
};

Server.prototype.setCoverage = function(coverage) {
	this.coverage = coverage;
	this.addHandler('/postResults', function(request, response) {
		if (request.postData.coverage) {
			console.log('Adding coverage data for ' + (request.headers['user-agent'] || 'unknown browser'));
			this.coverage.writeFile(request.postData.coverage);
			response.writeHead(200, HTTP_HEADERS);
			response.end('ok\n');
		} else {
			console.log('Missing coverage data for ' + (request.headers['user-agent'] || 'unknown browser'));
			response.writeHead(400, HTTP_HEADERS);
			response.end('Missing coverage data.\n');
		}
	}.bind(this));
};

Server.prototype.addPingHandler = function() {
	this.addHandler('/ping', function(request, response) {
		response.setHeader('Content-Type', request.url.query.jsonP ? 'application/javascript' : 'application/json');
		response.writeHead(200, HTTP_HEADERS);
		var data = JSON.stringify({
			url: request.url,
			post: request.postData,
			headers: request.headers,
			method: request.method
		});
		var prefix = request.url.query.jsonP ? request.url.query.jsonP + '(' : '';
		var postfix = request.url.query.jsonP ? ');\n' : '\n';
		response.end(prefix + data + postfix);
	});
};

Server.prototype.addPostHandler = function(url, cb) {
	this.addHandler(url, function(request, response) {
		cb(request.postData);
		response.writeHead(200, HTTP_HEADERS);
		response.end('ok\n');
	});
};

Server.prototype.addHandler = function(url, cb) {
	this.requestHandlers.push({url: url, callback: cb});
};

Server.prototype.handleRequest = function(request, response) {
	var body = '';
	if (request.method === 'POST') {
		request.on('data', function (data) {
			body += data;
		});
	}
	request.on('end', function () {
		var postData = (request.method === 'POST') ? qs.parse(body) : {};
		var parsedUrl = url.parse(request.url, true);
		request.postData = postData;
		
		for (var i = 0; i < this.requestHandlers.length; i++) {
			if (parsedUrl.pathname === this.requestHandlers[i].url) {
				request.url = parsedUrl;
				this.requestHandlers[i].callback(request, response);
				return;
			}
		}
		
		this.staticServer.serve(request, response);
	}.bind(this));
	request.resume();
};

module.exports = Server;
