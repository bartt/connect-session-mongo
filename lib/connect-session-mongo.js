/**
* Based on the following classes:
* https://github.com/senchalabs/connect/tree/master/lib/connect/middleware/session/memory.js
* https://github.com/ciaranj/express-session-mongodb
* https://github.com/davglass/express-session-mongodb
*/
var mongo = require('mongodb'),
    util = require(process.binding('natives').util ? 'util' : 'sys'),
    Store = require('connect').session.Store,
    Db = mongo.Db,
    Connection = mongo.Connection,
    Server = mongo.Server;

var MongoStore = module.exports = function(options) {
    options = options || {};
    Store.call(this, options);
    
    // Default reapInterval to 10 minutes
    this.reapInterval = options.reapInterval || 600000;

    if (this.reapInterval !== -1) {
        setInterval(function(self){
            self.reap(self.maxAge);
        }, this.reapInterval, this);
    }
    
    var server,
        dbName = (options.db) ? options.db : 'connect-sessions',
        ip = (options.ip) ? options.ip : '127.0.0.1',
        port = (options.port) ? options.port : 27017;

    this._collection = (options.collection) ? options.collection : 'sessions';

    if (options.server) {
        server = options.server;
    } else {
        server= new Server(ip, port, {auto_reconnect: true}, {});
    }

    // As much as I favor native drivers, the node-mongodb-native native driver isn'this
    // on par with its pure implementation. E.g. Long.toNumber() doesn't work.
    this._db = new Db( dbName, server, { native_parser: false });
    this._db.open(function(db) {});
    
}

util.inherits(MongoStore, Store);

MongoStore.prototype.reap = function(ms) {
    var thresh = Number(new Date(Number(new Date) - ms));
    this._db.collection(this._collection, function(err, collection) {
        collection.remove({ "lastAccess" : { "$lt" : thresh }}, function() {});
    });
};

MongoStore.prototype.set = function(sid, sess, fn) {
    this._db.collection(this._collection, function(err, collection) {
        var clone = cloneOwnProperties(sess);
        clone._id = sid;
        delete clone._sessionid;
        collection.save(clone, function(err, document) {
          if (!err) {
            fn && fn(null, sess);
          }
        });
    });
};

MongoStore.prototype.get = function(sid, fn) {
    this._db.collection(this._collection, function(err, collection) {
        collection.findOne({ _id: sid }, function(err, session_data) {
            if (err) {
                fn && fn(err);
            } else {
                if (session_data) {
                    session_data = cleanSessionData(session_data);
                }
                fn && fn(null, session_data);
            }
        });
    });
};

MongoStore.prototype.destroy = function(sid, fn) {
    this._db.collection(this._collection, function(err, collection) {
        collection.remove({ _id: sid }, function() {
            fn && fn();
        });
    });
};

MongoStore.prototype.length = function(fn) {
    this._db.collection(this._collection, function(err, collection) {
        collection.count(function(count) {
            console.log('Session has: ', count);
            fn && fn(null, count);
        });
    });
};

MongoStore.prototype.all = function(fn) {
    var arr = [];
    this._db.collection(this._collection, function(err, collection) {
        collection.find(function(err, cursor) {
            cursor.each(function(d) {
                d = cleanSessionData(d);
                arr.push(d);
            });
            fn && fn(null, arr);
        });
    });
};

MongoStore.prototype.clear = function(fn) {
    this._db.collection(this._collection, function(err, collection) {
        collection.remove(function() {
            fn && fn();
        });
    });
};

var cleanSessionData = function(json) {
    var data = {};
    for (var i in json) {
        // We encode the session id in mongo's _id primary key field for indexing purposes.
        if (i === '_id') {
          data._sessionid = json[i];
        }
        else {
          data[i] = json[i];
        }
        // lastAccess is a Unix timestamp which mongo stores as a 2 component Long object. Convert it back to number.
        if (data[i] instanceof mongo.BSONPure.Long) {
            data[i] = data[i].toNumber();
        }
    }
    return data;
};

/**
 * There is a problem in Mongo's Native & Pure drivers in that functions of the session's prototype are also saved to
 * mongo. Cloning just the session's own properties is a workaround.
 *
 * @param original {Object} The session object whose own properties should be cloned.
 */
var cloneOwnProperties = function(original) {
  var copy = {};
  for (var i in original) {
    if (original.hasOwnProperty(i)) {
      copy[i] = original[i];
    }
  }
  return copy;
};