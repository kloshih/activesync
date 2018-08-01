
# active

- containr
- active

### Features

- **ES6 Class Support**
  Uses ES6 classes
- **Shared Actives**
  Actives may be shared across the application. Implementation classes may decide when and how sharing works. Sharing may also be expired.
- **Inversion of Control (IoC) / Dependency Injection (DI)**
  Classes are not tied to dependencies.
- Dependency Control
- Phased Attach/Detach, Start/Stop
- Configuration
  - Dynamic configuration
  - Runtime metadata
- Connectors
  - Shared connectors
- Start and stop
- External control
  - Status publishing
  - Management actions
  - Administrative control
- CLI
  - Start stop
  - Shell
- Provider?


- No import


    ```js
      _start() {
        var self = this;
        return begin().
          then(this.super()).
          then(function() {
            /* Configure reads the +contain descriptors and creates corresponding
             * services that it needs to connect to. If there's no existing
             * active, with this object as the top-level active. */
            contain.configure(self, self.config);
          })
        end();
      }
    ```


- class
- begin
- log
- keyvalues
- array
- connector
- config
- activities


# Connector Features

- chain
- sessions
- shared (stomp)
- multi (redis)
- resources (mongo://localhost/db1/coll1 => mongocoll:coll1|mongodb:db1|mongoserver://localhost/)
- tunneled sessions
- routing
- piping (binary)


rk-as.app@dev.etg.1

"*.*@dev.client.*": {mongo:"mongo://", stomp:".."}, {mongo:/db, stomp:/a/b}

# 
