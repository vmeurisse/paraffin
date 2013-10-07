
exports.addUrlParam = function(url, param, value) {
	var urlModule = require('url');
	var u = urlModule.parse(url);
	u.search = (u.search ? u.search + '&' : '?') + encodeURIComponent(param) + '=' + encodeURIComponent(value);
	return urlModule.format(u);
};
