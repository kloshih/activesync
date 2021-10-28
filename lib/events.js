/**
 * 
 * @since  1.0
 * @author Lo Shih <kloshih@gmail.com>
 * @copyright Copyright 2021 Lo Shih 
 */
class EventEmitter {

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

  on(event, handler, context=null) {
    let list = this._events[event] || (this._events[event] = []);
    list.push({ event, handler, context, once:false});
  }

  once(event, handler, context=null) {
    let list = this._events[event] || (this._events[event] = []);
    list.push({ event, handler, context, once:true});
  }

  off(event, handler) {
    let list = this._events[event] || (this._events[event] = []);
    if (!list) return;
    for (let i = 0, ic = list.length; i < ic; i++) {
      if (list[i].handler === handler)
        list.slice(i, 1), i--, ic--;
    }
  }

  addListener(event, handler, context=null) {
    this.on(event, handler, context)
  }

  removeListener(event, handler) {
    this.off(event, handler)
  }

  removeAllListeners(event) {
    delete(this._events[event]);
  }

  reset() {
    this._events = {};
  }
  
  emit(name, arg) {
    const list = this._events[name];
    if (!list) 
      return;
    const argv = slice.call(arguments);
    for (let i = 0, ic = list.length; i < ic; i++) {
      let listener = list[i];
      if (listener.once)
        splice(list, i, 1), i--, ic--;
      listener.apply(listener.context, argv);
    }
  }
  
}
module.exports = EventEmitter;

const slice = Array.prototype.slice;