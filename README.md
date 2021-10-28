
# activesync

A class definition for building capable services using fluent configuration-driven (IoC) structure. Applications and frameworks built with **activesync** support the following features out of the box:

- Inversion of Control (IoC)
- Dependency Injection (DI)
- Natural plugin services
- Start and stop coordination
- Constructs object hierarchy based on configuration data
- Uses promises and async / await
- Automatic configuration parsing 

Simply extend the *Active* class

## Installing

Using npm:

    $ npm install --save activesync

Using yarn

    $ yarn add activesync

## Examples


```js
const Active = require('activesync');

class Example extends Active {

  async _start() {
    await super._start();
    console.log('Started');
  }

}
```

## Lifecycle Management 

Actives provides the ability to 



## Using Configuration

Specifying the configuration parameters for a class is simple. The  static `props` object defines the properties that can be configured for this class. There are three types of properties that can be defined:

- **Simple Values** — strings, numbers, arrays, hashes
- **Other Actives** — to-one to another active
- **An array of other Actives** – to-many to other actives

For example, these next two code snippets define a server class and a datastore class. When a *Server* is created with a configuration that specifies a *datastore*, the datastore is automatically configured and started along with the server. 

```js
// server.js
const Active = require('activesync');
const Datastore = require('./datastore');

class Server extends Active {
  
  static get props() {
    return {
      port: { type:'number' },
      datastore: { type:Datastore },
    }
  }

  async _start() {
    await super._start();

    // Configuration is parsed, sub-Actives are started
    console.log('Port: ' + this.port);
    console.log('Datastore settings: ' + this.datastore.settings());
  }
  
}
```

```js
// datastore.js
const Active = require('activesync');
const knex = require('knex');

class Datastore extends Active {

  static get props() {
    url: { mode:'url' },
  }
  
  async _start() {
    await super._start();
    // configuration is parsed, this.url is available 
    let { scheme:client, host, user, password } = this.url;
    let database = this.url.path[0] || 'defaultdb';
    this.knex = knex({ 
      client, 
      connection: {host, user, password, database}, 
    });
  }

  async _stop() {
    await this.knex.close();
  }

  async settings() {
    return await this.knex.select().from('settings').limit(1);
  }

}
```

Calling on *Server* is relatively simple. Simply create the server with a configuration as the first argument and call `start()` to start all of its composed services. 

```js
// main.js

const Server = require('./server.js');

let config = {
  port: 8000,
  datastore: 'pg://user:pass@host:5432/datastore',
}

async run() {
  
  let server = new Server(config);
  await server.start();
  // server running
  await server.stop();
  // server stopped

}
run();
```


## The `Active` Class

> **`Active.props`**

Declared using `static get props() { ... }`, the properties define properties and configuration for the class. Props may take the form of: 

```js

```

> **`Active.use(`***impl***`)`**  
> **`Active.unuse(`***impl***`)`**  

When building plugins, `Active.use()` specify that an active should be included in the lookup of list of plugins. See the section on plugins.

### Attaching and Starting

> **`async attach(`***impl***`)`**  
> **`async start(`***impl***`)`**  
> **`async stop(`***impl***`)`**  
> **`async detach(`***impl***`)`**  

Manages the lifecycle of the instance. These four actions and backed by an internal api used for lifecycle hooks with underscore prefixed names, `_attach()`, `_detach()`, `_start()` and `_stop()`. The process of attaching is to process configurations and collect and bind resources. The process of starting should be for validating settings, connecting to remote resources and APIs, starting timers and other processes. 

Since `start()` will call `attach()` if needed, you typically don't need to manage the attached state. 

> **`async reattach(`***impl***`)`**  

Shorthand to `detach()` and `attach()`

> **`async restart(`***impl***`)`**  

Shorthand to `stop()` and `start()`

### Managing Related Services

> **`addSubactive(`***active***`)`**  
> **`removeSubactive(`***active***`)`**  
> **`addSuperactive(`***active***`)`**  
> **`removeSuperactive(`***active***`)`**  

Adds or removes an *active* subordinate or suprioer to this active. The *active* will be started or stopped automatically as needed. Actives can have more than one parent, especially for shared or singleton actives. 

Typically, you do not have to manage adding or removing actives. This hierarchy is managed for you. However, if you have a custom startup process and wish to manage automatic starts and stops and error handling. You may do this yourself. 


