'use strict';

const EventEmitter = require('eventemitter3');
const begin = require('begin');
const kv = require('keyvalues');
const Uri= require('../lib/uri.js');

const log = require('logsync');

const kAllProps = Symbol('allProps');
const kInitted = Symbol('initted');

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
    // log('info', "#bbl[%s] #wh[config #byl[%s]]", this, log.dump(this.config));
    // console.log("Creating " + this.toString());
  }

  toString() {
    var meta = this._meta;
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
    var self = this, config = this.config;
    // log('info', "#bbl[active] #wh[config #byl[%s] for active #df[%s]]", log.dump(config), this);
    var props = this.constructor.allProps;
    for (var key in props) {
      var prop = props[key],
          kind = prop.kind || 'value',
          req = prop.req,
          def = prop.default || prop.def,
          type = prop.type,
          subconfig = config[key];
      
      if (req == '?' || req == '1') kind = 'one';
      if (req == '*' || req == '+') kind = 'many';
      if (prop.one) kind = 'one', type || (type = prop.one);
      if (prop.many) kind = 'many', type || (type = prop.many);
      if (type) type = coerceType(type);

      // // { req:'1', type, def } -> { kind:'one', type, def }
      // // { req:'*', type, def } -> { kind:'many', type, def }
      // // { one:type, def } => { kind:'one', type, def }
      // // { many:type, def } => { kind:'many', type, def }

      

      //     req = prop.req,
      //     def = prop.default || prop.def,
      //     type = coerceType(prop.type),
      //     subconfig = config[key];

      // log('info', "#bbl[%s] #wh[key #gr[%s] prop #byl[%s] req #bgr[%s] type #bgr[%s] (isActive? #df[%s]) subconfig #byl[%s]]", this, key, prop, req, type, isSubclass(type, Active), subconfig);

      /* If the type isn't a class and an Active subclass, then simply set the
       * key and be done with it. */
      if (subconfig == null || !isSubclass(type, Active)) {
        var defType = kv.typeof(def), subType = kv.typeof(subconfig);

        /* If we're dealing with an object config, then merge the value in with
         * the default values. */
        if (defType === 'object' && subType === 'object') {
          subconfig = config[key] = kv.merge({}, def, subconfig);
        }
        // log('info', "def #byl[%s] #bmg[%s] sub #byl[%s] #bmg[%s]", def, defType, subconfig, subType);

        this[key] = subconfig || null;
        continue;
      }

      /* If the subconfig for this key is not an object, then wrap it in an
       * object with the implicitConfigKey. */
      // subconfig = coerceConfig(type, subconfig, key);
//      subconfig = type.coerceConfig(subconfig);
//      subconfig.$key = key;
      // log('info', "#bbl[%s] #wh[req #df[%s] type #df[%s] subconfig #byl[%s]]", this, req, type, subconfig);
      switch (kind) {
        case 'one':
        case 'value':
        case undefined:
        // case '?': case '1': case undefined:
          subconfig = type.coerceConfig(subconfig);
          subconfig.$key = key;
          this[key] = coerceProperty(type, subconfig)
          break;
        case 'many':
        // case '*': case '+':
          this[key] = {};
          // log('info', "#bbl[%s] #wh[key #gr[%s] processing req #gr[%s] subconfig #byl[%s]]", this, key, req, subconfig);
          for (var subkey in subconfig) {
            if (subkey.indexOf('$') === 0) continue;
            // var subconf = coerceConfig(type, subconfig[subkey], subkey);
            var subconf = type.coerceConfig(subconfig[subkey]);
            subconf.$key = subkey;
            // log('info', "subkey #byl[%s] conf #byl[%s]", subkey, subconf);
            this[subkey] = this[key][subkey] = coerceProperty(type, subconf)
          }
          break;
      }
    }

    function coerceType(type) {
      return kv.typeof(type) === 'function' ? type() : type
    }

//    function coerceConfig(type, config, key) {
//      if (kv.typeof(config) !== 'object')
//        config = {name:config}
//      config.$key = key
//      return config;
//    }

    function coerceProperty(type, config) {
      // log('info', "coerceProperty() type=#gr[%s], config=#gr[%s]", type, config);
      var value;
      if (isSubclass(type, Active)) {
        value = type.provider(config, self)
        self.addSubactive(value)
      } else {
        log('info', "coerceProperty() type=#gr[%s], config=#gr[%s]", type, config);
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
    var meta = this._meta;
    var actives = meta.subactives, index;
    if ((index = actives.indexOf(active)) >= 0) {
      actives.splice(index, 1);
      active.removeSuperactivity(this);
    }
    return null;
  }

  addSuperactive(active) {
    if (!(active instanceof Active))
      throw new Error("Active required");
    var meta = this._meta;
    var actives = meta.superactives;
    if (actives.indexOf(active) < 0) {
      actives.push(active);
      active.addSubactive(this);
      /* Attach or start if necessary */
      var counts = this.constructor.statusCounts(actives);
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
    var meta = this._meta;
    var actives = meta.superactives, index;
    if ((index = actives.indexOf(active)) >= 0) {
      actives.splice(index, 1);
      active.removeSubactive(this);
      /* Detach if necessary */
      var counts = this.constructor.statusCounts(actives);
      if (counts.attach == 0)
        return this.detach();
    }
    return null;
  }

  dump() {
    const depth = arguments[0] || 1;
    const text = [];
    text.push(this.toString(), " #bbk[" + log.dump(this.config, {maxlen:200}) + "]");
    var subs = this._meta.subactives;
    for (var i = 0, ic = subs.length; i < ic; i++) {
      var sub = subs[i];
      text.push('\n', ' '.repeat(depth*2));
      text.push(sub.dump(depth + 1));
    }
    return text.join('');
  }

  /*+-------------------------------------------------------------------------*
   |                             IMPLEMENTATIONS                              |
   *--------------------------------------------------------------------------*/

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
      var props = {}
      for (var type = this; type && type !== Object; type = superclass(type)) {
        // log('info', "type props #gr[%s] #byl[%s]", type, type.props);
        props = kv.merge({}, type.props, props)
      }
      // log('info', "#bbl[%s] #wh[calculated allProps #byl[%s]]", this, props);
//      this[kAllProps] = props
//    }
    // log('info', "#bbl[%s] #wh[allProps #byl[%s]]", this, this[kAllProps]);
//    return this[kAllProps]

    /* Configure prototype with props */
    if (!this[kInitted]) {
      this[kInitted] = true;
      for (let key in props) {
        const prop = props[key];
        // by default properties are configurable, enumerable, writable and have a value of undefined
        if (prop.enumerable != null || prop.writable != null) {
          const desc = {
            configurable: true, 
            enumerable: prop.enumerable != null ? prop.enumerable : true,
            writable: prop.writable != null ? prop.writable : true,
            value: prop.value != null ? prop.value : undefined,
          };
          Object.defineProperty(this.prototype, key, desc);
        }
      }
      if (this.init) this.init();
    }
    return props;
  }

  /** Coerces
   *
   *  @param  config The configuration
   */
  static coerceConfig(config) {
    var coerced = {}, implicit;
    if (kv.typeof(config) !== 'object')
      implicit = config, config = {}
    const props = this.allProps;
    // log('info', "#bbl[%s] #wh[props #byl[%s] implicit #byl[%s]]", this, log.dump(this.allProps), implicit);
    for (var key in props) {
      let prop = props[key];
      coerced[key] = prop.implicit && implicit || config[key] || (key === 'name' && config.$key) || prop.default || null;

      // log('info', "#bbl[%s] #wh[prop #gr[%s] #byl[%s] implicit #gr[%s] value #gr[%s]]", this, key, prop, prop.implicit ? 'yes' : 'no', coerced[key]);

      /* Special case certain typical config parameters */
      switch (key) {
        case 'uri': case 'url':
          let uri = coerced[key];
          if (uri) {
            uri = coerced[key] = Uri.coerce(coerced[key]);
            kv.merge(coerced, uri.query);
            if (!coerced.name)
              coerced.name = uri.scheme;
          }
          break;
      }

    }
    // log('info', "#bbl[%s] #wh[coerced #byl[%s]]", this, coerced);
    return coerced;
    // config = kv.typeof(config) === 'object' ? config : {[this.implicitConfigKey()]:config}
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
    // log('info', "impl is a #bgr[%s] #gr[%s]", kv.typeof(impl), impl);
    switch (kv.typeof(impl)) {
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
        throw new Error("Unsupported impl: " + kv.typeof(impl));
    }

    if (!isSubclass(impl, this))
      throw new Error("Implementation " + impl + " must be a subclass of " + this);
    if (this.providerImpls.indexOf(impl) < 0)
      this.providerImpls.push(impl);
  }

  static unuse(impl) {
    var index = this.providerImpls.indexOf(impl);
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
    var providerImpls = this.providerImpls;
    // log('info', "#bbl[%s] #wh[provider for config #byl[%s] providerImpls #byl[%s]]", this, config, providerImpls);
    var pick = { impl:this, priority:0 };
    for (var i = 0, ic = providerImpls.length; i < ic; i++) {
      var impl = providerImpls[i];
      var info = impl.provides(config, this);
      if (info && info.priority > pick.priority)
        pick = info, pick.impl || (pick.impl = impl);
    }
    if (pick.opts)
      kv.merge(config, pick.opts);

    /* Create the provider. If the implementation uses a share key, attempt to
     * find an existing provider with that name. If it exists, then use it.
     * Shared providers don't have an owner. */
    var provider;
    var supportsShare = !('shared' in config) || config.shared;
    var shareKey = supportsShare && pick.impl.sharedProviderKey(config, owner);
    if (shareKey) {
      provider = pick.impl.sharedProviders.get(shareKey);
      log('info', "#bbl[%s] #wh[impl #df[%s] uses a share key #gr[%s] found provider #bgr[%s]]", this, pick.impl, shareKey, provider || '<none>');
      if (!provider) {
        provider = new pick.impl(config, null);
        pick.impl.sharedProviders.set(shareKey, provider)
        // console.log("log.dump ====> ", Object.keys(log));
        log('info', "#bbl[%s] #wh[created provider #bgr[%s] set as share key #gr[%s] this is what was set #gr[%s] map #byl[%s]]", this, `provider`, shareKey, pick.impl.sharedProviders.get(shareKey), log.dump(pick.impl.sharedProviders));
      }
      provider.shared = true;
    } else {
      provider = new pick.impl(config, owner)
      var ownerKey = pick.impl.ownerKey || defaultOwnerKey(pick.impl, config, owner);
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
    var typeName = this.name,
        baseName = baseType.name;
    var name = typeName.replace(baseType, '').toLowerCase();
    log('info', "#bbl[%s] #wh[provider priority for typeName #df[%s] baseName #df[%s] name #df[%s] baseType #gr[%s] config #byl[%s]]", this, typeName, baseName, name, baseType, config);
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

  attach() {
    var self = this, meta = this._meta;
    // log('info', "#bbl[%s] #wh[attach from #gr[%s]]", self, meta.status);
    switch (meta.status) {
      case 'attaching':
      case 'attached':
      case 'starting':
      case 'started':
      case 'stopping':
      case 'stopped':
        return meta._attach || self;
      case 'detaching':
      case 'detached':
        var last = meta.status;

         return meta._attach = begin().
          then(meta._detach || self).
          then(function() {
            self.emit('status', meta.status = 'attaching', self);
            return self._attach();
          }).
          then(function() {
            self.emit('status', meta.status = 'attached', self);
            self.emit('attach', self);
            return self;
          }).
          finally(function(err, res) {
            if (err) {
              delete(meta._attach);
              self.emit('error', err, 'attach');
            }
            this(err, res);
          }).
        end();
    }
  }

  _attach() {
    var self = this, meta = this._meta, config = this.config;
    return begin().
      then(function() {
        /* Attach configured items */
        //  var props = self.constructor.allProps;
        // log('info', "Contains: #byl[%s]", props);
        self._configure();
        return null;
      }).
      each(meta.subactives).
        then(function(active) {
          // log('info', "#bbl[%s] #wh[attaching subactive #bgr[%s]]", self, active);
          return active.attach();
        }).
      end().
      then(function() {
        return null
      }).
    end();
  }

  detach() {
    var self = this, meta = this._meta;
    switch (meta.status) {
      case 'attaching':
      case 'attached':
      case 'starting':
      case 'started':
      case 'stopping':
      case 'stopped':
        var last = meta.status;
        return meta._detach = begin().
          then(meta._attach || self).
          then(function() {
            return self.stop();
          }).
          then(function() {
            self.emit('status', meta.status = 'detaching', self);
            return self._detach();
          }).
          then(function() {
            delete(meta._detach);
            self.emit('status', meta.status = 'detached', self);
            self.emit('detach', self);
            return self;
          }).
          finally(function(err, res) {
            if (err) {
              delete(meta._detach);
              self.emit('error', err, 'detach');
//              if (meta.status !== last)
//                self.emit(meta.status = last, self),
//                self.emit('status', meta.status, self);
            }
//            delete(meta._detach);
            this(err, res);
          }).
        end();
      case 'detaching':
      case 'detached':
        return meta._detach || self;
    }
  }

  _detach() {
    var self = this, meta = this._meta;
    return begin().
      each(meta.subactives).
        then(function(active) {
          return active.detach();
        }).
      end().
    end();
  }

  start() {
    var self = this, meta = this._meta;
    switch (meta.status) {
      case 'starting':
      case 'started':
        return meta._start || self;
      case 'attaching':
      case 'attached':
      case 'stopping':
      case 'stopped':
      case 'detaching':
      case 'detached':
        var last = meta.status;
        return meta._start = begin().
          then(meta._stop || self).
          then(function() {
            return self.attach();
          }).
          then(function() {
            self.emit('status', meta.status = 'starting', self);
            return self._start();
          }).
          then(function() {
            delete(meta._start);
            self.emit('status', meta.status = 'started', self);
            self.emit('start', self);
            return self;
          }).
          finally(function(err, res) {
            if (err) {
              delete(meta._start);
              self.emit('error', err, 'start');
//              if (meta.status !== last)
//                self.emit(meta.status = last, self),
//                self.emit('status', meta.status, self);
            }
//            delete(meta._start);
            this(err, res);
          }).
        end();
    }
  }

  /** Observes that the active is being started
   *
   *  @return A completion result ({promise} or non-{undefined})
   *  @see    -start()
   *  @since  1.0
   *  @MARK:  -_start()
   */
  _start() {
    var self = this, meta = this._meta;
    // log('info', "starting active #gr[%s]", this);
    return begin().
      each(meta.subactives).
        then(function(active) {
          return active.start();
        }).
      end().
    end();
  }

  /** Attaches an active
   *
   *  @return A completion result ({promise} or non-{undefined})
   *  @see    -_start()
   *  @since  1.0
   *  @MARK:  -stop()
   */
  stop() {
    var self = this, meta = this._meta;
    switch (meta.status) {
      case 'attaching':
      case 'attached':
        return meta._attach || self;
      case 'starting':
      case 'started':
        var last = meta.status;
        return meta._stop = begin().
          then(meta._start || self).
          then(function() {
            self.emit('status', meta.status = 'stopping', self);
            return self._stop();
          }).
          then(function() {
            delete(meta._stop);
            self.emit('status', meta.status = 'attached', self);
            self.emit('stop', self);
            return self;
          }).
          finally(function(err, res) {
            if (err) {
              delete(meta._stop);
              self.emit('error', err, 'stop');
//              if (meta.status !== last)
//                self.emit(meta.status = last, self),
//                self.emit('status', meta.status, self);
            }
//            delete(meta._stop);
            this(err, res);
          }).
        end();
      case 'stopping':
      case 'stopped':
      case 'detaching':
      case 'detached':
        return meta._stop || self;
    }
  }

  /** Observes that the active is being stopped
   *
   *  @return A completion result ({promise} or non-{undefined})
   *  @see    -stop()
   *  @since  1.0
   *  @MARK:  -_stop()
   */
  _stop() {
    var self = this, meta = this._meta;
    return begin().
      each(meta.subactives).
        then(function(active) {
          return active.stop();
        }).
      end().
    end();
  }

  reattach() {
    var self = this;
    return begin().
      then(function() {
        return self.detach();
      }).
      then(function() {
        return self.attach();
      }).
    end();
  }

  restart() {
    var self = this;
    return begin().
      then(function() {
        return self.stop();
      }).
      then(function() {
        return self.start();
      }).
    end();
  }

  boundMethod(name) {
    var self = this, meta = this._meta;
    var method = meta.boundMethods[name];
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

  static statusCounts(actives) {
    var counts = { total:0, attach:0, start:0, stop:0, detach:0 };
    for (var i = 0, ic = actives.length; i < ic; i++) {
      var active = actives[i];
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
  var superproto = Object.getPrototypeOf(subclass.prototype);
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

var statuses = {
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

var statusNames = new Map();
for (let key in statuses) {
  statusNames[statuses[key]] = key;
}
Object.defineProperty(Active, 'statuses', {value:statuses});



var statusNames = {};
for (var key in statuses)
  statusNames[statuses[key]] = key;
var statusCodes = {
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
