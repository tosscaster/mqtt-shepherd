/* eslint-env mocha */
var fs = require('fs')
var path = require('path')
var _ = require('busyman')
var Q = require('q')
var chai = require('chai')
var sinon = require('sinon')
var sinonChai = require('sinon-chai')
var expect = chai.expect
chai.use(sinonChai)
var Shepherd = require('../index.js')
var config = require('../lib/config.js')
var msgHdlr = require('../lib/components/msghandler.js')

/***************************************************/
/** * Prepare Shepherd Settings                   ***/
/***************************************************/
var shpClientId = 'shp_test'
// try {
//     fs.unlinkSync(path.resolve('./lib/database/mqtt.db'));
//     fs.unlinkSync(path.resolve('./test/database/mqtt1.db'));
// } catch (e) {
//     console.log(e);
// }

after(function (done) {
  fs.unlink(path.resolve('./lib/database/mqtt.db'), function () {
    setTimeout(function () {
      done()
    }, 200)
  })
})

describe('Top Level of Tests', function () {
  before(function (done) {
    var unlink1 = false

    var unlink2 = false

    fs.stat('./lib/database/mqtt.db', function (err, stats) {
      if (err) {
        unlink1 = true
        return
      }
      if (stats.isFile()) {
        fs.unlink(path.resolve('./lib/database/mqtt.db'), function () {
          unlink1 = true
          if (unlink1 && unlink2) { done() }
        })
      }
    })

    fs.stat('./test/database/mqtt1.db', function (err, stats) {
      if (err) {
        fs.stat('./test/database', function (err, stats) {
          unlink2 = true

          if (err) {
            fs.mkdir('./test/database', function () {
              if (unlink1 && unlink2) { done() }
            })
          } else {
            if (unlink1 && unlink2) { done() }
          }
        })
      } else if (stats.isFile()) {
        fs.unlink(path.resolve('./test/database/mqtt1.db'), function () {
          unlink2 = true
          if (unlink1 && unlink2) { done() }
        })
      }
    })
  })

  describe('Constructor Check', function () {
    var shepherd
    before(function () {
      shepherd = new Shepherd('test1', { dbPath: path.join(__dirname, '/database/mqtt1.db') })
    })

    it('should has all correct members after new', function () {
      expect(shepherd.clientId).to.be.equal('test1')
      expect(shepherd.brokerSettings).to.be.equal(config.brokerSettings)
      expect(shepherd.defaultAccount).to.equal(null)
      expect(shepherd.clientConnOptions).to.be.equal(config.clientConnOptions)
      expect(shepherd.reqTimeout).to.be.equal(config.reqTimeout)
      expect(shepherd._dbPath).to.be.equal(path.join(__dirname, '/database/mqtt1.db'))
      expect(shepherd._mqdb).to.be.an('object')
      expect(shepherd._nodebox).to.be.an('object')
      expect(shepherd._joinable).to.equal(false)
      expect(shepherd._enabled).to.equal(false)
      expect(shepherd._permitJoinTime).to.be.equal(0)
      expect(shepherd._startTime).to.be.equal(0)
      expect(shepherd._net).to.be.deep.equal({ intf: '', ip: '', mac: '', routerIp: '' })
      expect(shepherd._channels).to.be.deep.equal({
        'register/#': 0,
        'deregister/#': 0,
        'notify/#': 1,
        'update/#': 1,
        'response/#': 1,
        'ping/#': 0,
        'schedule/#': 0,
        'lwt/#': 0,
        'request/#': 0,
        'announce/#': 0
      })
      expect(shepherd._areq).to.be.an('object')

      expect(shepherd.mBroker).to.equal(null)
      expect(shepherd.mClient).to.equal(null)

      expect(shepherd.authPolicy).to.be.an('object')
      expect(shepherd.authPolicy.authenticate).to.equal(null)
      expect(shepherd.authPolicy.authorizePublish).to.be.a('function')
      expect(shepherd.authPolicy.authorizeSubscribe).to.be.a('function')
      expect(shepherd.authPolicy.authorizeForward).to.be.a('function')

      expect(shepherd.encrypt).to.be.a('function')
      expect(shepherd.decrypt).to.be.a('function')
      expect(shepherd.nextTransId).to.be.a('function')
      expect(shepherd.permitJoin).to.be.a('function')
    })

    it('should throw if name is given but not a string', function () {
      expect(function () { return new Shepherd({}, {}) }).to.throw(TypeError)
      expect(function () { return new Shepherd([], {}) }).to.throw(TypeError)
      expect(function () { return new Shepherd(1, {}) }).to.throw(TypeError)
      expect(function () { return new Shepherd(true, {}) }).to.throw(TypeError)
      expect(function () { return new Shepherd(NaN, {}) }).to.throw(TypeError)

      expect(function () { return new Shepherd() }).not.to.throw(Error)
      expect(function () { return new Shepherd('xxx') }).not.to.throw(Error)
      expect(function () { return new Shepherd({}) }).not.to.throw(Error)
    })

    it('should throw if setting is given but not an object', function () {
      expect(function () { return new Shepherd([]) }).to.throw(TypeError)

      expect(function () { return new Shepherd('xxx', []) }).to.throw(TypeError)
      expect(function () { return new Shepherd('xxx', 1) }).to.throw(TypeError)
      expect(function () { return new Shepherd('xxx', true) }).to.throw(TypeError)
    })
  })

  describe('Signature Check', function () {
    // var shepherd = new Shepherd('test2', { dbPath:  __dirname + '/database/mqtt1.db' });

    var shepherd
    before(function () {
      shepherd = new Shepherd('test1', { dbPath: path.join(__dirname, '/database/mqtt1.db') })
    })

    describe('#.permitJoin', function () {
      it('should throw if time is given but not a number', function () {
        expect(function () { shepherd.permitJoin({}) }).to.throw(TypeError)
        expect(function () { shepherd.permitJoin(true) }).to.throw(TypeError)
      })
    })

    describe('#.find', function () {
      it('should throw if clientId is not a string', function () {
        expect(function () { shepherd.find({}) }).to.throw(TypeError)
        expect(function () { shepherd.find(true) }).to.throw(TypeError)
        expect(function () { shepherd.find('ceed') }).not.to.throw(TypeError)
      })
    })

    describe('#.findByMac', function () {
      it('should throw if macAddr is not a string', function () {
        expect(function () { shepherd.findByMac({}) }).to.throw(TypeError)
        expect(function () { shepherd.findByMac(true) }).to.throw(TypeError)
        expect(function () { shepherd.findByMac('ceed') }).not.to.throw(TypeError)
      })
    })

    describe('#.remove', function () {
      it('should throw if clientId is not a string', function () {
        expect(function () { shepherd.remove({}) }).to.throw(TypeError)
        expect(function () { shepherd.remove(true) }).to.throw(TypeError)
        expect(function () { shepherd.remove('ceed') }).not.to.throw(TypeError)
      })
    })

    describe('#._responseSender', function () {
      it('should throw if clientId is not a string', function () {
        expect(function () { shepherd._responseSender('register', {}, {}) }).to.throw(TypeError)
        expect(function () { shepherd._responseSender('register', true, {}) }).to.throw(TypeError)
        expect(function () { shepherd._responseSender('register', 'ceed', {}) }).not.to.throw(TypeError)
      })
    })

    describe('#._requestSender', function () {
      it('should throw if clientId is not a string', function () {
        expect(function () { shepherd._requestSender('register', {}, {}) }).to.throw(TypeError)
        expect(function () { shepherd._requestSender('register', true, {}) }).to.throw(TypeError)
        expect(function () { shepherd._requestSender('register', 'ceed', {}) }).not.to.throw(TypeError)
      })
    })

    describe('#.readReq', function () {
      it('should throw if clientId is not a string', function () {
        expect(function () { shepherd.readReq({}, {}) }).to.throw(TypeError)
        expect(function () { shepherd.readReq(true, {}) }).to.throw(TypeError)
        expect(function () { shepherd.readReq('ceed', {}) }).not.to.throw(TypeError)
      })
    })

    describe('#.writeReq', function () {
      it('should throw if clientId is not a string', function () {
        expect(function () { shepherd.writeReq({}, {}) }).to.throw(TypeError)
        expect(function () { shepherd.writeReq(true, {}) }).to.throw(TypeError)
        expect(function () { shepherd.writeReq('ceed', {}) }).not.to.throw(TypeError)
      })
    })

    describe('#.writeAttrsReq', function () {
      it('should throw if clientId is not a string', function () {
        expect(function () { shepherd.writeAttrsReq({}, {}) }).to.throw(TypeError)
        expect(function () { shepherd.writeAttrsReq(true, {}) }).to.throw(TypeError)
        expect(function () { shepherd.writeAttrsReq('ceed', {}) }).not.to.throw(TypeError)
      })
    })

    describe('#.discoverReq', function () {
      it('should throw if clientId is not a string', function () {
        expect(function () { shepherd.discoverReq({}, {}) }).to.throw(TypeError)
        expect(function () { shepherd.discoverReq(true, {}) }).to.throw(TypeError)
        expect(function () { shepherd.discoverReq('ceed', {}) }).not.to.throw(TypeError)
      })
    })

    describe('#.executeReq', function () {
      it('should throw if clientId is not a string', function () {
        expect(function () { shepherd.executeReq({}, {}) }).to.throw(TypeError)
        expect(function () { shepherd.executeReq(true, {}) }).to.throw(TypeError)
        expect(function () { shepherd.executeReq('ceed', {}) }).not.to.throw(TypeError)
      })
    })

    describe('#.observeReq', function () {
      it('should throw if clientId is not a string', function () {
        expect(function () { shepherd.observeReq({}, {}) }).to.throw(TypeError)
        expect(function () { shepherd.observeReq(true, {}) }).to.throw(TypeError)
        expect(function () { shepherd.observeReq('ceed', {}) }).not.to.throw(TypeError)
      })
    })

    describe('#.pingReq', function () {
      it('should throw if clientId is not a string', function () {
        expect(function () { shepherd.pingReq({}) }).to.throw(TypeError)
        expect(function () { shepherd.pingReq(true) }).to.throw(TypeError)
        expect(function () { shepherd.pingReq('ceed') }).not.to.throw(TypeError)
      })
    })

    describe('#.list', function () {
      it('should throw if cIds is not an array of strings', function () {
        expect(function () { shepherd.list({}) }).to.throw(TypeError)
        expect(function () { shepherd.list(true) }).to.throw(TypeError)
        expect(function () { shepherd.list([ 'ceed', {} ]) }).to.throw(TypeError)

        expect(function () { shepherd.list('ceed') }).not.to.throw(Error)
        expect(function () { shepherd.list([ 'ceed', 'xxx' ]) }).not.to.throw(Error)
      })
    })
  })

  describe('Functional Check', function () {
    var _setClientStub
    var shepherd = new Shepherd(shpClientId, { dbPath: path.resolve('./test/database/mqtt2.db') })
    // this.timeout(15000);
    before(function () {
      _setClientStub = sinon.stub(shepherd, '_setClient', function () { return true })
    })

    after(function () {
      _setClientStub.restore()
    })

    describe('#.permitJoin', function () {
      it('should not throw if shepherd is not enabled when permitJoin invoked - shepherd is disabled.', function () {
        expect(shepherd.permitJoin(3)).to.equal(false)
      })

      it('should trigger permitJoin counter and event when permitJoin invoked - shepherd is enabled.', function (done) {
        shepherd._enabled = true
        shepherd.once('permitJoining', function (joinTime) {
          shepherd._enabled = false
          if (shepherd._joinable && joinTime === 3) { done() }
        })
        shepherd.permitJoin(3)
      })
    })

    describe('#.start', function () {
      this.timeout(6000)

      it('should start ok, _ready and reday should be fired, _enabled,', function (done) {
        var _readyCbCalled = false
        var readyCbCalled = false
        var startCbCalled = false

        shepherd.once('_ready', function () {
          _readyCbCalled = true
          if (_readyCbCalled && readyCbCalled && startCbCalled && shepherd._enabled) {
            setTimeout(function () {
              done()
            }, 200)
          }
        })

        shepherd.once('ready', function () {
          readyCbCalled = true
          if (_readyCbCalled && readyCbCalled && startCbCalled && shepherd._enabled) {
            setTimeout(function () {
              done()
            }, 200)
          }
        })

        shepherd.start(function (err, result) {
          if (err) console.warn(err)
          startCbCalled = true
          if (_readyCbCalled && readyCbCalled && startCbCalled && shepherd._enabled) {
            setTimeout(function () {
              done()
            }, 200)
          }
        })
      })
    })

    describe('#.find', function () {
      it('should find nothing', function () {
        expect(shepherd.find('nothing')).to.equal(undefined)
      })
    })

    describe('#.findByMac', function () {
      it('should find nothing - empty array', function () {
        expect(shepherd.findByMac('no_mac')).to.be.deep.equal([])
      })
    })

    describe('#register new qnode: fired by mc.emit(topic, message, packet)', function () {
      it('should fire registered and get a new qnode', function (done) {
        var _responseSenderSpy = sinon.spy(shepherd, '_responseSender')
        var _clientObjectDetailReqStub = sinon.stub(msgHdlr, '_clientObjectDetailReq', function (shp, cId, objList) {
          return Q.resolve([
            { oid: 0, data: { 1: { x1: 'hi' }, 2: { x2: 'hello' }, 3: { x3: 'hey' } } },
            { oid: 1, data: { 4: { x4: 'hi' }, 5: { x5: 'hello' }, 6: { x6: 'hey' } } }
          ])
        })

        shepherd.on('_registered', function (qnode) {
          _clientObjectDetailReqStub.restore()
          _responseSenderSpy.restore()
          expect(_responseSenderSpy).to.have.been.calledWith('register', 'test01')
          if (shepherd.find('test01') === qnode && shepherd.findByMac('foo:mac')[0] === qnode) { done() }
        })

        emitMcRawMessage(shepherd, 'register/test01', {
          transId: 100,
          ip: '127.0.0.2',
          mac: 'foo:mac',
          lifetime: 123456,
          version: '0.0.1',
          objList: {
            0: [ 1, 2, 3 ],
            1: [ 4, 5, 6 ]
          }
        })
      })

      it('should get correct info about the shepherd', function () {
        var shpInfo = shepherd.info()
        expect(shpInfo.devNum).to.be.equal(1)
        expect(shpInfo.enabled).to.equal(true)
        expect(shpInfo.name).to.be.equal('shp_test')
      })

      it('should list only one device', function () {
        var devList = shepherd.list()
        expect(devList.length).to.be.equal(1)
        expect(devList[0].clientId).to.be.equal('test01')
        expect(devList[0].lifetime).to.be.equal(123456)
        expect(devList[0].ip).to.be.equal('127.0.0.2')
        expect(devList[0].mac).to.be.equal('foo:mac')
        expect(devList[0].version).to.be.equal('0.0.1')
        expect(devList[0].objList).to.be.deep.equal({ '0': [ 1, 2, 3 ], '1': [ 4, 5, 6 ] })
        expect(devList[0].status).to.be.equal('online')
      })
    })

    describe('#.announce', function () {
      it('should announce properly', function (done) {
        var annCb = sinon.spy()
        shepherd.announce('hello').then(annCb).done(function () {
          expect(annCb).should.have.been.calledOnce // eslint-disable-line
          done()
        })
      })
    })

    describe('#qnode.readReq', function () {
      it('should send readReq properly - resource - update', function (done) {
        var qnode = shepherd.find('test01') // { '0': [ 1, 2, 3 ], '1': [ 4, 5, 6 ] } }
        var readReqCb = sinon.spy() // (clientId, reqObj, callback)

        qnode.readReq('0/1/x1').then(readReqCb).done(function () {
          expect(readReqCb).should.have.been.calledOnce // eslint-disable-line
          expect(readReqCb).to.be.calledWith({ status: 205, data: 'world' })
          done()
        })

        // fake rx
        emitMcRawMessage(shepherd, 'response/test01', {
          transId: shepherd._currentTransId(),
          cmdId: 'read',
          oid: 0,
          iid: 1,
          rid: 'x1',
          status: 205,
          data: 'world'
        })
      })

      it('should send readReq properly - resource - again but no update', function (done) {
        var qnode = shepherd.find('test01') // { '0': [ 1, 2, 3 ], '1': [ 4, 5, 6 ] } }
        var readReqCb = sinon.spy() // (clientId, reqObj, callback)

        qnode.readReq('0/1/x1').then(readReqCb).done(function () {
          expect(readReqCb).should.have.been.calledOnce // eslint-disable-line
          expect(readReqCb).to.be.calledWith({ status: 205, data: 'world' })
          done()
        })

        // fake rx
        emitMcRawMessage(shepherd, 'response/test01', {
          transId: shepherd._currentTransId(),
          cmdId: 'read',
          oid: 0,
          iid: 1,
          rid: 'x1',
          status: 205,
          data: 'world'
        })
      })

      it('should send readReq properly - instance - update', function (done) {
        var qnode = shepherd.find('test01') // { '0': [ 1, 2, 3 ], '1': [ 4, 5, 6 ] } }
        var readReqCb = sinon.spy() // (clientId, reqObj, callback)

        qnode.readReq('0/1').then(readReqCb).done(function () {
          expect(readReqCb).should.have.been.calledOnce // eslint-disable-line
          expect(readReqCb).to.be.calledWith({ status: 205, data: { x1: 'hi world', x11: 'yap' } })
          done()
        })

        // fake rx
        emitMcRawMessage(shepherd, 'response/test01', {
          transId: shepherd._currentTransId(),
          cmdId: 'read',
          oid: 0,
          iid: 1,
          status: 205,
          data: { x1: 'hi world', x11: 'yap' }
        })
      })

      it('should send readReq properly - object - update', function (done) {
        var qnode = shepherd.find('test01') // { '0': [ 1, 2, 3 ], '1': [ 4, 5, 6 ] } }
        var readReqCb = sinon.spy() // (clientId, reqObj, callback)
        //  { oid: 0, data: { 1: { x1: 'hi' }, 2: { x2: 'hello' }, 3: { x3: 'hey' } }},
        qnode.readReq('0').then(readReqCb).done(function () {
          expect(readReqCb).should.have.been.calledOnce // eslint-disable-line
          expect(readReqCb).to.be.calledWith({ status: 205,
            data: {
              1: { x1: 'bro' },
              2: { x2: 'sis' },
              3: { x3: 'dad', x4: 'mom' }
            } })
          done()
        })

        // fake rx
        emitMcRawMessage(shepherd, 'response/test01', {
          transId: shepherd._currentTransId(),
          cmdId: 'read',
          oid: 0,
          status: 205,
          data: {
            1: { x1: 'bro' },
            2: { x2: 'sis' },
            3: { x3: 'dad', x4: 'mom' }
          }
        })
      })
    })

    describe('#qnode.writeReq', function () {
      this.timeout(10000)
      it('should send writeReq properly - resource - update', function (done) {
        var qnode = shepherd.find('test01') // { '0': [ 1, 2, 3 ], '1': [ 4, 5, 6 ] } }
        var writeReqCb = sinon.spy() // (clientId, reqObj, callback)

        qnode.writeReq('0/1/x1', 'new_x1_value').then(writeReqCb).done(function () {
          expect(writeReqCb).should.have.been.calledOnce // eslint-disable-line
          expect(writeReqCb).to.be.calledWith({ status: 204, data: 'new_x1_value' })

          setTimeout(function () {
            done()
          }, 250)
        })

        // fake rx
        emitMcRawMessage(shepherd, 'response/test01', {
          transId: shepherd._currentTransId(),
          cmdId: 'write',
          oid: 0,
          iid: 1,
          rid: 'x1',
          status: 204,
          data: 'new_x1_value'
        })

        // emit slightly latter
        setTimeout(function () {
          emitMcRawMessage(shepherd, 'response/test01', {
            transId: shepherd._currentTransId() - 1,
            cmdId: 'read',
            oid: 0,
            iid: 1,
            rid: 'x1',
            status: 205,
            data: 'new_x1_value_read'
          })
        }, 200)
      })

      it('should send writeReq properly - instance - update', function (done) {
        var qnode = shepherd.find('test01') // { '0': [ 1, 2, 3 ], '1': [ 4, 5, 6 ] } }
        var writeReqCb = sinon.spy() // (clientId, reqObj, callback)

        // x60 has no effect
        qnode.writeReq('0/1', { x1: 'new_x1_value2', x60: 3 }).then(writeReqCb).done(function () {
          expect(writeReqCb).should.have.been.calledOnce // eslint-disable-line
          expect(writeReqCb).to.be.calledWith({ status: 204, data: { x1: 'new_x1_value2' } })

          setTimeout(function () {
            done()
          }, 250)
        })

        // fake rx
        emitMcRawMessage(shepherd, 'response/test01', {
          transId: shepherd._currentTransId(), // for write
          cmdId: 'write',
          oid: 0,
          iid: 1,
          status: 204,
          data: { x1: 'new_x1_value2' }
        })

        // emit slightly latter
        setTimeout(function () {
          emitMcRawMessage(shepherd, 'response/test01', {
            transId: shepherd._currentTransId() - 1, //  inner write +1, thus should -1 to backoff
            cmdId: 'read',
            oid: 0,
            iid: 1,
            status: 205,
            data: { x1: 'new_x1_value2_read', x100: '11233' }
          })
        }, 100)
      })
    })

    describe('#qnode.writeAttrsReq', function () {
      it('should send writeAttrsReq properly - resource', function (done) {
        var qnode = shepherd.find('test01') // { '0': [ 1, 2, 3 ], '1': [ 4, 5, 6 ] } }
        var writeAttrsReqCb = sinon.spy() // (clientId, reqObj, callback)

        qnode.writeAttrsReq('0/1/x1', { pmin: 11, pmax: 66, gt: 100, lt: 10, stp: 99 }).then(writeAttrsReqCb).done(function () {
          expect(writeAttrsReqCb).should.have.been.calledOnce // eslint-disable-line
          expect(writeAttrsReqCb).to.be.calledWith({ status: 200 })
          done()
        })

        // fake rx
        emitMcRawMessage(shepherd, 'response/test01', {
          transId: shepherd._currentTransId(),
          cmdId: 'writeAttrs',
          oid: 0,
          iid: 1,
          rid: 'x1',
          status: 200,
          data: null
        })
      })

      it('should send writeAttrsReq properly - instance', function (done) {
        var qnode = shepherd.find('test01') // { '0': [ 1, 2, 3 ], '1': [ 4, 5, 6 ] } }
        var writeAttrsReqCb = sinon.spy() // (clientId, reqObj, callback)

        qnode.writeAttrsReq('0/1', { pmin: 11, pmax: 66, gt: 100, lt: 10, stp: 99 }).then(writeAttrsReqCb).done(function () {
          expect(writeAttrsReqCb).should.have.been.calledOnce // eslint-disable-line
          expect(writeAttrsReqCb).to.be.calledWith({ status: 200 })
          done()
        })

        // fake rx
        emitMcRawMessage(shepherd, 'response/test01', {
          transId: shepherd._currentTransId(),
          cmdId: 'writeAttrs',
          oid: 0,
          iid: 1,
          status: 200,
          data: null
        })
      })
    })

    describe('#qnode.executeReq', function () {
      it('should send executeReq properly - resource', function (done) {
        var qnode = shepherd.find('test01') // { '0': [ 1, 2, 3 ], '1': [ 4, 5, 6 ] } }
        var execReqCb = sinon.spy() // (clientId, reqObj, callback)

        qnode.executeReq('0/1/x1', []).then(execReqCb).done(function () {
          expect(execReqCb).should.have.been.calledOnce // eslint-disable-line
          expect(execReqCb).to.be.calledWith({ status: 204, data: 'foo_result' })
          done()
        })

        // fake rx
        emitMcRawMessage(shepherd, 'response/test01', {
          transId: shepherd._currentTransId(),
          cmdId: 'execute',
          oid: 0,
          iid: 1,
          rid: 'x1',
          status: 204,
          data: 'foo_result'
        })
      })
    })

    describe('#qnode.observeReq', function () {
      it('should send observeReq properly - resource', function (done) {
        var qnode = shepherd.find('test01') // { '0': [ 1, 2, 3 ], '1': [ 4, 5, 6 ] } }
        var obsvReqCb = sinon.spy() // (clientId, reqObj, callback)

        qnode.observeReq('0/1/x1').then(obsvReqCb).done(function () {
          expect(obsvReqCb).should.have.been.calledOnce // eslint-disable-line
          expect(obsvReqCb).to.be.calledWith({ status: 205 })
          done()
        })

        // fake rx
        emitMcRawMessage(shepherd, 'response/test01', {
          transId: shepherd._currentTransId(),
          cmdId: 'observe',
          oid: 0,
          iid: 1,
          rid: 'x1',
          status: 205
        })
      })
    })

    describe('#qnode.discoverReq', function () {
      it('should send discoverReq properly - resource', function (done) {
        var qnode = shepherd.find('test01') // { '0': [ 1, 2, 3 ], '1': [ 4, 5, 6 ] } }
        var dscvReqCb = sinon.spy() // (clientId, reqObj, callback)

        qnode.discoverReq('0/1/x1').then(dscvReqCb).done(function () {
          expect(dscvReqCb).should.have.been.calledOnce // eslint-disable-line
          expect(dscvReqCb).to.be.calledWith({ status: 205, data: { pmin: 2, pmax: 10 } })
          done()
        })

        // fake rx
        emitMcRawMessage(shepherd, 'response/test01', {
          transId: shepherd._currentTransId(),
          cmdId: 'discover',
          oid: 0,
          iid: 1,
          rid: 'x1',
          status: 205,
          data: { pmin: 2, pmax: 10 }
        })
      })

      it('should send discoverReq properly - instance', function (done) {
        var qnode = shepherd.find('test01') // { '0': [ 1, 2, 3 ], '1': [ 4, 5, 6 ] } }
        var dscvReqCb = sinon.spy() // (clientId, reqObj, callback)

        qnode.discoverReq('0/1').then(dscvReqCb).done(function () {
          expect(dscvReqCb).should.have.been.calledOnce // eslint-disable-line
          expect(dscvReqCb).to.be.calledWith({ status: 205, data: { pmin: 21, pmax: 110 } })
          done()
        })

        // fake rx
        emitMcRawMessage(shepherd, 'response/test01', {
          transId: shepherd._currentTransId(),
          cmdId: 'discover',
          oid: 0,
          iid: 1,
          status: 205,
          data: { pmin: 21, pmax: 110 }
        })
      })

      it('should send discoverReq properly - object', function (done) {
        var qnode = shepherd.find('test01') // { '0': [ 1, 2, 3 ], '1': [ 4, 5, 6 ] } }
        var dscvReqCb = sinon.spy() // (clientId, reqObj, callback)

        qnode.discoverReq('0').then(dscvReqCb).done(function () {
          expect(dscvReqCb).should.have.been.calledOnce // eslint-disable-line
          expect(dscvReqCb).to.be.calledWith({ status: 205,
            data: {
              pmin: 2,
              pmax: 20,
              resrcList: {
                '0': [ 1, 2, 3 ],
                '1': [ 4, 5, 6 ]
              }
            }
          })
          done()
        })

        // fake rx
        emitMcRawMessage(shepherd, 'response/test01', {
          transId: shepherd._currentTransId(),
          cmdId: 'discover',
          oid: 0,
          iid: 1,
          status: 205,
          data: {
            pmin: 2,
            pmax: 20,
            resrcList: {
              '0': [ 1, 2, 3 ],
              '1': [ 4, 5, 6 ]
            }
          }
        })
      })
    })

    describe('#qnode.identifyReq', function () {
      it('should identify successfully', function (done) {
        var qnode = shepherd.find('test01') // { '0': [ 1, 2, 3 ], '1': [ 4, 5, 6 ] } }
        // var identifyReqCb = sinon.spy() // (clientId, reqObj, callback)
        qnode.identifyReq().then(function (rsp) {
          if (rsp.status === 200) { done() }
        }).done()

        // fake rx
        emitMcRawMessage(shepherd, 'response/test01', {
          transId: shepherd._currentTransId(),
          cmdId: 'identify',
          status: 200
        })
      })
    })

    describe('#qnode.pingReq', function () {
      it('should ping successfully', function (done) {
        var qnode = shepherd.find('test01') // { '0': [ 1, 2, 3 ], '1': [ 4, 5, 6 ] } }
        // var pingReqCb = sinon.spy() // (clientId, reqObj, callback)
        qnode.pingReq().then(function (rsp) {
          if (rsp.status === 200) { done() }
        }).done()

        // fake rx
        emitMcRawMessage(shepherd, 'response/test01', {
          transId: shepherd._currentTransId(),
          cmdId: 'ping',
          status: 200
        })
      })
    })

    describe('#qnode.quickPingReq', function () {
      it('should quick ping successfully', function (done) {
        var qnode = shepherd.find('test01') // { '0': [ 1, 2, 3 ], '1': [ 4, 5, 6 ] } }
        // var pingReqCb = sinon.spy() // (clientId, reqObj, callback)
        qnode.pingReq().then(function (rsp) {
          if (rsp.status === 200) { done() }
        }).done()

        // fake rx
        emitMcRawMessage(shepherd, 'response/test01', {
          transId: shepherd._currentTransId(),
          cmdId: 'ping',
          status: 200
        })
      })
    })

    describe('#qnode.dump', function () {
      it('should dump correct data', function () {
        var qnode = shepherd.find('test01') // { '0': [ 1, 2, 3 ], '1': [ 4, 5, 6 ] } }
        var dumped = qnode.dump()
        delete dumped.joinTime
        expect(dumped).to.be.deep.equal({
          clientId: 'test01',
          so: {
            lwm2mSecurity: {
              '1': { x1: 'new_x1_value2' }, // now don't send readReq again, if writeReq has data back
              '2': { x2: 'sis' },
              '3': { x3: 'dad' }
            },
            lwm2mServer: {
              '4': { x4: 'hi' },
              '5': { x5: 'hello' },
              '6': { x6: 'hey' }
            }
          },
          lifetime: 123456,
          ip: '127.0.0.2',
          mac: 'foo:mac',
          version: '0.0.1',
          objList: {
            '0': [ 1, 2, 3 ],
            '1': [ 4, 5, 6 ]
          }
        })
      })
    })

    describe('#register 2nd new qnode: test list, find, findByMac', function () {
      it('should fire registered and get a new qnode', function (done) {
        var _responseSenderSpy = sinon.spy(shepherd, '_responseSender')
        var _clientObjectDetailReqStub = sinon.stub(msgHdlr, '_clientObjectDetailReq', function (shp, cId, objList) {
          return Q.resolve([
            { oid: 0, data: { 1: { x1: 'hi' }, 2: { x2: 'hello' }, 3: { x3: 'hey' }, 4: { x4: 'yap' }, 5: { x5: { x51: 'yo ' } } } },
            { oid: 1, data: { 41: { x41: 'hi' }, 51: { x51: 'hello' }, 61: { x61: 'hey' } } }
          ])
        })

        shepherd.on('_registered', function (qnode) {
          _clientObjectDetailReqStub.restore()
          _responseSenderSpy.restore()
          expect(_responseSenderSpy).to.have.been.calledWith('register', 'test02')
          if (shepherd.find('test02') === qnode && shepherd.findByMac('foo:mac:bar')[0] === qnode) { done() }
        })

        emitMcRawMessage(shepherd, 'register/test02', {
          transId: 100,
          ip: '127.0.0.3',
          mac: 'foo:mac:bar',
          lifetime: 123456,
          version: '0.0.2',
          objList: {
            0: [ 1, 2, 3, 4, 5 ],
            1: [ 41, 51, 61 ]
          }
        })
      })

      it('should list 2 qnodes', function () {
        var devList = shepherd.list()
        expect(shepherd.info().devNum).to.be.equal(2)
        expect(devList.length).to.be.equal(2)
        expect(devList[0].clientId).to.be.equal('test01')
        expect(devList[0].mac).to.be.equal('foo:mac')

        expect(devList[1].clientId).to.be.equal('test02')
        expect(devList[1].mac).to.be.equal('foo:mac:bar')
      })

      it('should find test01', function () {
        var test01 = shepherd.find('test01')
        expect(test01.clientId).to.be.equal('test01')
      })

      it('should find test02', function () {
        var test02 = shepherd.find('test02')
        expect(test02.clientId).to.be.equal('test02')
      })

      it('should findByMac test01', function () {
        var test01 = shepherd.findByMac('foo:mac')[0]
        expect(test01.clientId).to.be.equal('test01')
      })

      it('should findByMac test02', function () {
        var test02 = shepherd.findByMac('foo:mac:bar')[0]
        expect(test02.clientId).to.be.equal('test02')
      })
    })

    describe('#.remove', function () {
      it('should remove test01', function (done) {
        shepherd.remove('test01', function () {
          if (_.isUndefined(shepherd.find('test01')) && shepherd.list().length === 1) { done() }
        })
      })
    })

    describe('#register 3nd new qnode: test acceptDevIncoming', function () {
      this.timeout(60000)

      it('should fire registered and get a new qnode', function (done) {
        var _responseSenderSpy = sinon.spy(shepherd, '_responseSender')
        var _acceptDevIncomingStub = sinon.stub(shepherd, 'acceptDevIncoming', function (qnode, cb) {
          setTimeout(function () {
            var accepted = true
            cb(null, accepted)
          }, 6000)
        })
        var _clientObjectDetailReqStub = sinon.stub(msgHdlr, '_clientObjectDetailReq', function (shp, cId, objList) {
          return Q.resolve([
            { oid: 0, data: { 1: { x1: 'hi' }, 2: { x2: 'hello' }, 3: { x3: 'hey' }, 4: { x4: 'yap' }, 5: { x5: { x51: 'yo ' } } } },
            { oid: 1, data: { 41: { x41: 'hi' }, 51: { x51: 'hello' }, 61: { x61: 'hey' } } }
          ])
        })

        shepherd.on('_registered', function (qnode) {
          _clientObjectDetailReqStub.restore()
          _acceptDevIncomingStub.restore()
          _responseSenderSpy.restore()
          expect(_responseSenderSpy).to.have.been.calledWith('register', 'test03')
          if (shepherd.find('test03') === qnode && shepherd.findByMac('foo:mac:bar:xyz')[0] === qnode) { done() }
        })

        emitMcRawMessage(shepherd, 'register/test03', {
          transId: 100,
          ip: '127.0.0.4',
          mac: 'foo:mac:bar:xyz',
          lifetime: 123456,
          version: '0.0.2',
          objList: {
            0: [ 1, 2, 3, 4, 5 ],
            1: [ 41, 51, 61 ]
          }
        })
      })
    })

    describe('#.reset', function () {
      this.timeout(20000)
      it('should reset - soft', function (done) {
        shepherd.once('ready', function () {
          setTimeout(function () {
            done()
          }, 1000)
        })
        shepherd.reset(false).done()
      })

      it('should reset - hard', function (done) {
        shepherd.once('ready', function () {
          setTimeout(function () {
            done()
          }, 1000)
        })
        shepherd.reset(true).done()
      })
    })

    describe('#.stop', function () {
      it('should stop ok, permitJoin 0 should be fired, _enabled should be false', function (done) {
        var joinFired = false

        var stopCalled = false

        shepherd.once('permitJoining', function (joinTime) {
          joinFired = true
          if (joinTime === 0 && !shepherd._enabled && !shepherd.mClient && stopCalled && joinFired) { done() }
        })

        shepherd.stop(function (err, result) {
          stopCalled = true
          if (!err && !shepherd._enabled && !shepherd.mClient && stopCalled && joinFired) {
            done()
          }
        })
      })
    })
  })
})

function emitMcRawMessage (shepherd, intf, msg) {
  var mc = shepherd.mClient

  if (!_.isString(msg)) { msg = JSON.stringify(msg) }

  msg = Buffer.from(msg)

  mc.emit('message', intf, msg)
};
