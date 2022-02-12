
/**
 * 
 * @since  1.0
 * @author Lo Shih <kloshih@gmail.com>
 * @copyright Copyright 2021 Lo Shih 
 */
class Events {

  constructor() {
    this._events = {};
  }

  eventNames() {
    return Object.keys(this._events);
  }

  listeners(event) {
    return this._events[event] || (this._events[event] = []);
  }

  listenerCount(event) {
    let list = this._events[event];
    return list ? list.length : 0;
  }

  on(event, handler, context=undefined) {
    let list = this._events[event] || (this._events[event] = []);
    list.push({ event, handler, context, once:false});
    if (this._startListeners && list.length == 1)
      this._startListeners(event);
    return this;
  }

  once(event, handler, context=undefined) {
    let list = this._events[event] || (this._events[event] = []);
    list.push({ event, handler, context, once:true});
    if (this._startListeners && list.length == 1)
      this._startListeners(event);
    return this;
  }

  off(event, handler, context=undefined) {
    if (handler == null && context === undefined)
      throw new Error(`Handler and/or context required`)
    let list = this._events[event] || (this._events[event] = []);
    if (!list) return;
    for (let i = 0, ic = list.length; i < ic; i++) {
      if ((handler == null || list[i].handler === handler) && 
          (context === undefined || context == list[i].context)) {
        list.splice(i, 1), i--, ic--;
      }
    }
    if (this._stopListeners && list.length == 0)
      this._stopListeners(event);
    return this;
  }

  addListener(event, handler, context=null) {
    return this.on(event, handler, context)
  }

  removeListener(event, handler) {
    return this.off(event, handler)
  }

  removeAllListeners(event) {
    delete(this._events[event]);
    return this;
  }

  reset() {
    const oldEvents = this._events;
    this._events = {};
    if (this._stopListeners)
      Object.keys(oldEvents).forEach(event => this._stopListeners(event));
    return this;
  }
  
  emit(name, arg) {
    const list = this._events[name];
    if (!list) 
      return;
    const argv = slice.call(arguments, 1);
    for (let i = 0, ic = list.length; i < ic; i++) {
      let listener = list[i];
      if (listener.once)
        splice(list, i, 1), i--, ic--;
      listener.handler.apply(listener.context, argv);
    }
    return this;
  }

  emitAsync(name, arg) {
    let promises = [];
    const list = this._events[name];
    if (!list) 
      return;
    const argv = slice.call(arguments);
    for (let i = 0, ic = list.length; i < ic; i++) {
      let listener = list[i];
      if (listener.once)
        splice(list, i, 1), i--, ic--;
      try {
        let res = listener.handler.apply(listener.context, argv);
        if (res && typeof(res.then) == 'function') {
          promises.push(res)
        }
      } catch (err) {
        promises.push(Promise.reject(err));
      }
    }
    return Promise.allSettled(promises);
  }
  
}
module.exports = Events;

const slice = Array.prototype.slice;