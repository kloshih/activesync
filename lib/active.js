'use strict';

const EventEmitter = require('eventemitter3');
const Uri = require('./uri.js');

const kAllProps = Symbol('allProps');

/**
 *  - EventEmitter
 *  - Actives
 *    - Lifecycle management
 *      - Callback hooks and async
 *    - Sub/super actives
 *  - Configuration
 *    - Properties
 *    - Structured properties
 *  - Providers
 *    - Shared providers
 *
 */
class Active extends EventEmitter {

  /**
   * Creates an active
   * @param {object} config The object configuration
   * @param {object} owner Owner of the active
   */
  constructor(config, owner) {
    super();
    this.config = this.constructor.coerceConfig(config);
    this.owner = owner;
    this._meta = {
      iid: this.constructor._nextIid(),
      boundMethods: {},
      status: 'detached',
      subactives: [],
      superactives: [],
    };
    this.log = this.constructor.log;
    // this.log.debug("#bbl[%s] #wh[config #byl[%s]]", this, log.dump(this.config));
    // console.log("Creating " + this.toString());
  }

  toString() {
    const meta = this._meta;
    if (!meta)
      return super.toString();
    return this.constructor.name + ':' + meta.iid + '(' + statusCodes[meta.status] + ')';
  }

  get class() {
    return this.constructor;
  }

  /*+-------------------------------------------------------------------------*
   |                             ACTIVE STRUCTURE                             |
   *--------------------------------------------------------------------------*/

  _configure() {
    const config = this.config;
    // this.log.debug("#bbl[active] #wh[config #byl[%s] for active #df[%s]]", log.dump(config), this);
    const props = this.constructor.allProps;
    for (let key in props) {
      let prop = props[key],
          req = prop.req,
          def = prop.default || prop.def,
          type = coerceType(prop.type),
          subconfig = config[key];

      this.log.debug("#bbl[%s] #wh[key #gr[%s] prop #byl[%s] req #bgr[%s] type #bgr[%s] (isActive? #df[%s]) subconfig #byl[%s]]", this, key, prop, req, type, isSubclass(type, Active), subconfig);

      /* If the type isn't a class and an Active subclass, then simply set the
       * key and be done with it. */
      if (subconfig == null || !isSubclass(type, Active)) {
        var defType = _typeof(def), subType = _typeof(subconfig);

        /* If we're dealing with an object config, then merge the value in with
         * the default values. */
        if (defType === 'object' && subType === 'object') {
          subconfig = config[key] = kv.merge({}, def, subconfig);
        }
        this.log.debug("def #byl[%s] #bmg[%s] sub #byl[%s] #bmg[%s]", def, defType, subconfig, subType);

        this[key] = subconfig || null;
        continue;
      }

      /* If the subconfig for this key is not an object, then wrap it in an
       * object with the implicitConfigKey. */
      // subconfig = coerceConfig(type, subconfig, key);
      subconfig = type.coerceConfig(subconfig);
      // subconfig.$key = key;
      // this.log.debug("#bbl[%s] #wh[req #df[%s] type #df[%s] subconfig #byl[%s]]", this, req, type, subconfig);
      switch (req) {
        case '?': case '1': case undefined:
          subconfig = type.coerceConfig(subconfig);
          subconfig.$key = key;
          this[key] = coerceProperty(type, subconfig)
          break;
        case '*': case '+':
          this[key] = {};
          this.log.debug("#bbl[%s] #wh[key #gr[%s] processing req #gr[%s] subconfig #byl[%s]]", this, key, req, subconfig);
          for (var subkey in subconfig) {
            if (subkey.indexOf('$') === 0) continue;
            // var subconf = coerceConfig(type, subconfig[subkey], subkey);
            var subconf = type.coerceConfig(subconfig[subkey]);
            subconf.$key = subkey;
            this.log.debug("subkey #byl[%s] conf #byl[%s]", subkey, subconf);
            this[subkey] = this[key][subkey] = coerceProperty(type, subconf)
          }
          break;
      }
    }

    function coerceType(type) {
      return _typeof(type) === 'function' ? type() : type
    }

    // function coerceConfig(type, config, key) {
    //   if (_typeof(config) !== 'object')
    //     config = {name:config}
    //   config.$key = key
    //   return config;
    // }

    function coerceProperty(type, config) {
      this.log.debug("coerceProperty() type=#gr[%s], config=#gr[%s]", type, config);
      var value;
      if (isSubclass(type, Active)) {
        value = type.provider(config, self)
        self.addSubactive(value)
      } else {
        this.log.debug("coerceProperty() type=#gr[%s], config=#gr[%s]", type, config);
        value = config != null ? config : null
      }
      return value;
    }
  }

  addSubactive(active) {
    if (!(active instanceof Active))
      throw new Error("Active required");
    var meta = this._meta;
    var actives = meta.subactives;
    if (actives.indexOf(active) < 0) {
      actives.push(active);
      active.addSuperactive(this);
      switch (active.status) {
        case 'attaching': case 'attached':  return active.attach();
        case 'starting':  case 'started':   return active.start();
        case 'stopping':  case 'stopped':   return null;
        case 'detaching': case 'detached':  return null;
      }
    }
    return null;
  }

  removeSubactive(active) {
    if (!(active instanceof Active))
      throw new Error("Active required");
    const meta = this._meta;
    const actives = meta.subactives;
    let index;
    if ((index = actives.indexOf(active)) >= 0) {
      actives.splice(index, 1);
      active.removeSuperactivity(this);
    }
    return null;
  }

  addSuperactive(active) {
    if (!(active instanceof Active))
      throw new Error("Active required");
    const meta = this._meta;
    const actives = meta.superactives;
    if (actives.indexOf(active) < 0) {
      actives.push(active);
      active.addSubactive(this);
      /* Attach or start if necessary */
      let counts = this.constructor.statusCounts(actives);
      if (counts.start > 0)
        return this.start();
      else if (counts.attach > 0)
        return this.attach();
      switch (active.status) {
        case 'attaching': case 'attached':  return this.attach();
        case 'starting':  case 'started':   return this.start();
        case 'stopping':  case 'stopped':   return null;
        case 'detaching': case 'detached':  return null;
      }
    }
    return null;
  }

  removeSuperactive(active) {
    if (!(active instanceof Active))
      throw new Error("Active required");
    const meta = this._meta;
    const actives = meta.superactives;
    let index;
    if ((index = actives.indexOf(active)) >= 0) {
      actives.splice(index, 1);
      active.removeSubactive(this);
      /* Detach if necessary */
      let counts = this.constructor.statusCounts(actives);
      if (counts.attach == 0)
        return this.detach();
    }
    return null;
  }

  dump() {
    const depth = arguments[0] || 1;
    const text = [];
    // text.push(this.toString(), " #bbk[" + log.dump(this.config, {maxlen:200}) + "]");
    const subs = this._meta.subactives;
    for (let i = 0, ic = subs.length; i < ic; i++) {
      const sub = subs[i];
      text.push('\n', ' '.repeat(depth*2));
      text.push(sub.dump(depth + 1));
    }
    return text.join('');
  }

  /*+-------------------------------------------------------------------------*
   |                             IMPLEMENTATIONS                              |
   *--------------------------------------------------------------------------*/

  static set log(val) {
    log = val;
  }
  
  /** Describes the
   *
   *  @return A object describing the properties.
   */
  static get props() {
    return {
      name: null,
    }
  }

  static get allProps() {
//    if (!this[kAllProps]) {
      let props = {}
      for (let type = this; type && type !== Object; type = superclass(type)) {
        this.log.debug("type props #gr[%s] #byl[%s]", type, type.props);
        props = _merge({}, type.props, props)
      }
      this.log.debug("#bbl[%s] #wh[calculated allProps #byl[%s]]", this, props);
//      this[kAllProps] = props
//    }
    this.log.debug("#bbl[%s] #wh[allProps #byl[%s]]", this, this[kAllProps]);
//    return this[kAllProps]
    return props;
  }

  /** Coerces
   *
   *  @param  config The configuration
   */
  static coerceConfig(config) {
    let coerced = {}, implicit;
    if (_typeof(config) !== 'object')
      implicit = config, config = {}
    const props = this.allProps;
    // this.log.debug("#bbl[%s] #wh[props #byl[%s] implicit #byl[%s]]", this, log.dump(this.allProps), implicit);
    for (let key in props) {
      let prop = props[key];
      coerced[key] = prop.implicit && implicit || config[key] || (key === 'name' && config.$key) || prop.default || null;

      this.log.debug("#bbl[%s] #wh[prop #gr[%s] #byl[%s] implicit #gr[%s] value #gr[%s]]", this, key, prop, prop.implicit ? 'yes' : 'no', coerced[key]);

      /* Special case certain typical config parameters */
      switch (key) {
        case 'uri': case 'url':
          let uri = coerced[key] = Uri.coerce(coerced[key]);
          kv.merge(coerced, uri.query);
          if (!coerced.name)
            coerced.name = uri.scheme;
          break;
      }

    }
    this.log.debug("#bbl[%s] #wh[coerced #byl[%s]]", this, coerced);
    return coerced;
    // config = _typeof(config) === 'object' ? config : {[this.implicitConfigKey()]:config}
  }

  /** An array of implementation classes of this class. Each implementation is
   *  queried whether it is willing to provide service based on specific
   *  configuration.
   *
   *  @type   Array of classes
   *  @since  1.0
   */
  static get providerImpls() {
    return this._providerImpls || (this._providerImpls = [])
  }

  /**
   *
   *  @param  impl An implementation subclass of
   */
  static use(impl) {
    this.log.debug("impl is a #bgr[%s] #gr[%s]", _typeof(impl), impl);
    switch (_typeof(impl)) {
      case 'object':
        for (let key in impl) {
          this.use(impl[key]);
        }
        return;
      case 'array':
        for (let item of impl) {
          this.use(item);
        }
        return;
      case 'function':
      case 'class':
        break;
      default:
        throw new Error("Unsupported impl: " + _typeof(impl));
    }

    if (!isSubclass(impl, this))
      throw new Error("Implementation " + impl + " must be a subclass of " + this);
    if (this.providerImpls.indexOf(impl) < 0)
      this.providerImpls.push(impl);
  }

  static unuse(impl) {
    const index = this.providerImpls.indexOf(impl);
    ~index && this.providerImpls.splice(index, 1);
  }

  /** Creates or otherwise resolves a provider, an instance of this class or one
   *  of its subclasses.
   *
   *  @param  config The configuration ({object}, required)
   *  @param  owner The owner of the provider ({Activity}, optional)
   *  @return A provider of this class ({Activity}, non-null)
   *  @since  1.0
   */
  static provider(config, owner) {
    config = this.coerceConfig(config);
    const providerImpls = this.providerImpls;
    this.log.debug("#bbl[%s] #wh[provider for config #byl[%s] providerImpls #byl[%s]]", this, config, providerImpls);
    const pick = { impl:this, priority:0 };
    for (let i = 0, ic = providerImpls.length; i < ic; i++) {
      const impl = providerImpls[i];
      const info = impl.provides(config, this);
      if (info && info.priority > pick.priority)
        pick = info, pick.impl || (pick.impl = impl);
    }
    if (pick.opts)
      kv.merge(config, pick.opts);

    /* Create the provider. If the implementation uses a share key, attempt to
     * find an existing provider with that name. If it exists, then use it.
     * Shared providers don't have an owner. */
    let provider;
    let supportsShare = !('shared' in config) || config.shared;
    let shareKey = supportsShare && pick.impl.sharedProviderKey(config, owner);
    if (shareKey) {
      provider = pick.impl.sharedProviders.get(shareKey);
      log.info("#bbl[%s] #wh[impl #df[%s] uses a share key #gr[%s] found provider #bgr[%s]]", this, pick.impl, shareKey, provider || '<none>');
      if (!provider) {
        provider = new pick.impl(config, null);
        pick.impl.sharedProviders.set(shareKey, provider)
        // console.log("log.dump ====> ", Object.keys(log));
        // log.info("#bbl[%s] #wh[created provider #bgr[%s] set as share key #gr[%s] this is what was set #gr[%s] map #byl[%s]]", this, `provider`, shareKey, pick.impl.sharedProviders.get(shareKey), log.dump(pick.impl.sharedProviders));
      }
      provider.shared = true;
    } else {
      provider = new pick.impl(config, owner)
      let ownerKey = pick.impl.ownerKey || defaultOwnerKey(pick.impl, config, owner);
      if (ownerKey)
        provider[ownerKey] = owner;
    }
    return provider;
  }

  /** Returns the priority for this implementation class for the given *config*.
   *  The *baseType* is the class for which this provide
   *
   *  @param  config The configuration ({object}, required)
   *  @param  baseType The base activity class ({class}, optional)
   *  @return A priority number, higher the more preferential, non-positive if this
   *          implementation class does not support this configuration ({number},
   *          non-null)
   *  @since  1.0
   */
  static provides(config, baseType) {
    let typeName = this.name,
        baseName = baseType.name;
    let name = typeName.replace(baseType, '').toLowerCase();
    log.info("#bbl[%s] #wh[provider priority for typeName #df[%s] baseName #df[%s] name #df[%s] baseType #gr[%s] config #byl[%s]]", this, typeName, baseName, name, baseType, config);
    if (config.$key === name || config.type === name)
      return { impl:this, priority:1 };
    return null;
  }

  /*+-------------------------------------------------------------------------*
   |                            Sharing Providers                             |
   *--------------------------------------------------------------------------*/

  /** A map of shared providers by their share key
   *
   *  @type   Map
   *  @since  1.0
   */
  static get sharedProviders() {
    return this.__sharedProviders || (this.__sharedProviders = new Map())
  }

  /** Returns the key used for sharing for this implementation class. Provider
   *  implementations who wish to be shared have the ability.
   *
   *  @return A share key or `null` of no sharing, default ({string})
   *  @since  1.0
   */
  static sharedProviderKey(config) {
    return null
  }

  /** The key to set for the owner of an active, in addition to the key `owner`.
   *  If no key is provided, a key is generated by the owner's class.
   *
   *  @type   string
   *  @since  1.0
   */
  static get ownerKey() {
    return null
  }


  /*+-------------------------------------------------------------------------*
   |                                LIFECYCLE                                 |
   *--------------------------------------------------------------------------*/

  get status() {
    return this._meta.status;
  }

  async attach() {
    const meta = this._meta;
    this.log.debug("#bbl[%s] #wh[attach from #gr[%s]]", this, meta.status);
    switch (meta.status) {
      case 'attaching':
      case 'attached':
      case 'starting':
      case 'started':
      case 'stopping':
      case 'stopped':
        return;
      case 'detaching':
      case 'detached':
        let last = meta.status;
        try {
          this.emit('status', meta.status = 'attaching');
          await this._attach();
          this.emit('status', meta.status = 'attached');
          this.emit('attach');
        } catch (error) {
          this.emit('status', meta.status = last);
          this.emit('error', error, 'attach');
        }
        break;
    }
  }

  async _attach() {
    const subactives = this._meta.subactives;
    this._configure();
    for (let i = 0, ic = subactives.length; i < ic; i++) {
      await subactives[i].detach();
    }
  }

  async detach() {
    const meta = this._meta;
    switch (meta.status) {
      case 'attaching':
      case 'attached':
      case 'starting':
      case 'started':
      case 'stopping':
      case 'stopped':
        let last = meta.status;
        try {
          await this.stop();
          this.emit('status', meta.status = 'detaching');
          await this._detach();
          this.emit('status', meta.status = 'detached');
          this.emit('detach');
        } catch (error) {
          this.emit('status', meta.status = last);
          this.emit('error', error, 'detach');
        }
        break;
      case 'detaching':
      case 'detached':
        return;
    }
  }

  async _detach() {
    const subactives = this._meta.subactives;
    for (let i = 0, ic = subactives.length; i < ic; i++) {
      await subactives[i].detach();
    }
  }

  async start() {
    const meta = this._meta;
    switch (meta.status) {
      case 'starting':
      case 'started':
        return;
      case 'attaching':
      case 'attached':
      case 'stopping':
      case 'stopped':
      case 'detaching':
      case 'detached':
        let last = meta.status;
        try {
          await this.attach();
          this.emit('status', meta.status = 'starting');
          await this._start();
          this.emit('status', meta.status = 'started');
          this.emit('start');
        } catch (error) {
          if (meta.status == 'starting')
            this.emit('status', meta.status = last);
          this.emit('error', 'start');
        }
        break;
    }
  }

  /** Observes that the active is being started
   *
   *  @return A completion result ({promise} or non-{undefined})
   *  @see    -start()
   *  @since  1.0
   *  @MARK:  -_start()
   */
  async _start() {
    const subactives = this._meta.subactives;
    for (let i = 0, ic = subactives.length; i < ic; i++) {
      await subactives[i].start();
    }
  }

  /** Attaches an active
   *
   *  @return A completion result ({promise} or non-{undefined})
   *  @see    -_start()
   *  @since  1.0
   *  @MARK:  -stop()
   */
  async stop() {
    const meta = this._meta;
    switch (meta.status) {
      case 'attaching':
      case 'attached':
        return;
      case 'starting':
      case 'started':
        const last = meta.status;
        try {
          this.emit('status', meta.status = 'stopping');
          await this._stop();
          this.emit('status', meta.status = 'attached');
          this.emit('start');
        } catch (error) {
          if (meta.status == 'stopping')
            this.emit('status', meta.status = last);
          this.emit('error', 'stop');
        }
        break;
      case 'stopping':
      case 'stopped':
      case 'detaching':
      case 'detached':
        return;
    }
  }

  /** Observes that the active is being stopped
   *
   *  @return A completion result ({promise} or non-{undefined})
   *  @see    -stop()
   *  @since  1.0
   *  @MARK:  -_stop()
   */
  async _stop() {
    const subactives = this._meta.subactives;
    for (let i = 0, ic = subactives.length; i < ic; i++) {
      await subactives[i].stop();
    }
  }

  async reattach() {
    await this.detach();
    await this.attach();
  }

  async restart() {
    await this.stop();
    await this.start();
  }

  boundMethod(name) {
    const meta = this._meta;
    let method = meta.boundMethods[name];
    if (!method) {
      if (typeof(this[name]) !== 'function')
        throw new Error(this.constructor.name + " does not implement " + name + "()");
      method = meta.boundMethods[name] = function() {
        return self[name].apply(self, arguments);
      };
    }
    return method;
  }

  static _nextIid() {
    return this.__nextIid = (this.__nextIid || 0) + 1;
  }

  /**
   * Calculates the status counts for the array of actives
   * @param {array(Active)} actives The active instances
   * @return {total, attach, start, count, detach}
   */
  static statusCounts(actives) {
    const counts = { total:0, attach:0, start:0, stop:0, detach:0 };
    for (let i = 0, ic = actives.length; i < ic; i++) {
      const active = actives[i];
      counts.total++;
      switch (active.status) {
        case 'attaching': case 'attached': counts.attach++; break;
        case 'starting':  case 'started':  counts.start++;  counts.attach++; break;
        case 'stopping':  case 'stopped':  counts.stop++;   counts.attach++; break;
        case 'detaching': case 'detached': counts.detach++; break;
      }
    }
    return counts;
  }

}

Object.defineProperty(Active, 'toString', {
  value: function toString() { return this.name },
  configurable: true,
});

function isSubclass(subclass, superclass) {
  return typeof(subclass) === 'function' && subclass.prototype instanceof superclass
}

function superclass(subclass) {
  const superproto = Object.getPrototypeOf(subclass.prototype);
  return superproto && superproto.constructor ;
}


function defaultOwnerKey(impl, config, owner) {
  return owner ? owner.constructor.name.replace(/^[A-Z]/, function(char) { return char.toLowerCase }) : null;
}



//var statuses = {
//  attaching:  { mask:0x3, code:'a', trans:true,  attach:true,
//                next:{attach:['attached','detached']} },
//  attached:   { mask:0x2, code:'X', trans:false, attach:true,
//                next:{start:['starting'], detach:'detaching'} },
//  starting:   { mask:0x5, code:'a', trans:true,  attach:true, start:true,
//                next:['started', 'attached'] },
//  started:    { mask:0x4, code:'X', trans:false, attach:true, start:true,
//                next:['stopping'] },
//  stopping:   { mask:0x7, code:'a', trans:true,  attach:true, stop:true,
//                next:['attached', 'started'] },
//  stopped:    { mask:0x2, code:'X', trans:false, attach:true, stop:true,
//                next:['starting', 'detaching'] },
//  detaching:  { mask:0x1, code:'d', trans:true,  detach:true,
//                next:['detached', 'stopped'] },
//  detached:   { mask:0x0, code:'D', trans:false, detach:true,
//                next:['attaching'] },
//};
//for (var key in statuses)
//  statuses[statuses[key]] = key;

const statuses = {
  attaching:  0x3, // 0011   ,-->o
  attached:   0x2, // 0010   |   '+->o            ,- a -,   ,- s -,
  starting:   0x5, // 0101   |       |-->o       /   >   \ /   >   \ .
  started:    0x4, // 0100   |       |   '-->o  D ^     v A ^     v S
  stopping:   0x7, // 0111   |       |   o<--'   \   <   / \   <   /
  stopped:    0x2, // 0010   |       o<--'        '- d -'   '- x -'
  detaching:  0x1, // 0001   |   o<--'
  detached:   0x0, // 0000   o<--'
};
Object.defineProperty(Active, 'statuses', {value:statuses});

// const statusNames = new Map();
// for (let key in statuses) {
//   statusNames[statuses[key]] = key;
// }
// Object.defineProperty(Active, 'statuses', {value:statuses});



const statusNames = {};
for (let key in statuses)
  statusNames[statuses[key]] = key;
const statusCodes = {
  attaching:  'a',
  attached:   'X',
  starting:   's',
  started:    'S',
  stopping:   'x',
  stopped:    'X',
  detaching:  'd',
  detached:   'D',
};
Object.defineProperty(Active, 'statusNames', {value:statusNames});
Object.defineProperty(Active, 'statusCodes', {value:statusCodes});

module.exports = Active;
Active.EventEmitter = EventEmitter;
Active.Uri = Uri;


/*
 * 
 */
let defaultLog;
Object.defineProperty(Active, 'log', {get:function() {
  if (!defaultLog) {
    let env = (typeof(process) !== 'undefined' ? process.env : null) || (typeof(window) !== 'undefined' ? window.env : null)
    let options = {}
    if (env.ENV !== 'production') options.prettyPrint = true;
    defaultLog = require('pino')(options);
  }
  return defaultLog;
}, configurable:true, enumerable:false})

/**
 * 
 * @param {*} value 
 */
function _typeof(value) {
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
    if (funcToString.call(value).indexOf('class') === 0) return 'class';
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
function _merge(target, ...args) {
  target || (target = {});
  let depth = 0;
  for (let i = 0, ic = args.length; i < ic; i++) {
    if (_typeof(args[i]) === 'object')
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
        const av = a[k];
        const at = _typeof(av), bt = _typeof(bv);
        if (at === 'object' && at === 'object') {
          try {
            if (depth++ == 0)
              av = a[k] = _clone(av, true);
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