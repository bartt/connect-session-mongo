# MongoDB Session Storage for Connect Middleware

This module is an addon for [Connect Middleware](https://github.com/senchalabs/connect) that adds a new [Session Storage device](https://github.com/senchalabs/connect/blob/master/docs/session.md).


## Install

    npm install connect-session-mongo

## Usage

The standard usage, is to just pass an instantiated `MongoStore` instance to the session plugin.

    var connect = require('connect'),
        MongoStore = require('connect-session-mongo');

    var app = connect.createServer();

    app.configure(function(){
        app.use(connect.cookieDecoder());
        app.use(connect.session({ store: new MongoStore() }));
        app.use(app.router);
    });

You can also pass several options to the constructor to tweak your session store:

* db - The name of the db to use, defaults to: `connect-sessions`
* ip - The IP address of the server to connect to, defaults to: `127.0.0.1`
* port - The Port to connect to, defaults to: `27017`
* collection - The collection to save its data to, defaults to: `sessions`
* server - A custom mongo Server instance (this overides db, ip &amp; port)
* url - A url to use for Db.connect style database connections (this overrides db, ip, port &amp; server)
* reapInterval - Time to wait (ms) before removing aged session documents
* reapAge - Age (ms) at which session documents become subject to reaping

An optional callback function(err, connectedDb) can also be passed to the constructor after the options.

<pre><code>var CustomServer = new Server(123.456.789.1, 12345, { auto_reconnect: true }, {});
app.use(connect.session({ store: new MongoStore({ server: CustomServer }) }));</code></pre>

<pre><code>app.use(connect.session({url: process.env.MONGO_URL}, function(err,db) {if (err) {throw err;}}));</code></pre>

### Based on these classes

* [Sencha Connect Memory Store](https://github.com/senchalabs/connect/tree/master/lib/connect/middleware/session/memory.js)
* [ciaranj's express-session-mongodb](https://github.com/ciaranj/express-session-mongodb)
* [davglass's express-session-mongodb](https://github.com/davglass/express-session-mongodb)
