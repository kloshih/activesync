const { typeOf } = require("./util");

/**
 * The Url class provides a no-dependency representation of a URL, for parsing 
 * and formatting. 
 * @since  1.0
 * @author Lo Shih <kloshih@gmail.com>
 * @copyright Copyright 2021 Lo Shih 
 */
class Url {

  static coerce(url, opts) {
    return url instanceof Url ? url : new Url(url, opts)
  }

  constructor(text, opts) {
    if (!text)
      throw new Error('URL required');
    // let match = text.match(/^(?:([\w\+-]+):)?(?:(?:(?:\/\/(?:([^\|\/:@\?\#]+)?(?::([^\|\/:@\?\#]+))?@)?([^\|\/\?\#]+)?)?(\/[^\|\?#]*)?|([^\|\?\#]+))(?:\?([^\|#]*)?)?(?:#([^\|]*)?)?)?(?:\|(.*))?$/);
    let match = text.match(/^(?:(?<scheme>[\w\+-]+):)?(?:(?:(?:\/\/(?<auths>[^\|\/\?\#]+)?)?(?<path>\/[^\|\?#]*)?|(?<opaque>[^\|\?\#]+))(?:\?(?<query>[^\|#]*)?)?(?:#(?<fragment>[^\|]*)?)?)?(?:\|(?<next>.*))?$/);
    if (!match)
      throw new Error(`URL malformed: ${text}`)
    let [, scheme, auths, path, opaque, query, fragment, next] = match;

    if (!scheme && !auths && !path && opaque && opaque.match(/^[\w+-]$/))
      scheme = opaque, opaque = null;

    this.scheme = scheme;
    this.opaque = opaque && decodeURIComponent(opaque);
    // this.user = user && decodeURIComponent(user);
    // this.pass = pass && decodeURIComponent(pass);
    // this.hosts = !hosts ? [] : hosts.split(',').map(host => {
    //   let [name, port] = host.split(':');
    //   return { name, port:parseInt(port) || port}
    // });
    this.hosts = !auths ? [] : auths.split(',').map(auth => {
      let m = auth.match(/(([^\|\/:@\?\#]+)?(?::([^\|\/:@\?\#]+))?@)?(?:([^\|\/\?\#:]+)?(?::([^\|\/\?\#:]+))?)?/);
      if (!m) throw new Error(`IMPL: auth malformed, ${JSON.stringify(auth)}`)
      let user = m[2] && decodeURIComponent(m[2]) || null;
      let pass = m[3] && decodeURIComponent(m[3]) || null;
      let name = m[4] && decodeURIComponent(m[4]) || null;
      let port = m[5] && decodeURIComponent(m[5]) || null;
      if (!isNaN(parseInt(port))) port = parseInt(port);
      return { user, pass, name, port };
    })
    this.nextHost(0);
    // this.host = this.hosts[this.hostIndex];
    this.path = path && normalizePath(path);
    this.pathParts = this.path && this.path.split('/').filter((part, i) => i > 0 || part) || [];
    this.query = query && parseQuery(query) || {};
    this.fragment = fragment && decodeURIComponent(fragment);
    this.next = next && new Url(next, opts);
  }

  toString() {
    return this.format()
  }

  nextHost(index) {
    this.hostIndex = (index != null ? index : this.hostIndex + 1) % this.hosts.length;
    this.host = this.hosts[this.hostIndex];
    this.user = this.host && this.host.user;
    this.pass = this.host && this.host.pass;
    this.hostname = this.host && this.host.name;
    this.port = this.host && this.host.port;
    return this.host;
  }

  format(opts) {
    opts || (opts = {})
    let { scheme, opaque, authority, user, pass, auth, hosts, hostname, port, host, path, query, fragment, next } = Object.assign({}, this, opts);
    if (typeof(host) == 'string') {
      hostname = host, host = null;
    }
    const text = [];
    if (scheme)
      text.push(scheme, ':');
    if (opaque) {
      text.push(opaque)
    } else {
      if (authority !== undefined) {
        if (authority) text.push(authority);
      } else if (auth || user || pass || host || hosts && hosts.length > 0) {
        text.push('//')
        if (auth) {
          text.push(auth);
        } else {
          if (!hosts || hosts.length == 0) {
            if (host)
              hosts = [host];
            else if (user || pass || hostname)
              hosts = [{}];
          }
          let defPort = defaultPorts[scheme];
          hosts && hosts.forEach((host, index) => {
            if (index > 0) text.push(',');
            let user = host.user || opts.user || null;
            let pass = host.pass || opts.pass || null;
            let name = host.name || opts.hostname || null;
            let port = host.port || opts.port || null;
            if (user || pass) {
              if (user) text.push(encodeURIComponent(user))
              if (pass) text.push(':', encodeURIComponent(pass))
              text.push('@')
            }
            if (name) {
              text.push(encodeURIComponent(name))
              port || (port = defPort);
              if (port && (port != defPort || opts.includePort))
                text.push(':', encodeURIComponent(port));
            }
            // if (host.name) text.push(encodeURIComponent(host.name))
            // if (host.port && (host.port != defPort || opts && opts.includePort))
            //   text.push(':', host.port)
          })
        }
      }
      if (opts && opts.pathParts) {
        text.push('/' + opts.pathParts.join('/'));
      } else if (path) {
        text.push(path);
      }
    }
    if (query && Object.keys(query).length > 0) text.push('?', formatQuery(query))
    if (fragment) text.push('#', encodeURIComponent(fragment))
    if (next) text.push('|', typeof(next) == 'string' ? next : next.format())
    else if (next == null && this.next) text.push('|', this.next.format())
    return text.join('');
  }
  
}
module.exports = Url;

Object.assign(Url, {
  Url,
  normalizePath,
  parseQuery,
  formatQuery,
})

const defaultPorts = {
  ftp:20, telnet:23, whois:43, dns:53, 
  http:80, https:443,
  ssh:22,
  smtp:25, smtps:465,
  pop3:110, pop3s:995,
  imap:143, imap3:220, imap4:143, imaps:993, imap4s:993,
  afp:548, 
  mysql:3306, stomp:61613, mongo:27017, mongodb:27017,
}

function normalizePath(path) {
  if (!path) return path;
  path = path.replace(/(^|\/)\.(\/|$)/g, '$1$2');
  path = path.replace(/(^|\/)[^\/]+\/\.\.(\/|$)/g, '/')
  path = path.replace(/\/{2,}/g, '/');
  return path;
}

function parseQuery(query) {
  let res = {}
  if (!query) return res;
  query.split('&').forEach(part => {
    let [, keypath, val] = part.match(/^(.*?)(?:=(.*))?$/);
    keypath = decodeURIComponent(keypath), val = normalizeValue(decodeURIComponent(val));
    let cur = res, key;
    keypath.split('.').forEach(keypart => {
      let [, k, i] = keypart.match(/^(.*?)(?:\[(\d*)\])?$/);
      if (i == null) { // object
        
        // Object, if key then create an object
        if (key != null)
          cur = cur[key] == null ? cur[key] = {} : cur[key]
        // cur = !isObject(cur[key]) ? cur[key] = {} : cur[key];
        key = k;
      } else { // array
        if (key && cur[key] == null)
          cur = cur[key] = {};
        cur = !isArray(cur[k]) ? cur[k] = [] : cur[k];
        if (i.length == 0)
          i = cur.length;
        key = i;
      }
    })
    cur[key] = val;
  });
  return res;
}
const isArray = Array.isArray;
const isObject = (o) => o != null && Object.getPrototypeOf(o) == Object;

function formatQuery(query) {
  const encode = encodeURIComponent;
  const list = [];
  format(list, query, []);
  return list.join('&');

  function format(list, doc, kp) {
    switch (typeOf(doc)) {
      case 'object':
        for (let key in doc) {
          const item = doc[key];
          kp.push(key);
          format(list, item, kp)
          kp.pop();
        }
        return;
      case 'array':
        for (let i = 0, ic = doc.length; i < ic; i++) {
          const item = doc[i];
          kp.push('$[]$');
          format(list, item, kp);
          kp.pop();
        }
        return;
      case 'date':
        doc = doc.toISOString(); // fall through
      default:
        list.push(kp.join('.').replace(/\.\$\[\]\$/g, '[]') + '=' + encode(String(doc)));
        return;
    }
  }
}

function normalizeValue(value) {
  if (value.match(/^[+-]?[\d\.]+(e[+-]?[\d\.]+)?$/))
    return parseFloat(value);
  if (value.match(/^(true|yes)$/i))
    return true;
  if (value.match(/^(false|no)$/i))
    return false;
  if (value.match(/^(null)$/))
    return null;
  return value;
}

// list[]=tag1&list[]=tag2 - list[]=tag
// res = {}
// cur = res, key;
// part = 'list[]=tag', keypart = 'list[]';
// k = 'list', i = '';
// cur[k] = [];
// i = 0, key = i;
