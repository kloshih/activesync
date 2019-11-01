

let message : string = "Hello World!";
console.log(message);




class Active extends EventEmitter {

  public readonly config: object;
  public owner: object;
  protected meta: object;
  
  constructor(public config: object, public owner: object) {
    super();
  }
  
  _configure() {
    let config: object = this.config;
    let props: object = this.constructor.allProps;
    for (let key in props) {
      let prop: object = props[key];
      let req: string = prop.req;
      let def: string = prop.default || prop.def;
      let type = coerceType(prop.type);
      let subconfig: object = config[key];

      if (subconfig == null || !isSubclass(type, Active)) {
        let defType = typeof(def), subType = typeof(subconfig);
        if (defType == 'object' && subType == 'object') {
          subconfig = config[key] = kv.merge({}, def, subconfig);
        }
        this[key] = subconfig || null;
        continue;
      }

      switch (req) {
        case '?': case '1': case undefined:
          subconfig = type.coerceConfig(subconfig);
          subconfig
          break;
        case '*': case '+':
          break;
      }

    }
    
  }

  
  async attach() {
    switch (this.status) {
      case 'attaching':
      case 'attached':
      case 'starting':
      case 'started':
      case 'stopping':
      case 'stopped':
      case 'detaching':
      case 'detached':
      
    }
  }
  async start() {
  }
  async stop() {
  }
  async detach() {
  }
 

}

function active(): (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  return function(target, propertyKey:string, descriptor: PropertyDescriptor): void {
    
  };
}
function onStart(target, key, desc) {

}

function active1() {

}

@active()
class TextService {

  @onStart()
  async _start() {
    
  }
  

}


function tive() {
  return function(target: any, key: string, desc: PropertyDescriptor) {
    
  }
}

@tive('some/service')
class SomeService {

  
  

  
}




/**
 * The Meta class 
 */
class Meta {

  status: string;

  constructor() {
    this.status = 'detached';
    this.subactives = [];
    this.superactives = [];
  }
  
  emit(event:string, status: string, arg: any) {
  }

  async attach() {
    switch (this.status) {
      case 'detached':
        const last = this.status;
        this.emit('status', this.status = 'attaching', this.target);
        await this._attach();

    }
  }
  

  static async start(meta: Meta) { 
  }

  static async stop(meta: Meta) { 
  }

  static async attach(meta: Meta) { 
    
  }

  static async detach(meta: Meta) { 
  }

}


/**
 * 
 */
const kIid = Symbol('iid');
function nextIid(type: class) {
  return type[kIid] = (type[kIid] || 0) + 1;
}

function model(desc:PropertyDescriptor) {}


interface Status {
  /**
   * The name of the status
   */
  name: string;
}

