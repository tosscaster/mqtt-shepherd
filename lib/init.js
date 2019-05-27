'use strict'

var Q = require('q')
var _ = require('busyman')
var mqtt = require('mqtt')
var mosca = require('mosca')
var debug = require('debug')('mqtt-shepherd:init')
var mutils = require('./components/mutils')
var msghdlr = require('./components/msghandler')
var MqttNode = require('./components/mqtt-node')
var init = {}

init.setupShepherd = function (shepherd, callback) {
  var deferred = Q.defer()
  var broker
  var initProcedure
  var mBrokerEvents = [ // Event names for removing broker listeners
    'ready', 'clientConnected', 'clientDisconnecting', 'clientDisconnected', 'published', 'subscribed', 'unsubscribed'
  ]

  debug('mqtt-shepherd booting...')

  initProcedure = function () {
    init._setupAuthPolicy(shepherd).then(function () { // 1. set up authorization for priphs
      debug('Auth policy is set.')
      _.forEach(mBrokerEvents, function (event) {
        broker.removeAllListeners(event) // 2. remove all listeners attached
      })
      return true
    }).then(function () {
      return init._attachBrokerEventListeners(shepherd) // 3. re-attach listeners:
    }).then(function () {
      return init._setShepherdAsClient(shepherd) // 4. let shepherd in
    }).then(function () {
      debug('Create a mqtt client for shepherd.')
      return init._testShepherdPubSub(shepherd) // 5. run shepherd pub/sub testing
    }).delay(800).then(function () {
      debug('Internal pub/sub testing done.')
      return init._attachShepherdMessageHandler(shepherd)
    }).fail(function (err) {
      deferred.reject(err)
    }).done(function () {
      debug('mqtt-shepherd is up and ready.')
      deferred.resolve()
    })
  }

  init._loadNodesFromDb(shepherd).then(function () {
    debug('Loading qnodes from database done.')
    return shepherd.updateNetInfo()
  }).then(function () {
    if (!shepherd.mBroker) {
      shepherd.mBroker = new mosca.Server(shepherd.brokerSettings)
      debug('Broker is up.')
    } else {
      setTimeout(function () {
        debug('Broker is up.')
        shepherd.mBroker.emit('ready')
      }, 20)
    }

    broker = shepherd.mBroker
    broker.once('ready', initProcedure)
  }).fail(function (err) {
    deferred.reject(err)
  }).done()

  return deferred.promise.nodeify(callback)
}

init._setupAuthPolicy = function (shepherd) {
  var deferred = Q.defer()
  var shepherdId = shepherd.clientId
  var broker = shepherd.mBroker

  broker.authenticate = function (client, user, pass, cb) {
    var defaultAccount = shepherd.defaultAccount

    var isAdded = shepherd._setClient(client)

    var authorized = false

    function feedback (err, isAuthorized) {
      if (!isAdded) { cb(new Error('Client already exists.'), false) } else { cb(err, isAuthorized) }
    }

    if (client.id === shepherdId) { // always let shepherd pass
      authorized = true
      client.user = shepherdId
    } else if (!_.isNil(defaultAccount)) { // if shepherd has a default account, try it
      authorized = (user === defaultAccount.username && pass.toString() === defaultAccount.password)
    }

    if (authorized) { // client use a default account and successfully authenticated
      feedback(null, authorized)
    } else { // client use other account, pass up to app-level authentication
      if (shepherd.authPolicy && _.isFunction(shepherd.authPolicy.authenticate)) {
        shepherd.authPolicy.authenticate(client, user, pass, feedback)
      } else if (!defaultAccount) { // if app-level authentication is not implemented, pass all clients
        feedback(null, true)
      } else {
        feedback(null, false)
      }
    }
  }

  broker.authorizePublish = function (client, topic, payload, cb) {
    var validTopic = mutils.slashPath(topic)

    if (client.id === shepherdId) { // shepherd can always publish
      cb(null, true)
    } else if (validTopic === ('register/' + client.id) || validTopic === ('response/' + client.id)) {
      // before registration, anyone can just publish to 'register' topic, and 'response' back from the shepherd request
      cb(null, true)
    } else if (shepherd._nodebox[client.id]) { // << client.user && >> shepherd._nodebox[client.id]
      // only registered client can publish to arbitrary topics
      if (shepherd.authPolicy && _.isFunction(shepherd.authPolicy.authorizePublish)) { shepherd.authPolicy.authorizePublish(client, topic, payload, cb) } else { cb(null, true) }
    }
  }

  broker.authorizeSubscribe = function (client, topic, cb) {
    var validTopic = mutils.slashPath(topic)

    if (client.id === shepherdId) { // shepherd can always subscribe
      cb(null, true)
    } else if (validTopic === 'register/response/' + client.id ||
                   validTopic === 'deregister/response/' + client.id ||
                   validTopic === 'request/' + client.id) {
      // before registration, anyone can just subscribe to his own registeration and request channels:
      cb(null, true)
    } else if (shepherd._nodebox[client.id]) { // << client.user && >> shepherd._nodebox[client.id]
      // only registered client can subscribe to arbitrary topics
      if (shepherd.authPolicy && _.isFunction(shepherd.authPolicy.authorizeSubscribe)) { shepherd.authPolicy.authorizeSubscribe(client, topic, cb) } else { cb(null, true) }
    }
  }

  broker.authorizeForward = function (client, packet, cb) {
    if (client.id === shepherdId) {
      cb(null, true)
    } else {
      if (shepherd.authPolicy && _.isFunction(shepherd.authPolicy.authorizeForward)) { shepherd.authPolicy.authorizeForward(client, packet, cb) } else { cb(null, true) }
    }
  }

  deferred.resolve()
  return deferred.promise
}

init._attachBrokerEventListeners = function (shepherd) {
  var deferred = Q.defer()
  var broker = shepherd.mBroker
  var shepherdId = shepherd.clientId

  broker.on('clientConnected', function (client) {
    var qnode = shepherd._nodebox[client.id]

    if (client.id !== shepherdId) {
      shepherd.emit('priphConnected', client)

      if (qnode) { // if in nodebox, perform maintain after 2 seconds
        setTimeout(function () {
          setImmediate(function () {
            if (qnode.getStatus() !== 'sleep') { qnode._setStatus('online') }

            qnode.pingReq().then(function (rsp) {
              if (rsp.status === mutils.rspCodeNum('OK')) { return qnode.maintain() }
            }).fail(function (err) {
              debug(err)
            }).done()
          })
        }, 2000)
      } else if (!shepherd._joinable || !shepherd._enabled) {
        client.close()
      }
    }
  })

  broker.on('clientDisconnecting', function (client) {
    if (client.id !== shepherdId) { shepherd.emit('priphDisconnecting', client) }
  })

  broker.on('clientDisconnected', function (client) {
    var qnode = shepherd._nodebox[client.id]

    var mClient = shepherd._getClient(client.id)

    if (mClient) {
      mClient.close()
      shepherd._deleteClient(client.id)
    }

    if (qnode) {
      if (qnode.so) {
        if (qnode.getStatus() !== 'sleep') { qnode._setStatus('offline') }

        qnode.dbSave().done()
      } else {
        shepherd.remove(client.id).fail(function (err) {
          debug(err)
        }).done()
      }
    }

    if (client.id !== shepherdId) { shepherd.emit('priphDisconnected', client) }
  })

  broker.on('published', function (packet, client) {
    if (client && (client.id !== shepherdId)) { shepherd.emit('priphPublished', packet, client) }
  })

  broker.on('subscribed', function (topic, client) {
    if (client.id !== shepherdId) { shepherd.emit('priphSubscribed', topic, client) }
  })

  broker.on('unsubscribed', function (topic, client) {
    if (client.id !== shepherdId) { shepherd.emit('priphUnsubscribed', topic, client) }
  })

  deferred.resolve()
  return deferred.promise
}

init._setShepherdAsClient = function (shepherd) {
  var deferred = Q.defer()
  var shepherdId = shepherd.clientId
  var options = shepherd.clientConnOptions
  var mc

  options.clientId = shepherdId

  if (!shepherd.mClient) {
    shepherd.mClient = mqtt.connect('mqtt://localhost', options)

    mc = shepherd.mClient

    mc.on('connect', function (connack) {
      if (connack.sessionPresent) { // session already exists, no need to subscribe again
        deferred.resolve()
        return deferred.promise.nodeify()
      }

      mc.subscribe(shepherd._channels, function (err, granted) { // subscribe to topics of all channels
        // _.forEach(granted, function (gn) { SHP(gn); }); // [DEBUG]
        if (err) {
          deferred.reject(err)
        } else {
          deferred.resolve(granted)
        }
      })
    })
  }
  return deferred.promise
}

init._testShepherdPubSub = function (shepherd) {
  var deferred = Q.defer()
  var mc = shepherd.mClient
  var shepherdId = shepherd.clientId
  var testTopics = [ 'register', 'deregister', 'schedule', 'update', 'notify', 'response', 'ping', 'request', 'announce', 'lwt' ]
  var testMessage = '{"test": "testme"}'
  var testMsgListener
  var totalCount = testTopics.length
  var checkCount = 0

  testTopics = testTopics.map(function (tp) {
    return (tp + '/response/' + shepherdId) // register/response/shepherdId
  })

  testMsgListener = function (topic, message, packet) {
    var msgStr = message.toString()

    var parsedMsg = mutils.jsonify(msgStr)

    parsedMsg = _.isObject(parsedMsg) ? _.assign(parsedMsg, { clientId: shepherdId }) : msgStr

    switch (topic) {
      case testTopics[0]: // register/response/shepherdId
      case testTopics[1]: // deregister/response/shepherdId
      case testTopics[2]: // schedule/response/shepherdId
      case testTopics[3]: // update/response/shepherdId
      case testTopics[4]: // notify/response/shepherdId
      case testTopics[5]: // response/response/shepherdId
      case testTopics[6]: // ping/response/shepherdId
      case testTopics[7]: // request/response/shepherdId     -- should remove after test
      case testTopics[8]: // announce/response/shepherdId    -- should remove after test
      case testTopics[9]: // lwt/response/shepherdId
        if (parsedMsg.test === 'testme') { checkCount += 1 }
        break
      default:
        break
    }

    if (checkCount === totalCount) {
      mc.removeListener('message', testMsgListener)
      deferred.resolve()
    }
  }

  mc.on('message', testMsgListener)

  _.forEach(testTopics, function (tp) {
    setTimeout(function () {
      mc.publish(tp, testMessage)
    }, 20)
  })

  return deferred.promise
}

init._dispatchMessage = function (shepherd, intf, cId, topic, message) {
  var msgStr
  var parsedMsg
  var messageHandler
  var realIntf = intf
  var unknownIntf = false
  var qnode = shepherd._nodebox[cId]
  var objMsgChs = [ 'register', 'deregister', 'schedule', 'notify', 'update', 'response', 'ping', 'lwt' ]

  msgStr = message.toString() // convert buffer to string
  parsedMsg = mutils.jsonify(msgStr) // jsonify the message, keep it as an string if get no object
  parsedMsg = _.isObject(parsedMsg) ? _.assign(parsedMsg, { clientId: cId }) : msgStr // all msgs must have clientId

  shepherd.emit('message', topic, parsedMsg)

  // deal with the unknown 'qnode' here, thus no need to check it in each _handler
  if (!qnode && intf !== 'register') { // no qnode before 'register', continue if we received 'register'
    if (intf !== 'response') { // need not send back while receiving a 'response'
      shepherd._responseSender(intf, cId, {
        transId: _.isObject(parsedMsg) ? parsedMsg.transId : null,
        status: mutils.rspCodeNum('NotFound')
      })
      return
    }
  }

  if (intf === 'lwt') { // last and will message
    parsedMsg = {
      clientId: cId,
      data: msgStr
    }
  }

  // if we are here, the qnode may exist, and it is alive, re-enable his life checker
  // if not register yet, got no qnode here
  if (qnode) { qnode.enableLifeChecker() }

  if (_.includes(objMsgChs, intf) && !_.isObject(parsedMsg)) { intf = '_badMsg' }

  switch (intf) {
    case 'register':
      // reg_data = { clientId, transId, lifetime, version, objList, ip, mac, port(opt) }
      messageHandler = msghdlr._clientRegisterHandler
      break
    case 'deregister':
      // dereg_data = { clientId, transId };
      messageHandler = msghdlr._clientDeregisterHandler
      break
    case 'schedule':
      // check_data = { clientId, transId, sleep, duration(opt) };
      messageHandler = msghdlr._clientCheckHandler
      break
    case 'notify':
      // notify_data = { clientId, transId, oid, iid, rid, data }
      _.forEach(parsedMsg, function (val, key) {
        if (key === 'oid') { parsedMsg.oid = mutils.oidKey(val) }
      })
      // we must get oid first, here is why another _.forEach() for getting rid key
      _.forEach(parsedMsg, function (val, key) {
        if (key === 'rid') {
          try {
            parsedMsg.rid = mutils.ridKey(parsedMsg.oid, val)
          } catch (e) {
            // parsedMsg.rid = parsedMsg.rid
          }
        }
      })

      messageHandler = msghdlr._clientNotifyHandler
      break
    case 'update':
      // update_data = { clientId, transId, lifeTime(opt), version(opt), objList(opt), ip(opt), mac(opt), port(opt) }
      messageHandler = msghdlr._clientUpdateHandler
      break
    case 'response':
      // rsp_data = { clientId, transId, cmdId, status, data }
      parsedMsg.cmdId = mutils.cmdKey(parsedMsg.cmdId)
      messageHandler = msghdlr._clientResponseHandler
      break
    case 'ping':
      // ping_data = { clientId, transId }
      messageHandler = msghdlr._clientPingHandler
      break
    case 'lwt':
      // lwt_data = { clientId, data }
      messageHandler = msghdlr._clientLwtHandler
      break
    case '_badMsg':
      messageHandler = msghdlr._clientBadMsgHandler
      break
    default:
      // pass the orginal arguments to _clientOtherTopicsHandler()
      unknownIntf = true
      messageHandler = msghdlr._clientOtherTopicsHandler
      break
  }

  setImmediate(function () {
    if (unknownIntf) { messageHandler(shepherd, topic, message, null) } else if (intf === '_badMsg') { messageHandler(shepherd, cId, realIntf, parsedMsg) } else { messageHandler(shepherd, parsedMsg) }
  })
}

init._attachShepherdMessageHandler = function (shepherd) {
  var deferred = Q.defer()
  var mc = shepherd.mClient

  mc.unsubscribe([ 'request/#', 'announce/#' ])

  mc.removeAllListeners('error')
  mc.removeAllListeners('message')

  mc.on('error', function (err) {
    shepherd.emit('error', err)
  })

  // attach message handler for each channel of topics
  mc.on('message', function (topic, message, packet) {
    // 'request/#', 'announce/#' were taken off
    // topics: 'register/*', 'deregister/*', 'schedule/*', notify/*', 'update/*', 'response/*', 'ping'
    // packet: { cmd: 'publish', messageId: 42, qos: 2, dup: false,
    //           topic: 'test', payload: new Buffer('test'), retain: false }
    // [NOTE] message is a buffer

    var topicItems = mutils.pathItems(topic)
    // check and return the nice topic format

    var intf = topicItems[0]
    // 'register' of example: 'register/ea:3c:4b:11:0e:6d'

    var cId = topicItems[1] ? topicItems[1] : null // 'ea:3c:4b:11:0e:6d'

    // we dont accept an id like 'response', it is a reserved keyword
    if (cId === 'response') {
      return
    }

    shepherd.decrypt(message, cId, function (err, decrypted) {
      // log 'decrytion fails'
      if (err) {
        debug('Decrytion fails. From client id: ' + cId)
      } else {
        init._dispatchMessage(shepherd, intf, cId, topic, decrypted)
      }
    })
  })

  deferred.resolve()
  return deferred.promise
}

init._loadNodesFromDb = function (shepherd) {
  var deferred = Q.defer()
  var mqdb = shepherd._mqdb
  var restoreNodes = []

  if (mqdb) {
    mqdb.exportClientIds().then(function (cIds) {
      _.forEach(cIds, function (clientId) {
        var resNode,
          doRestore

        resNode = shepherd._nodebox[clientId] = new MqttNode(shepherd, clientId)
        resNode._setStatus('offline')
        doRestore = resNode.restore().then(function () {
          resNode.enableLifeChecker()
        }).fail(function () {
          // load data fail, kill it
          resNode.dbRemove().done()
          shepherd._nodebox[clientId] = null
          delete shepherd._nodebox[clientId]
        })

        restoreNodes.push(doRestore)
      })

      return Q.allSettled(restoreNodes)
    }).done(function (resArr) {
      deferred.resolve(shepherd)
    }, function (err) {
      deferred.reject(err)
    })
  } else {
    deferred.reject(new Error('No datastore.'))
  }

  return deferred.promise
}

module.exports = init
