/**
* Based on the following classes:
* https://github.com/senchalabs/connect/tree/master/lib/connect/middleware/session/memory.js
* https://github.com/ciaranj/express-session-mongodb
* https://github.com/davglass/express-session-mongodb
*/
var mongo = require('mongodb'),
    Store = require('connect').session.Store,
    util = require('util'),
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
        dbName = options.db || 'connect-sessions',
        ip = options.ip || '127.0.0.1',
        port = options.port || 27017;

    this._collection = options.collection || 'sessions';

    if (options.server) {
        server = options.server;
    } else {
        server= new Server(ip, port, {auto_reconnect: true}, {});
    }

    if (options.url) {
       var connectCallback = function(self) {
          return function(err, returnedInstance) {
             if (err) {
                console.log('mongo connect error: ' + err);
             } else {
                console.log('connected session db');
                self._db = returnedInstance;
             }
          };
       };
       
       Db.connect(options.url, connectCallback(this));
    } else {
       this._db = new Db(dbName, server);
       this._db.open(function(err, db) {if (err) {console.log(err);}});
    }
};

util.inherits(MongoStore, Store);

MongoStore.prototype.reap = function(ms) {
    var thresh = Number(new Date(Number(new Date()) - ms));
    this._db.collection(this._collection, function(err, collection) {
        collection.remove({ "lastAccess" : { "$lt" : thresh }}, function() {});
    });
};

MongoStore.prototype.set = function(sid, sess, fn) {
    this._db.collection(this._collection, function(err, collection) {
        collection.findOne({ _sessionid: sid }, function(err, session_data) {
            if (err) {
                if (fn) {fn(err);}
            } else {
                sess._sessionid = sid;
                var clone = cloneOwnProperties(sess);
                if (session_data) {
                    sess.lastAccess = (new Date()).getTime();
                    // Add mongo's internal ID so that collection.save() won't create a new object.
                    clone._id = session_data._id;
                }
                collection.save(clone, function(err, document) {
                    if (!err) {
                        if (fn) {fn(null, sess);}
                    }
                });
            }
        });
    });
};

MongoStore.prototype.get = function(sid, fn) {
    this._db.collection(this._collection, function(err, collection) {
        collection.findOne({ _sessionid: sid }, function(err, session_data) {
            if (err) {
                if (fn) {fn(err);}
            } else {
                if (session_data) {
                    session_data = cleanSessionData(session_data);
                }
                if (fn) {fn(null, session_data);}
            }
        });
    });
};

MongoStore.prototype.destroy = function(sid, fn) {
    this._db.collection(this._collection, function(err, collection) {
        collection.remove({ _sessionid: sid }, function() {
            if (fn) {fn();}
        });
    });
};

MongoStore.prototype.length = function(fn) {
    this._db.collection(this._collection, function(err, collection) {
        collection.count(function(count) {
            console.log('Session has: ', count);
            if (fn) {fn(null, count);}
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
            if (fn) {fn(null, arr);}
        });
    });
};

MongoStore.prototype.clear = function(fn) {
    this._db.collection(this._collection, function(err, collection) {
        collection.remove(function() {
            if (fn){fn();}
        });
    });
};

var cleanSessionData = function(json) {
    var i;
    var data = {};
    for (i in json) {
       if (json.hasOwnProperty(i)) {
        // Don't return mongo's internal ID for the session.
         if (i !== '_id') { 
            data[i] = json[i];
        // lastAccess is a Unix timestamp which mongo stores as a 2 component Long object. Convert it back to number.
            if (data[i] instanceof mongo.BSONPure.Long) {
               data[i] = data[i].toNumber();
            }
         }
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
  var i;
  var copy = {};
  for (i in original) {
    if (original.hasOwnProperty(i)) {
      copy[i] = original[i];
    }
  }
  return copy;
};
