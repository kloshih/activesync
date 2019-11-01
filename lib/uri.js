
var Path = require('path');
// var log = require('log');

class Uri {

  constructor(text, opts) {
    if (text == null)
      throw new Error("Uri text required");
    if (text instanceof Uri)
      text = text.format()
    this.text = text;
    this.parts = Uri.parse(text, opts);
    this.hostIndex = 0;
  }

  toString() {
    return this.format()
  }

  uri(opts) {

  }

  format(opts) {
    const text = [];//, parts = this.parts;
//    if (typeof(opts) != 'object') {
//      log('info', "opts is not an object: #byl[%s]", opts);
//      throw new Error();
//    }
    // log('info', "#wh[this.parts %s]\n#wh[opts %s]", this.parts, opts);
    var parts = Object.assign({}, this.parts, opts);
    // log('info', "parts: #byl[%s]\n#wh[parts %s]\n#wh[opts]", parts, this.parts, opts);

    if (parts.scheme) text.push(parts.scheme, ':');
    if (parts.opaque) {
      text.push(parts.opaque);
    } else {
      if (parts.user || parts.pass || parts.hosts && parts.hosts.length > 0) {
        text.push('//');
        if (parts.user || parts.pass) {
          if (parts.user) text.push(encodeURIComponent(parts.user));
          if (parts.pass) text.push(':', encodeURIComponent(parts.pass));
          text.push('@');
        }
        var defaultPort = opts && opts.defaultPort || Uri.defaultPorts()[parts.scheme] || null;
        parts.hosts && parts.hosts.forEach(function(host, index) {
          if (index > 0) text.push(',');
          if (host.name) text.push(encodeURIComponent(host.name));
          if (host.port && (host.port !== defaultPort || opts && opts.includePort))
            text.push(':', host.port);
        });
      }
      if (parts.path) text.push(parts.path);
    }
    if (parts.query && Object.keys(parts.query).length > 0) text.push('?', Uri.formatQuery(parts.query));
    if (parts.fragment) text.push('#', encodeURIComponent(parts.fragment));
    if (parts.next) text.push('|', Uri.coerce(parts.next).format())
    else if (!('next' in parts) && this.next) text.push('|', this.next.format());
    return text.join('');
  }

  get scheme() { return this.parts.scheme }
  set scheme(v) { return this.parts.scheme = v }
  get protocol() { return this.parts.scheme }
  set protocol(v) { return this.parts.scheme = v }
  get opaque() { return this.parts.opaque }
  set opaque(v) { return this.parts.opaque = v }
  get user() { return this.parts.user }
  set user(v) { return this.parts.user = v }
  get pass() { return this.parts.pass }
  set pass(v) { return this.parts.pass = v }
  get hosts() { return this.parts.hosts }
  set hosts(v) { return this.parts.host = v }
  get host() {
    // log('info', "Retrieving host #gr[%s] from hosts #gr[%s]", this.hostIndex, this.parts.hosts);
    return this.parts.hosts[this.hostIndex % this.parts.hosts.length];
  }
  get hostname() { return this.host && this.host.name }
  get port() { return this.host.port }
  get path() { return this.parts.path }
  set path(v) { return this.parts.path = v }
  get pathParts() { return this.path && this.path.length > 1 ? this.path.substring(1).split('/') : [] }
  get dirname() { return this.path ? Path.dirname(this.path) : null }
  get basename() { return this.path ? Path.basename(this.path ) : null }
  get extname() { return this.path ? Path.extname(this.path) : null }
  get queryString() { return Uri.formatQuery(this.parts.query) }
  set queryString(v) { return this.parts.query = Uri.parseQuery(v) }
  get query() { return this.parts.query }
  set query(v) { return this.parts.query = Uri.parseQuery(Uri.formatQuery(v)) }
  get fragment() { return this.parts.fragment }
  set fragment(v) { return this.parts.fragment = v }
  get next() { return this.parts.next }
  set next(v) { return this.parts.next = Uri.coerce(v) }

  nextHost() {
    return this.hostIndex = (this.hostIndex + 1) % this.parts.hosts.length;
  }
  freezeHost() {
    var uri = new Uri(this.format())
    var hosts = uri.parts.hosts;
    uri.parts.hosts = [hosts[this.hostIndex % hosts.length]];
    return uri;
  }

  static coerce(value, opts) {
    return value instanceof Uri ? value : new Uri(value, opts)
  }

  static parse(text, opts) {
    // log('info', "parse %s opts %s", text, opts);
    if (!text)
      throw new Error("URI required");
    var match = text.match(uriRegexp);
    if (!match)
      throw new Error("Unsupported URI: " + text);
  // 1:scheme, 2:user, 3:pass, 4:hosts, 5:path, 6:opaque, 7:query, 8:fragment, 9:next
    var scheme = match[1], user = match[2], pass = match[3], hosts = match[4],
        path = match[5], opaque = match[6], query = match[7], fragment = match[8],
        next = match[9];
    /* For scheme only urls like 'json', which turns into opaque, prioritize scheme only */
    if (!scheme && !hosts && !path && opaque && opaque.match(/^[\w\+-]+$/))
      scheme = opaque, opaque = undefined;
    var parts = {
      scheme: scheme,
      opaque: opaque ? decodeURIComponent(opaque) : null,
      user:   user ? decodeURIComponent(user) : null,
      pass:   pass ? decodeURIComponent(pass) : null,
      hosts:  this.parseHosts(hosts, opts && opts.defaultPort || Uri.defaultPorts()[scheme]),
      path:   path ? Path.normalize(path) : null,
      query:  this.parseQuery(query),
      fragment: fragment ? decodeURIComponent(fragment) : null,
      next:   next ? new Uri(next, opts) : null,
    };
    return parts;
  }

  static parseHosts(text, defaultPort) {
    var hosts = [];
    if (!text)
      return hosts;
    text.split(',').forEach(function(part) {
      var index = part.indexOf(':');
      var name = ~index ? part.substring(0, index) : part,
          port = ~index ? parseInt(part.substring(index + 1)) : defaultPort;
      hosts.push({name:name, port:port});
    });
    // require('log')('info', "parsing hosts #gr[%s %s] hosts #gr[%s]", text, defaultPort, hosts);
    return hosts;
  }

  static formatHosts(hosts) {
    var parts = [];
    hosts.forEach(function(host) {
      var part = encodeURIComponent(host.name) + ':' + host.port;
      parts.push(part);
    });
    return parts.join(':');
  }

  static parseQuery(text) {
    var query = {};
    if (!text)
      return query;
    if (text.charAt(0) === '?')
      text = text.substring(1);
    text.split('&').forEach(function(part) {
      var index = part.indexOf('=');
      var key = decodeURIComponent(~index ? part.substring(0, index) : part),
          value = ~index ? part.substring(index + 1) : null;
      switch (value) {
        case 'true': case 'yes': value = true; break;
        case 'false': case 'no': value = false; break;
        case 'null': value = null; break;
        case 'undefined': value = undefined; break;
        default:
          if (parseFloat(value) == value)
            value = parseFloat(value);
          else
            value = decodeURIComponent(value); break;
      }
      query[key] = value;
    });
    return query;
  }

  static formatQuery(query) {
    var parts = [];
    for (var key in query) {
      var value = query[key];
      var part = encodeURIComponent(key) + '=' + encodeURIComponent(value);
      parts.push(part);
    }
    return parts.join('&');
  }

  static defaultPorts() {
    return {
      http:80, https:443,
      ssh:22,
      smtp:25, smtps:465,
      pop3:110, pop3s:995,
      imap:143, imap4: 143, imaps:993, imap4s:993,
      mysql:3306, stomp:61613, mongo:27017, mongodb:27017,
    }
  }

}

module.exports = Uri;

const uriRegexp = /^(?:([\w\+-]+):)?(?:(?:(?:\/\/(?:([^\|\/:@\?\#]+)?(?::([^\|\/:@\?\#]+))?@)?([^\|\/\?\#]+)?)?(\/[^\|\?#]*)?|([^\|\?\#]+))(?:\?([^\|#]*)?)?(?:#([^\|]*)?)?)?(?:\|(.*))?$/;
const hostRegexp = /^(([^\|\/:@]+)(?::(\d+))?)$/;
