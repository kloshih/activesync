'use strict';

const EventEmitter = require('eventemitter3');
const Url = require('./url.js');
const { isSubclass, superclass, typeOf, merge } = require('./util')

// const kAllProps = Symbol('kAllProps');
const kAllEvents = Symbol('kAllEvents');
const kCoerced = Symbol('kCoerced');

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
  }

  get class() {
    return this.constructor;
  }

  toString() {
    const meta = this._meta;
    if (!meta)
      return super.toString();
    return this.constructor.name + ':' + meta.iid + '(' + statusCodes[meta.status] + ')';
  }
  
  get iidKey() {
    const meta = this._meta;
    return this.constructor.name.toLowerCase() + (!meta ? '' : ':' + meta.iid);
  }

  /*+-------------------------------------------------------------------------*
   |                             ACTIVE STRUCTURE                             |
   *--------------------------------------------------------------------------*/

  _configure() {
    const config = this.config, self = this;
    // this.log.debug("#bbl[active] #wh[config #byl[%s] for active #df[%s]]", log.dump(config), this);
    const props = this.constructor.allProps;
    for (let key in props) {
      let prop = props[key],
          req = prop.req,
          def = prop.default || prop.def,
          type = coerceType(prop.type),
          copy = 'copy' in prop ? prop.copy : true,
          subconfig = config[key];

      // this.log.debug("#bbl[%s] #wh[key #gr[%s] prop #byl[%s] req #bgr[%s] type #bgr[%s] (isActive? #df[%s]) subconfig #byl[%s]]", this, key, prop, req, type, isSubclass(type, Active), subconfig);

      /* If the type isn't a class and an Active subclass, then simply set the
       * key and be done with it. */
      if (subconfig == null || !isSubclass(type, Active)) {
        const defType = typeOf(def), subType = typeOf(subconfig);

        /* If we're dealing with an object config, then merge the value in with
         * the default values. */
        if (defType === 'object' && subType === 'object') {
          subconfig = config[key] = merge({}, def, subconfig);
        }
        // this.log.debug("def #byl[%s] #bmg[%s] sub #byl[%s] #bmg[%s]", def, defType, subconfig, subType);
        if (copy)
          this[key] = subconfig || null;
        continue;
      }

      /* If the subconfig for this key is not an object, then wrap it in an
       * object with the implicitConfigKey. */
      switch (req) {
        case '?': case '1': case undefined:
          if (subconfig instanceof type) {
            this[key] = subconfig;
          } else {
            subconfig = type.coerceConfig(subconfig, true);
            subconfig.$key = key;
            this[key] = coerceProperty(type, subconfig)
          }
          break;
        case '*': case '+':
          this[key] = {};
          // this.log.debug("#bbl[%s] #wh[key #gr[%s] processing req #gr[%s] subconfig #byl[%s]]", this, key, req, subconfig);
          for (const subkey in subconfig) {
            if (subkey.indexOf('$') === 0) continue;
            // const subconf = coerceConfig(type, subconfig[subkey], subkey);
            const subconf = type.coerceConfig(subconfig[subkey], true/*include*/);
            subconf.$key = subkey;
            // this.log.debug("subkey #byl[%s] conf #byl[%s]", subkey, subconf);
            this[key][subkey] = coerceProperty(type, subconf)
            if (copy)
              this[subkey] = this[key][subkey];
          }
          break;
      }
    }

    function coerceType(type) {
      return typeOf(type) === 'function' ? type() : type
    }

    function coerceProperty(type, config) {
      // this.log.debug("coerceProperty() type=#gr[%s], config=#gr[%s]", type, config);
      let value;
      if (isSubclass(type, Active)) {
        value = type.provider(config, self)
        self.addSubactive(value)
      } else {
        // this.log.debug("coerceProperty() type=#gr[%s], config=#gr[%s]", type, config);
        value = config != null ? config : null
      }
      return value;
    }
  }

  addSubactive(active) {
    if (!(active instanceof Active))
      throw new Error("Active required");
    const meta = this._meta;
    const actives = meta.subactives;
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
      active.removeSuperactive(this);
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
    }
  }

  static get events() {
    return {
      // status: { args:{'status'} },
      // error:  { args:['error'] },
      // attach: { },
      // detach: { },
      // start:  { },
    }
  }

  /**
   * Describes public methods defined by this active, providing metadata and
   * other information regarding access to this method. Useful for providing
   * API implementations, auto documentation
   */
  static get methods() {
    return {
      attach: {},
      detach: {},
      start: {},
      stop: {},
    }
  }

  static get allProps() {
    let allProps = allPropsByClass.get(this);
    if (!allProps) {
      allProps = {}
      for (let type = this; type && type !== Object; type = superclass(type)) {
        // this.log.debug("type props #gr[%s] #byl[%s]", type, type.props);
        allProps = merge({}, type.props, allProps)
      }
      // this.log.debug("#bbl[%s] #wh[calculated allProps #byl[%s]]", this, props);
      allPropsByClass.set(this, allProps);
    }
    // this.log.debug("#bbl[%s] #wh[allProps #byl[%s]]", this, this[kAllProps]);
    return allProps
    // return props;
  }

  static get allEvents() {
    if (!this[kAllEvents]) {
      let events = {};
      for (let type = this; type && type !== Object; type = superclass(type))
        events = merge({}, type.props, props);
    }
    return this[kAllEvents];
  }

  /** Coerces
   *
   *  @param {object} config The configuration
   *  @param {boolean} includeUnknownKeys Whether to include unkonwn keys
   */
  static coerceConfig(config = {}, includeUnknownKeys) {
    if (config[kCoerced] === this)
      return config;
    let coerced = {}, implicit;
    if (typeOf(config) !== 'object')
      implicit = config, config = {}
    const props = this.allProps;
    if (config.$key)
      coerced.$key = config.$key;
    
    // this.log.debug("#bbl[%s] #wh[props #byl[%s] implicit #byl[%s]]", this, log.dump(this.allProps), implicit);
    for (let key in props) {
      let prop = props[key];
      let value = prop.implicit && implicit ? implicit 
          : key in config ? config[key] 
          : key === 'name' && config.$key ? config.$key
          : prop.default !== undefined ? prop.default 
          : null;
      
      /* If the config is a string, then check for extrapoliations */
      if (typeof(value) === 'string' && ~value.indexOf('${')) {
        value = interpolate(value);
      }
      // this.log.debug("#bbl[%s] #wh[prop #gr[%s] #byl[%s] implicit #gr[%s] value #gr[%s]]", this, key, prop, prop.implicit ? 'yes' : 'no', coerced[key]);

      /* Special case certain typical config parameters */
      switch (prop.type) {
        case 'uri': case 'url':
          if (value) {
            let url = value = Url.coerce(value);
            merge(coerced, url.query);
            if (!coerced.name)
              coerced.name = url.scheme;
          }
          break;
      }
      if (!(key in coerced) || value != null)
        coerced[key] = value;
    }
    if (includeUnknownKeys) {
      for (let key in config) {
        if (!(key in props))
          coerced[key] = config[key];
      }
    }
    // this.log.debug("#bbl[%s] #wh[coerced #byl[%s]]", this, coerced);
    coerced[kCoerced] = this;
    return coerced;
    // config = typeOf(config) === 'object' ? config : {[this.implicitConfigKey()]:config}
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
    // this.log.debug("impl is a #bgr[%s] #gr[%s]", typeOf(impl), impl);
    switch (typeOf(impl)) {
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
        throw new Error("Unsupported impl: " + typeOf(impl));
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
   *  @param  {object} config The config
   *  @param  {Active} owner The owner of the provider
   *  @return {Acitve} A provider of this class
   *  @since  1.0
   */
  static provider(config, owner) {
    config = this.coerceConfig(config, true);
    const providerImpls = [this, ...this.providerImpls];
    // this.log.debug("#bbl[%s] #wh[provider for config #byl[%s] providerImpls #byl[%s]]", this, config, providerImpls);
    let pick = { impl:null, priority:0 };
    for (let i = 0, ic = providerImpls.length; i < ic; i++) {
      const impl = providerImpls[i];
      const info = impl.provides(config, owner, this);
      if (info && info.priority > pick.priority)
        pick = info, pick.impl || (pick.impl = impl);
    }
    if (pick.impl == null || pick.impl == Active) {
      if (this !== Active)
        return superclass(this).provider(config, owner, this || arguments[2]);
      throw new Error(`${this}: no implementation found for: ${config.uri || config.url || config.name} (missing imports and/or requires?)`);
    }
    if (pick.opts)
      merge(config, pick.opts);
    if (pick.url)
      config.url = pick.url = Url.coerce(pick.url);

    /* Create the provider. If the implementation uses a share key, attempt to
     * find an existing provider with that name. If it exists, then use it.
     * Shared providers don't have an owner. */
    let provider, created = false;
    let supportsShare = !('shared' in config) || config.shared;
    let shareKey = supportsShare && pick.impl.sharedProviderKey(config);
    if (shareKey) {
      provider = pick.impl.sharedProviders.get(shareKey);
      // log.info("#bbl[%s] #wh[impl #df[%s] uses a share key #gr[%s] found provider #bgr[%s]]", this, pick.impl, shareKey, provider || '<none>');
      if (!provider) {
        provider = new pick.impl(config, null);
        created = true;
        pick.impl.sharedProviders.set(shareKey, provider)
        // console.log("log.dump ====> ", Object.keys(log));
        // log.info("#bbl[%s] #wh[created provider #bgr[%s] set as share key #gr[%s] this is what was set #gr[%s] map #byl[%s]]", this, `provider`, shareKey, pick.impl.sharedProviders.get(shareKey), log.dump(pick.impl.sharedProviders));
      }
      provider.shared = true;
    } else {
      // if (pick.impl.abstract) 
      //   throw new Error(this === pick.impl ? "No '" + this + "' implementation for: " + (config.url || config.uri || config.name) : "Implementation '" + pick.impl + "' of type '" + this + "' is abstract");
      provider = new pick.impl(config, owner)
      created = true;
      let ownerKey = pick.impl.ownerKey || defaultOwnerKey(pick.impl, config, owner);
      if (ownerKey)
        provider[ownerKey] = owner;
    }

    /* If there's a url and the url has a next, then create the next provider.
     * */
    if (created && this.allProps.url) {
      const url = pick.url || config.url;
      if (url.next) {
        const next = this.provider({ ...config, url:url.next }, provider);
        provider.next = next;
        const prevs = next.prevs || (next.prevs = []);
        prevs.push(provider);
        provider.addSubactive(next);
      }
    }
    
    return provider;
  }

  /** Returns the priority for this implementation class for the given *config*.
   *  The *base* is the class for which this provide
   *
   *  @param  config The configuration ({object}, required)
   *  @param  base The base active class ({class}, optional)
   *  @param  owner The owner
   *  @return A priority number, higher the more preferential, non-positive if this
   *          implementation class does not support this configuration ({number},
   *          non-null)
   *  @since  1.0
   */
  static provides(config, owner, base) {
    if (this.abstract)
      return null;
    let typeName = this.name.toLowerCase(), 
        baseName = base.name.toLowerCase();
    let shortName = typeName.replace(baseName, '');
    if (config.$key === shortName || config.$key === typeName || config.type == shortName || config.type == typeName || config.type === this.name) {
      return { impl:this, priority:5 }
    } else {
      return { impl:this, priority:1 }
    }
    // let typeName = this.name,
    //     baseName = base.name;
    // let name = typeName.replace(base, '').toLowerCase();
    // // log.info("#bbl[%s] #wh[provider priority for typeName #df[%s] baseName #df[%s] name #df[%s] base #gr[%s] config #byl[%s]]", this, typeName, baseName, name, base, config);
    // if (config.$key === name || config.type === name)
    //   return { impl:this, priority:1 };
    // return null;
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
    // this.log.debug("#bbl[%s] #wh[attach from #gr[%s]]", this, meta.status);
    switch (meta.status) {
      case 'attaching':
        return meta._attach && await meta._attach;
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
          // console.log(this + ": " + meta.status + ' -> attaching');
          this.emit('status', meta.status = 'attaching');
          await (meta._attach = this._attach());
          delete(meta._attach);
          // console.log(this + ": " + meta.status + ' -> attached');
          this.emit('status', meta.status = 'attached');
          this.emit('attach');
        } catch (error) {
          this.emit('status', meta.status = last);
          this.emit('error', error, 'attach');
          throw error;
        }
        break;
    }
  }

  async _attach() {
    const subactives = this._meta.subactives;
    this._configure();
    for (let i = 0, ic = subactives.length; i < ic; i++) {
      await subactives[i].attach();
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
          // console.log(this + ": " + meta.status + ' -> detaching');
          this.emit('status', meta.status = 'detaching');
          await this._detach();
          // console.log(this + ": " + meta.status + ' -> detached');
          this.emit('status', meta.status = 'detached');
          this.emit('detach');
        } catch (error) {
          // console.log(this + ": " + meta.status + ' -> ' + last);
          this.emit('status', meta.status = last);
          this.emit('error', error, 'detach');
          throw error;
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
          // console.log(this + ": " + meta.status + ' -> starting');
          this.emit('status', meta.status = 'starting');
          await this._start();
          // console.log(this + ": " + meta.status + ' -> started');
          this.emit('status', meta.status = 'started');
          this.emit('start');
        } catch (error) {
          if (meta.status == 'starting') {
            // console.log(this + ": " + meta.status + ' -> ' + last);
            this.emit('status', meta.status = last);
          }
          this.emit('error', 'start');
          throw error;
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
          // console.log(this + ": " + meta.status + ' -> stopping');
          this.emit('status', meta.status = 'stopping');
          await this._stop();
          // console.log(this + ": " + meta.status + ' -> attached');
          this.emit('status', meta.status = 'attached');
          this.emit('start');
        } catch (error) {
          if (meta.status == 'stopping') {
            // console.log(this + ": " + meta.status + ' -> ' + last);
            this.emit('status', meta.status = last);
          }
          this.emit('error', 'stop');
          throw error;
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
    const meta = this._meta, self = this;
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

  coverMethods(target) {
    for (let key in target) {
      if (key.startsWith('_') || key in this)
        continue;
      let prop = target[key];
      if (typeOf(prop) !== 'function') 
        continue;
      // console.log("cover: " + this + " -> " + key + "(): " + prop.constructor.name);
      let impl = this[key] = (...args) => this.native[key](...args);
      impl.cover = true;
    }
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

function defaultOwnerKey(impl, config, owner) {
  return owner ? owner.constructor.name.replace(/^[A-Z]/, function(char) { return char.toLowerCase }) : null;
}

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


/** @type Map<class,object> */
const allPropsByClass = new Map();

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

const env = {};
if (typeof(process) === 'object')
  merge(env, process.env);

function interpolate(string) {
  return string.replace(/\$\{(?:(\w+))(?::((?:[^\{\}\\]+|\\\{|\\\}|\\\\)*))?\}/g, (text, name, expr) => {
    return name in env ? env[name] : expr.replace(/\\(.)/g, (text, char) => {
      switch (char) {
        case 'n': return '\n'; 
        case 'r': return '\r';
        case 't': return '\t';
        default: return char;
      }
    })
  })
}





