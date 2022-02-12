const { Events } = require("./active");

module.exports = {
  isSubclass,
  superclass,
  typeOf,
  merge,
  clone,
  split,
  perform,
  wait,
  barrier,
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

superclass.stack = (impl) => {
  const stack = [];
  for (let cur = impl; cur && cur !== Object; cur = superclass(cur)) {
    stack.unshift(cur);
  }
  return stack;
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


function split(object, key) {
  const objType = typeOf(object), keyType = typeOf(key);
  let cur, next;
  switch (objType) {
    case 'array':
      switch (keyType) {
        case 'number': return [object.slice(0, key), object.slice(key)];
        default: throw new Error('STUBBED')
      }
      break;
    case 'object':
      switch (keyType) {
        case 'array':   
          cur = {}, next = {};
          for (const k in object) {
            if (~key.indexOf(k))
              cur[k] = object[k];
            else
              next[k] = object[k];
          }
          return [cur, next];
        default: throw new Error('STUBBED');
      }
    default:
      return [object, null];
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

/**
 * Returns a Promise augmented with an event listener for streaming results. 
 * @param {*} opts 
 * @param {*} func 
 */
function performEvent(opts, func) {
  if (arguments.length == 1)
    func = opts, opts = {};
  let started = 0, done = 0, resolve, reject;
  const promise = new Promise((res, rej) => resolve = res, reject = rej);
  const events = new Events();
  events.then = (res, rej) => started++ || start(), promise.then(res, rej);
  events.catch = (rej) => started++ || start(), promise.catch(rej);
  events.finally = (fin) => started++ || start(), promise.finally(fin);
  events.callback = (err, res) => {
    if (done++)
      return;
    if (events.timer)
      clearTimeout(events.timer), events.timer = null;
    err ? reject(err) : resolve(res);
  };
  const start = () => {
    try {
      events.emit('_start', events);
      events.emit('_done', events);
      if (opts && opts.timeout)
        events.timer = setTimeout(() => reject('timeout'), opts.timeout);
      let res = func(events.callback);
      if (res && typeof(res.then) == 'function')
        done++, res.then(resolve, reject)
      else if (res !== undefined)
        done++, resolve(res)
    } catch (error) {
      reject(error);
    }    
  };
}

function barrier() {
  const queue = [];
  let read = -1, write = -1;
  const promise = () => {
    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res, reject = rej });
    p.resolve = resolve, p.reject = reject;
    return p;
  }
  return {
    resolve(res) {
// console.log('barrier.resolve()');
      write++;
      if (queue[write]) queue[write].resolve(res);
      else queue[write] = Promise.resolve(res);
    },
    reject(err) {
// console.log('barrier.reject()');
      write++;
      if (queue[write]) queue[write].reject(err);
      else queue[write] = Promise.reject(err);
    },
    then(res, rej) {
// console.log('barrier.then()');
      read++;
      if (queue[read]) return queue[read].then(res, rej);
      else return (queue[read] = promise()).then(res, rej);
    },
    catch(rej) {
// console.log('barrier.catch()');
      throw new Error('STUBBED');
      read++;
      if (queue[read]) return queue[read].catch(rej);
      else return (queue[read] = promise()).catch(rej);
    },
    finally(fin) {
// console.log('barrier.finally()');
      throw new Error('STUBBED');
      read++;
      if (queue[read]) return queue[read].finally(rej);
      else return (queue[read] = promise()).finally(rej);
    },
  }
}



// rrup;

// /* Working with requests */
// await performEvent(cb => {
//   const req = rrup.send('message');
//   req.on('message-partial', (rsp) => {
//     cb.emit('results', rsp.result);
//   })
//   req.on('complete', (rsp) => {
//     cb.emit('')
//   })
// })

// /* Working with streams */
// let res = await performEvent({timeout:10e3}, async (evts) => {
//   const lines = []
//   const fh = fs.open(file);
//   for (let line; line = fs.readLine(fh); ) {
//     lines.push(line);
//     evts.emit('line', line);
//   }
//   fs.close(fh);
//   evts.resolve(lines.join(''))
// }).
//   on('line', (line) => { this.emit(line) })


// class EventPerformer extends Events {

//   constructor(opts, func) {
//     this.done = 0;
//     this.promise = new Promise((res, rej) => {
//       this.resolve = res;
//       this.reject = rej;
//     })
//   }

//   start() {
    
//   }

//   done(err, res) {
//     if (this.done++)
//       return;
//     err ? this.reject(err) : this.resolve(res);
//   }

//   then(resolve, reject) {
//     this.start();
//     return this.promise.then(resolve, reject);
//   }

//   catch(reject) {
//     this.start();
//     return this.promise.catch(reject);
//   }

//   finally(finalize) {
//     this.start();
//     return this.promise.finally(finalize);
//   }

// }

// await performEvent({timeout:10e3}, cb => {
//   const events = new Events();
//   const promise = new Promise((res, rej) => {
//   })
// }).
//   on('start', (performer) => {}).
//   on('timeout', () => {})
//   on('data', (data) => {}).
//   on('done', () => {});