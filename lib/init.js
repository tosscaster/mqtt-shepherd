const Q = require('q')
const _ = require('lodash')
const mqtt = require('mqtt')
//const mosca = require('mosca')
const aedes = require('aedes')();
const debug = require('debug')('mqtt-shepherd:init')

const mutils = require('./components/mutils')
const msghdlr = require('./components/msghandler')
const MqttNode = require('./components/mqtt-node')

const init = {}

init.setupShepherd = function (shepherd, callback) {
  const deferred = Q.defer()
  let broker
  let initProcedure
  //const mBrokerEvents = [ // Event names for removing broker listeners
  //  'ready', 'clientConnected', 'clientDisconnecting', 'clientDisconnected', 'published', 'subscribed', 'unsubscribed'
  //]
  const mBrokerEvents = [ // Event names for removing broker listeners
    'ready', 'client', 'clientDisconnect', 'publish', 'subscribe ', 'unsubscribe'
  ]

  debug('mqtt-shepherd booting...')

  initProcedure = function () {
    init._setupAuthPolicy(shepherd).then(() => { // 1. set up authorization for priphs
      debug('Auth policy is set.')
      _.forEach(mBrokerEvents, (event) => {
        broker.removeAllListeners(event) // 2. remove all listeners attached
      })
      return true
    }).then(() => init._attachBrokerEventListeners(shepherd) // 3. re-attach listeners:
    ).then(() => init._setShepherdAsClient(shepherd) // 4. let shepherd in
    )
      .then(() => {
        debug('Create a mqtt client for shepherd.')
        return init._testShepherdPubSub(shepherd) // 5. run shepherd pub/sub testing
      })
      .delay(800)
      .then(() => {
        debug('Internal pub/sub testing done.')
        return init._attachShepherdMessageHandler(shepherd)
      })
      .fail((err) => {
        deferred.reject(err)
      })
      .done(() => {
        debug('mqtt-shepherd is up and ready.')
        deferred.resolve()
      })
  }

  init._loadNodesFromDb(shepherd).then(() => {
    debug('Loading qnodes from database done.')
    return shepherd.updateNetInfo()
  }).then(() => {
    if (!shepherd.mBroker) {
      //shepherd.mBroker = new mosca.Server(shepherd.brokerSettings)
      const server = require('net').createServer(aedes.handle)
      server.listen(shepherd.brokerSettings.port, () => {
        debug('Broker started and listening on port ' + shepherd.brokerSettings.port);
        shepherd.mBroker.emit('ready')
      })
      shepherd.mBroker = aedes;
      //debug('Broker is up.')
    } else {
      setTimeout(() => {
        debug('Broker is already up.')
        shepherd.mBroker.emit('ready')
      }, 20)
    }

    broker = shepherd.mBroker
    broker.once('ready', initProcedure)
  }).fail((err) => {
    deferred.reject(err)
  })
    .done()

  return deferred.promise.nodeify(callback)
}

init._setupAuthPolicy = function (shepherd) {
  const deferred = Q.defer()
  const shepherdId = shepherd.clientId
  const broker = shepherd.mBroker

  broker.authenticate = function (client, user, pass, cb) {
    //debug("broker.authenticate")
    const { defaultAccount } = shepherd
    const isAdded = shepherd._setClient(client)
    let authorized = false

    function feedback (err, isAuthorized) {
      if (!isAdded) cb(new Error('Client already exists.'), false)
      else cb(err, isAuthorized)
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

  //broker.authorizePublish = function (client, topic, payload, cb) {
  broker.authorizePublish = function(client, packet, cb) {
    //debug("broker.authorizePublish")
    const validTopic = mutils.slashPath(packet.topic)

    if (client.id === shepherdId) { // shepherd can always publish
      //cb(null, true)
      cb(null)
    } else if (validTopic === (`register/${client.id}`) || validTopic === (`response/${client.id}`)) {
      // before registration, anyone can just publish to 'register' topic, and 'response' back from the shepherd request
      //cb(null, true)
      cb(null)
    } else if (shepherd._nodebox[client.id]) { // << client.user && >> shepherd._nodebox[client.id]
      // only registered client can publish to arbitrary topics
      if (shepherd.authPolicy && _.isFunction(shepherd.authPolicy.authorizePublish)) shepherd.authPolicy.authorizePublish(client, packet, cb)
      else cb(null)
      //else cb(null, true)
    }
  }

  //broker.authorizeSubscribe = function (client, topic, cb) {
  broker.authorizeSubscribe = function(client, subscriptions, cb) {
    //debug("broker.authorizeSubscribe")
    const validTopic = mutils.slashPath(subscriptions.topic)

    if (client.id === shepherdId) { // shepherd can always subscribe
      //cb(null, true)
      cb(null, subscriptions)
    } else if (validTopic === `register/response/${client.id}` ||
                   validTopic === `deregister/response/${client.id}` ||
                   validTopic === `request/${client.id}`) {
      // before registration, anyone can just subscribe to his own registeration and request channels:
      //cb(null, true)
      cb(null, subscriptions)
    } else if (shepherd._nodebox[client.id]) { // << client.user && >> shepherd._nodebox[client.id]
      // only registered client can subscribe to arbitrary topics
      if (shepherd.authPolicy && _.isFunction(shepherd.authPolicy.authorizeSubscribe)) shepherd.authPolicy.authorizeSubscribe(client, subscriptions, cb)
      else cb(null, subscriptions)
      //else cb(null, true)
    }
  }

  broker.authorizeForward = function(client, packet) {
    //debug("broker.authorizeForward -----------")
    //debug(packet)
    if (client.id === shepherdId) {
      return packet;
    } else if (shepherd.authPolicy && _.isFunction(shepherd.authPolicy.authorizeForward)) {
      return shepherd.authPolicy.authorizeForward(client, packet);
    } else {
      return packet;
    }
  }

  /*
  broker.authorizeForward = function (client, packet, cb) {
    if (client.id === shepherdId) {
      cb(null, true)
    } else if (shepherd.authPolicy && _.isFunction(shepherd.authPolicy.authorizeForward)) shepherd.authPolicy.authorizeForward(client, packet, cb)
    else cb(null, true)
  }
  */

  broker.published = function (packet, client, cb) {
    cb(null);
  };

  deferred.resolve()
  return deferred.promise
}

init._attachBrokerEventListeners = function (shepherd) {
  const deferred = Q.defer()
  const broker = shepherd.mBroker
  const shepherdId = shepherd.clientId
  //broker.on('clientConnected', (client) => {
  broker.on('client', client => {
    debug(`=========== client <- ${client.id}`)
    const qnode = shepherd._nodebox[client.id]

    if (client && (client.id !== shepherdId)) {
      shepherd.emit('priphConnected', client)

      if (qnode) { // if in nodebox, perform maintain after 2 seconds
        setTimeout(() => {
          setImmediate(() => {
            if (qnode.getStatus() !== 'sleep') qnode._setStatus('online')

            qnode.pingReq().then((rsp) => {
              if (rsp.status === mutils.rspCodeNum('OK')) return qnode.maintain()
            }).fail((err) => {
              debug(err)
            }).done()
          })
        }, 2000)
      } else if (!shepherd._joinable || !shepherd._enabled) {
        client.close()
      }
    }
  })

  //broker.on('clientDisconnecting', (client) => {
  //  if (client.id !== shepherdId) shepherd.emit('priphDisconnecting', client)
  //})

  //broker.on('clientDisconnected', (client) => {
  broker.on('clientDisconnect', client => {
    debug(`clientDisconnect <- ${client.id}`)
    const qnode = shepherd._nodebox[client.id]
    const mClient = shepherd._getClient(client.id)

    if (mClient) {
      mClient.close()
      shepherd._deleteClient(client.id)
    }

    if (qnode) {
      if (qnode.so) {
        if (qnode.getStatus() !== 'sleep') qnode._setStatus('offline')

        qnode.dbSave().done()
      } else {
        shepherd.remove(client.id).fail((err) => {
          debug(err)
        }).done()
      }
    }

    if (client && (client.id !== shepherdId)) shepherd.emit('priphDisconnected', client)
  })

  //broker.on('published', (packet, client) => {
  broker.on('publish', (packet, client) => {
    debug(`publish <- ${client}`)
    if (client && (client.id !== shepherdId)) shepherd.emit('priphPublished', packet, client)
  })

  //broker.on('subscribed', (topic, client) => {
  broker.on('subscribe', (subscriptions, client) => {
    debug(`subscribe <- ${client.id}`)
    if (client && (client.id !== shepherdId)) shepherd.emit('priphSubscribed', subscriptions, client)
  })

  //broker.on('unsubscribed', (topic, client) => {
  broker.on('unsubscribe', (unsubscriptions, client) => {
    debug(`unsubscribe <- ${client.id}`)
    if (client && (client.id !== shepherdId)) shepherd.emit('priphUnsubscribed', unsubscriptions, client)
  })

  debug('->attachBrokerEventListeners')
  deferred.resolve()
  return deferred.promise
}

init._setShepherdAsClient = function (shepherd) {
  const deferred = Q.defer()
  const shepherdId = shepherd.clientId
  const options = shepherd.clientConnOptions
  const port = shepherd.brokerSettings.port
  let mc
  //debug(`->port: ${port}`)
  options.clientId = shepherdId

  if (!shepherd.mClient) {
    shepherd.mClient = mqtt.connect(`mqtt://localhost:${port}`, options)
    debug('->setShepherdAsClient: mqtt.connect')
    mc = shepherd.mClient

    mc.on('connect', (connack) => {
      //debug('->setShepherdAsClient: connected----')
      if (connack.sessionPresent) { // session already exists, no need to subscribe again
        deferred.resolve()
        // return deferred.promise.nodeify(callback)
      }
      //debug(shepherd._channels)
      mc.subscribe(shepherd._channels, (err, granted) => { // subscribe to topics of all channels
        // _.forEach(granted, function (gn) { SHP(gn); }); // [DEBUG]
        if (err) {
          deferred.reject(err)
        } else {
          //debug('->setShepherdAsClient: mc.subscribe----')
          deferred.resolve(granted)
        }
      })
    })
  }
  return deferred.promise
}

init._testShepherdPubSub = function (shepherd) {
  const deferred = Q.defer()
  const mc = shepherd.mClient
  const shepherdId = shepherd.clientId
  let testTopics = ['register', 'deregister', 'schedule', 'update', 'notify', 'response', 'ping', 'request', 'announce', 'lwt']
  const testMessage = '{"test": "testme"}'
  let testMsgListener
  const totalCount = testTopics.length
  let checkCount = 0

  testTopics = testTopics.map(tp => (`${tp}/response/${shepherdId}`) // register/response/shepherdId
  )

  testMsgListener = function (topic, message, packet) {
    //debug(`testMsgListener: ${topic}`)
    const msgStr = message.toString()
    let parsedMsg = mutils.jsonify(msgStr)

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
        if (parsedMsg.test === 'testme') checkCount += 1
        break
      default:
        break
    }
    //debug(`testMsgListener count: ${checkCount}`)
    if (checkCount === totalCount) {
      mc.removeListener('message', testMsgListener)
      //debug(`testMsgListener: resolve`)
      deferred.resolve()
    }
  }

  mc.on('message', testMsgListener)

  _.forEach(testTopics, (tp) => {
    setTimeout(() => {
      mc.publish(tp, testMessage)
    }, 20)
  })

  return deferred.promise
}

init._dispatchMessage = function (shepherd, intf, cId, topic, message) {
  let msgStr
  let parsedMsg
  let messageHandler
  const realIntf = intf
  let unknownIntf = false
  const qnode = shepherd._nodebox[cId]
  const objMsgChs = ['register', 'deregister', 'schedule', 'notify', 'update', 'response', 'ping', 'lwt']

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
  if (qnode) qnode.enableLifeChecker()

  if (_.includes(objMsgChs, intf) && !_.isObject(parsedMsg)) intf = '_badMsg'

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
      _.forEach(parsedMsg, (val, key) => {
        if (key === 'oid') parsedMsg.oid = mutils.oidKey(val)
      })
      // we must get oid first, here is why another _.forEach() for getting rid key
      _.forEach(parsedMsg, (val, key) => {
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

  setImmediate(() => {
    if (unknownIntf) messageHandler(shepherd, topic, message, null)
    else if (intf === '_badMsg') messageHandler(shepherd, cId, realIntf, parsedMsg)
    else messageHandler(shepherd, parsedMsg)
  })
}

init._attachShepherdMessageHandler = function (shepherd) {
  const deferred = Q.defer()
  const mc = shepherd.mClient

  mc.unsubscribe(['request/#', 'announce/#'])

  mc.removeAllListeners('error')
  mc.removeAllListeners('message')

  mc.on('error', (err) => {
    shepherd.emit('error', err)
  })

  // attach message handler for each channel of topics
  mc.on('message', (topic, message, packet) => {
    if (packet.cmd != "pingresp") {
      console.log("mc message <<------------------")
      console.log(packet)
      console.log("---")
    }
    debug(topic)
    //debug(JSON.stringify(message))
    // 'request/#', 'announce/#' were taken off
    // topics: 'register/*', 'deregister/*', 'schedule/*', notify/*', 'update/*', 'response/*', 'ping'
    // packet: { cmd: 'publish', messageId: 42, qos: 2, dup: false,
    //           topic: 'test', payload: new Buffer('test'), retain: false }
    // [NOTE] message is a buffer

    const topicItems = mutils.pathItems(topic) // check and return the nice topic format
    const intf = topicItems[0] // 'register' of example: 'register/ea:3c:4b:11:0e:6d'
    const cId = topicItems[1] ? topicItems[1] : null // 'ea:3c:4b:11:0e:6d'

    // we dont accept an id like 'response', it is a reserved keyword
    if (cId === 'response') return

    shepherd.decrypt(message, cId, (err, decrypted) => {
      if (err) debug(`Decrytion fails. From client id: ${cId}`) // log 'decrytion fails'
      else init._dispatchMessage(shepherd, intf, cId, topic, decrypted)
    })
  })

  deferred.resolve()
  return deferred.promise
}

init._loadNodesFromDb = function (shepherd) {
  const deferred = Q.defer()
  const mqdb = shepherd._mqdb
  const restoreNodes = []

  if (mqdb) {
    mqdb.exportClientIds().then((cIds) => {
      _.forEach(cIds, (clientId) => {
        let resNode
        let doRestore

        resNode = shepherd._nodebox[clientId] = new MqttNode(shepherd, clientId)
        resNode._setStatus('offline')
        doRestore = resNode.restore().then(() => {
          resNode.enableLifeChecker()
        }).fail(() => {
          // load data fail, kill it
          resNode.dbRemove().done()
          shepherd._nodebox[clientId] = null
          delete shepherd._nodebox[clientId]
        })

        restoreNodes.push(doRestore)
      })

      return Q.allSettled(restoreNodes)
    }).done((resArr) => {
      deferred.resolve(shepherd)
    }, (err) => {
      deferred.reject(err)
    })
  } else {
    deferred.reject(new Error('No datastore.'))
  }

  return deferred.promise
}

module.exports = init
