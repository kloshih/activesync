
module.exports = {
  isSubclass,
  superclass,
  typeOf,
  merge,
  clone,
  perform,
  wait,
}

function isSubclass(subclass, superclass) {
  return typeof(subclass) === 'function' && subclass.prototype instanceof superclass
}

function superclass(subclass) {
  const superclass = Object.getPrototypeOf(subclass);
  return superclass;
  const superproto = Object.getPrototypeOf(subclass.prototype);
  return superproto && superproto.constructor ;
}

/**
 * 
 * @param {*} value 
 */
function typeOf(value) {
  let type = typeof(value), name;
  if (type === 'object') {
    if (value == null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (value.getTime && value.setTime) return 'date';
    if (value.class !== undefined) return 'object';
    if (value.constructor && (name = value.constructor.name))
      return value.constructor.name.toLowerCase();
  } else if (type === 'function') {
    if (value.className !== undefined && value.methodName !== undefined) return 'class';
    if (funcToString.call(value).startsWith('class')) return 'class';
    if (value.compile && value.exec) return 'regexp';
  }
  return type;
}
const funcToString = Function.prototype.toString;

/**
 * 
 * @param {object} target The target of the merge
 * @param  {...any} args Additional arguments
 */
function merge(target, ...args) {
  target || (target = {});
  let depth = 0;
  for (let i = 0, ic = args.length; i < ic; i++) {
    if (typeOf(args[i]) === 'object')
      merge(target, args[i]);
  }
  return target;
  function merge(a, b) {
    for (let k in b) {
      if (!b.hasOwnProperty(k)) continue;
      let bv = b[k];
      if (bv == null) {
        delete(a[k]);
      } else {
        let av = a[k];
        const at = typeOf(av), bt = typeOf(bv);
        if (at === 'object' && bt === 'object') {
          try {
            if (depth++ == 0)
              av = a[k] = clone(av, true);
            merge(av, bv);
          } finally {
            depth--;
          }
        } else {
          a[k] = bv;
        }
      }
    }
  }
}

function clone(target, deep=false) {
  let res;
  switch (typeOf(target)) {
    case 'object':
      res = {}
      for (let key in target) {
        let item = target[key];
        res[key] = deep ? clone(item, true) : item;
      }
      return res;
    case 'array':
      res = []
      for (let i = 0, ic = target.length; i < ic; i++) {
        let item = target[i];
        res[i] = deep ? clone(item, true) : item;
      }
      return res;
    case 'map':
      res = new Map();
      for (let [key, item] of target.entries()) {
        res.set(key, deep ? clone(item, true) : item)
      }
      return res;
    default:
      return target;
  }
}


/**
 * Performs the *lambda(callback)* function, one that expects a callback for 
 * situations to adapt code which utilizes a callback and/or timeout mechanism. 
 * 
 * - Calls to APIs which use a `callback(err, result)` api
 * - Calls to APIs which completion uses an event listener, like 
 *   `service.on('error', callback); service.on('connect', callback.done);`
 * - Calls which uses a timeout in combination with other APIs. For example,
 *   use `perform({timeout:5000}, (cb) => ...)` will abort the call after 
 *   5 seconds of no activity
 * 
 * There are also a few additional features in handling the return result of
 * the *lambda* function:
 * 
 * - If a promise is returned before callback is called, (including when 
 *   defining the lambda function as async) that promise will override all 
 *   outcomes regardless of timeout, or future calls to callback
 * - If a non-undefined result is returned before callback is called, the
 *   result will be use to resolve the promise immediately
 * 
 * You may write your lambda function, calling the *callback* any number of 
 * times. Only the first call to *callback* will be handled. The **perform** 
 * function will return a promise, which you may use in combination with the
 * await keyword as in:
 * 
 * ```js
 * let res = await perform(cb => someCallbackCall('hello', cb) );
 * ```
 * 
 * @param {object} opts? The options to perform
 * @param {number} opts.timeout? Optional timeout in milliseconds before 
 * @param {function} lambda The lambda function to perform
 * @return A promise of the result
 */
function perform(opts, lambda) {
  if (typeof(opts) === 'function')
    lambda = opts, opts = {};
  return new Promise((resolve, reject) => {
    let done = 0, timer, next = (err, res) => {
      if (done++ > 0) return;
      err ? reject(err) : resolve(res);
    };
    next.done = next.bind(null, null);
    if (opts && typeof(opts.timeout) == 'number')
      timer = setTimeout(next, opts.timeout, new Error('timeout'))
    try {
      let res = lambda(next);
      if (res && typeof(res.then) == 'function')
        done++, res.then(resolve, reject)
      else if (res !== undefined)
        done++, resolve(res)
    } catch (error) {
      reject(error);
    }
  })
}

function wait(timeout) {
  if (typeof(timeout) !== 'number')
    throw new Error(`Timeout must be a number`);
  return new Promise((resolve, reject) => {
    setTimeout(resolve, timeout)
  })
}
