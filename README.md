mqtt-shepherd
========================

## Table of Contents

1. [Overiew](#Overiew)  
2. [Features](#Features)  
3. [Installation](#Installation)  
4. [Basic Usage](#Basic)  
5. [APIs and Events](#APIs)  
6. [Message Encryption](#Encryption)  
7. [Auth Policy](#Auth)  
8. [Example with websocket](#example)  

<a name="Overiew"></a>
## 1. Overview

The lightweight MQTT machine network ([**LWMQN**](https://simenkid.github.io/lwmqn)) is an architecture that follows part of [**LWM2M v1.0**](http://technical.openmobilealliance.org/Technical/technical-information/release-program/current-releases/oma-lightweightm2m-v1-0) specification to meet the minimum requirements of machine network management.  

This module, **mqtt-shepherd**, is an implementation of LWMQN Server which can run on platfroms equipped with node.js.  

LWMQN Client and Server benefits from the IPSO data model, which leads to a very comprehensive way for the Server to use a *path* with URI-style to allocate and query Resources on Client Devices. In the following example, both of these two requests is to read the sensed value from a temperature sensor on a Client Device.  
  
```js
qnode.readReq('temperature/0/sensorValue', function (err, rsp) {
    console.log(rsp); // { status: 205, data: 18 }
});

qnode.readReq('3304/0/5700', function (err, rsp) {
    console.log(rsp); // { status: 205, data: 18 }
});
```
  
The goal of **mqtt-shepherd** is to let you build and manage an MQTT machine network with less efforts, it is implemented as a server-side application framework with many network management functions, e.g. permission of device joining, device authentication, reading, writing and observing resources on a remote device, remotely executing a procedure on the Device. Furthermore, thanks to the power of node.js, making your own RESTful APIs to interact with your machines is also possible.  
  
Note: This project is planning to provide a web-client library for front-end users in the near future.  

#### Acronym
* **Server**: LWMQN Server
* **Client** or **Client Device**: LWMQN Client 
* **MqttShepherd**: class exposed by `require('mqtt-shepherd')`  
* **MqttNode**: class to create a software endpoint of a remote Client Device on the Server
* **qserver**: instance of MqttShepherd
* **qnode**: instance of MqttNode  
* **oid**: identifier of an Object  
* **iid**: identifier of an Object Instance  
* **rid**: indetifier of a Resource  

Note: IPSO uses _Object_, _Object Instance_ and _Resource_ to describe the hierarchical structure of resources on a Client Device. The Server can use oid, iid and rid to allocate resources on a Client Device.  

<a name="Features"></a>
## 2. Features

* MQTT protocol
* Based on [Mosca](https://github.com/mcollina/mosca/wiki) which is an MQTT broker on node.js.  
* Hierarchical data model in Smart-Object-style (IPSO)  
* Easy to query resources on a Client Device  
* LWM2M-like interfaces for Client/Server interaction  
* Simple machine network managment  
  
<a name="Installation"></a>
## 3. Installation

> $ npm install mqtt-shepherd --save
  
<a name="Basic"></a>
## 4. Basic Usage

Server-side example:  

```js
var MqttShepherd = require('mqtt-shepherd');
var qserver = new MqttShepherd();

qserver.on('ready', function () {
    console.log('Server is ready.');
    qserver.permitJoin(180);    // open for devices to join the network within 180 secs
});

qserver.start(function (err) {  // start the sever
    if (err)
        console.log(err);
});

// That's all to start a LWMQN Server.
// Now the Server is going to auotmatically tackle most of the network managing things.
```
  
<a name="APIs"></a>
## 5. APIs
  
This moudle provides you with two classes of MqttShepherd and MqttNode. The MqttShepherd class brings you a LWMQN Server with network managing facilities, i.e., start/stop the Server, permit device joining, find an joined node. This document uses `qserver` to denote the instance of this Server class. The MqttNode is the class for creating a software endpoint which represents the remote Client Device at server-side. This document uses `qnode` to denote the instance of this Client class. You can invoke methods on a `qnode` to operate the remote Device.  

* MqttShepherd APIs
    * [(ok) new MqttShepherd()](#API_MqttShepherd)
    * [(ok) start()](#API_start)
    * [(ok) stop()](#API_stop)
    * [(ok) permitJoin()](#API_permitJoin)
    * [(ok) info()](#API_info)
    * [(ok) listDevices()](#API_listDevices)
    * [(ok) find()](#API_find)    
    * [(return?) remove()](#API_remove)
    * [(OK) announce()](#API_announce) 
    * [(OK) maintain()](#API_maintain)
    * Events: [ready](#), [error](#), [ind](#), and [message](#)  
<br />  

* MqttNode APIs (`qnode` denotes the instance of this class)
    * [(ok) qnode.read()](#API_readReq)
    * [(OK) qnode.write()](#API_writeReq)
    * [(OK) qnode.writeAttrs()](#API_writeAttrsReq)
    * [(resrcList) qnode.discover()](#API_discoverReq)
    * [(ok) qnode.execute()](#API_executeReq)
    * [(ok) qnode.observe()](#API_observeReq) 
    * [(join time)qnode.dump()](#API_dump)
    
*************************************************

## MqttShepherd Class
Exposed by `require('mqtt-shepherd')`  
  
<a name="API_MqttShepherd"></a>
### new MqttShepherd([name][, settings])
Create a new instance of the `MqttShepherd` class.  
  
**Arguments:**  

1. `name` (_String_): Name your server. A default name `'mqtt_shepherd'` will be used if not given.
2. `settings` (_Object_): Settings for the Mosca MQTT broker. If not given, the default settings will be applied, e.g.port 1883 for the broker, LevelUp for presistence. You can set up your backend, like mongoDB, Redis, Mosquitto or RabbitMQ, through this option. Please refer to the [Mosca wiki page](https://github.com/mcollina/mosca/wiki/Mosca-advanced-usage) for details.  

    
**Returns:**  
  
* (_Object_): qserver, an instance of MqttShepherd

**Examples:**  

* Create a server and name it

```js
var MqttShepherd = require('mqtt-shepherd');
var qserver= new MqttShepherd('my_iot_server');
```

* Create a server that starts on a specified port

```js
var qserver= new MqttShepherd('my_iot_server', {
    port: 9000
});
```

* Create a server with other backend (example from Mosca wiki)

```js
var qserver= new MqttShepherd('my_iot_server', {
    port: 1883,
    backend: {
        type: 'mongo',        
        url: 'mongodb://localhost:27017/mqtt',
        pubsubCollection: 'ascoltatori',
        mongo: {}
    }
});
```

*************************************************
<a name="API_start"></a>
### .start([callback])
Start the qserver.  

**Arguments:**  

1. `callback` (_Function_): Get called after the initializing procedure is done.  

  
**Returns:**  
  
* (_Object_): qserver

**Examples:**  
    
```js
qserver.start(function () {
    console.log('server initialized.');
});
```
*************************************************
<a name="API_stop"></a>
### .stop([callback])
Stop the qserver.  

**Arguments:**  

1. `callback` (_Function_): Get called after the server closed.  

  
**Returns:**  
  
* (_Object_): qserver

**Examples:**  
    
```js
qserver.stop(function () {
    console.log('server stopped.');
});
```
*************************************************
<a name="API_permitJoin"></a>
### .permitJoin(time)
Open for devices to join the network.  

**Arguments:**  

1. `time` (_Number_): Interval in seconds for qsever openning for devices to join the network. Set `time` to `0` can immediately close the admission.  

  
**Returns:**  
  
* (_Object_): qserver

**Examples:**  
    
```js
qserver.permitJoin(180); // permit devices to join for 180 seconds 
```

*************************************************
<a name="API_info"></a>
### .info()
Returns the qserver infomation.

**Arguments:**  

1. none  

  
**Returns:**  
  
* (_Object_): An object that contains the information about the Server. The fields in this object are shown in the following table.

| Property     | Type    | Description                                   |
|--------------|---------|-----------------------------------------------|
| `name`       | String  | Name of the server                            |
| `ip`         | String  | Ip address of the server                      |
| `mac`        | String  | Mac address                                   |
| `routerIp`   | String  | Router IP address                             |
| `manuf`      | String  | Manufacturer name                             |
| `devNum`     | Number  | Number of devices joined the network          |
| `status`     | String  | `online`, `offline`                           |
| `permitJoin` | Boolean | Indicates if the Server is opened for joining |
| `startTime`  | Number  | Unix Time (secs)                              |

**Examples:**  
    
```js
console.log(qserver.info());

{
    name: 'my_iot_server',
    ip: '192.168.1.99',
    mac: '00:0c:29:6b:fe:e7',
    routerIp: '192.168.1.1',
    manuf: 'sivann',
    devNum: 36,
    status: 'online',
    permitJoin: false,
    startTime: 1454419506
}  
```

*************************************************
<a name="API_listDevices"></a>
### .listDevices([clientIds])
List all records of the registered Client Devices.  

**Arguments:**  

1. `clientIds` (_Array_): It is an array of client ids to query. All device records will be returned if `clientIds` is not given.

  
**Returns:**  
  
* (_Array_): Information of all the Client Devices. Each record in the array is an object with the properties shown in the following table. The entry in the array will be `undefined` if that Client Device is not found. 

| Property     | Type    | Description                          |
|--------------|---------|--------------------------------------|
| `clientId`   | String  | Client id of the device              |
| `ip`         | String  | Ip address of the server             |
| `mac`        | String  | Mac address                          |
| `status`     | String  | `online`, `offline`                  |
| `lifetime`   | Number  | Lifetime of the device               |
| `version`    | String  | LWMQN version                        |
| `joinTime`   | Number  | Unix Time (secs)                     |
| `objList`    | Object  | IPSO Objects and Object Instances. Each key in `objList` is the `oid` and each value is an array of `iid` under that `oid`.     |


**Examples:**  
    
```js
console.log(qserver.listDevices([ 'foo_id', 'bar_id', 'no_such_id' ]));
[
    {
        clientId: 'foo_id',
        ip: 'xxx',
        mac: 'xxx',
        status: 'online',
        lifetime: 12345,
        version: '',
        joinTime: xxxx,
        objList: {
            3: [ 1, 2, 3 ],
            2205: [ 7, 5503 ]
        }
    },
    {
        clientId: 'bar_id',
        ip: 'xxx',
        mac: 'xxx',
        status: 'online',
        lifetime: 12345,
        version: '',
        joinTime: xxxx,
        objList: {
            3: [ 1, 2, 3 ],
            2205: [ 7, 5503 ]
        }
    },
    undefined
]
```

*************************************************
<a name="API_find"></a>
### .find(clientId)
Find the Client Device (qnode) in the qserver.

**Arguments:**  

1. `clientId` (_String_): Client id of the device to find.   

  
**Returns:**  
  
* (_Object_): qnode. Returns `undefined` if not found.

**Examples:**  
    
```js
var qnode = qserver.find('foo_id');

if (qnode) {
    // do what you wanna do upon the qnode, like qnode.read()
}
```

*************************************************
<a name="API_remove"></a>
### .remove(clientId[, callback])
Deregister and remove the Client Device (qnode) from the server.

** Must know remove is successful or not? callback?

**Arguments:**  

1. `clientId` (_String_):  
2. `callback` (_Function_): `function (err, clientId) { ... }`

  
**Returns:**  
  
* (_Object_): qserver

**Examples:**  
    
```js
qserver.remove('foo', function (err, clientId) {
    console.log(clientId);
    // undefined if something went wrong
});
```

*************************************************
<a name="API_announce"></a>
### .announce(msg[, callback])
The Server can use this method to announce messages.

**Arguments:**  

1. `msg` (_String_ | _Buffer_): The message to announce.
2. `callback` (_Function_): `function (err) { ... }`. Get called after message announced.
  
**Returns:**  
  
* (_Object_): qserver

**Examples:**  
    
```js
qserver.announce('Rock on!');
```

*************************************************
<a name="API_maintain"></a>
### .maintain([clientIds,][callback])
Maintains the network. This will refresh all Client Device records on qserver by rediscovering the required information from every remote device. Only the indicated Client Device records will be refresh if calling with a given `clientIds`. 

**Arguments:**  

1. `clientIds` (_Array_): Client id of the devices to be refreshed. 
2. `callback` (_Function_): `function (err, clientIds) { ... }`. Get called after the maintenance finished. The `clientIds` is an array indicates the Client Devices that are successfully refreshed. The entry will be `undefined` for a Client Device if there were something going wrong, e.g. Device not found.  

  
**Returns:**  
  
* (_Object_): qserver

**Examples:**  
    
```js
qserver.maintain(function (err, clientIds) {
    console.log(clientIds);
    // [ 'foo', 'bar', undefined, 'oof', 'rab', ... ]
});

server.maintain([ 'foo_id', 'no_such_id' ], function (err, clientIds) {
    console.log(clientIds);
    // [ 'foo_id',  undefined ]
});
```

*************************************************
### Event: 'ready'
`function () { }`
Fired when the Server is ready.

*************************************************
### Event: 'error'
`function (err) { }`
Fired when there is an error occurred.

*************************************************
### Event: 'ind'
`function (type, msg) { }`
Fired when there is an incoming indication message. There are 5 kinds of indication `type` including `devIncoming`, `devLeaving`, `devUpdate`, `devNotify` and `devChange`.

* ##### devIncoming    
    When there is a Client Device incoming to the network, qserver will fire an `'ind'` event along with this `type`. The Client Device can be a new registered one or an old Device signing in.

    * type: `'devIncoming'`
    * msg (_Object_): a qnode
<br />

* ##### devLeaving  
    When there is a Client Device leaving the network, qserver will fire an `'ind'` event along with this `type`. 

    * type: `'devLeaving'`
    * msg (_String_): the clientId of which Device is leaving
<br />

* ##### 'devUpdate'
    When there is a Client Device leaving the network, qserver will fire an `'ind'` event along with this `type`. 

    * type: `'devLeaving'`
    * msg (_Object_): the updated device attributes, there may be fields of `status`, `lifetime`, `ip`, `version` in this object.
<br />

        ```js
        // example
        {
            status: 'online',
            ip: '192.168.0.36'
        }
        ```

* ##### 'devNotify'
    msg (_Object_): the notification from the Client Device. This object has fileds of `oid`, `iid`, `rid`, and `data`.  
    If `rid` is _`null`_ or _`undefined`_, the `data` is an Object Instance.
    If `rid` is valid, the `data` is an Resource and the data type depends on the Resource. 

        ```js
        // example of a Resource notification
        {
            oid: 'humidity',
            iid: 0,
            rid: 'sensorValue',
            data: 32
        }

        // example of an Object Instance notification
        {
            oid: 'humidity',
            iid: 0,
            data: {
                sensorValue: 32
            }
        }
        ```

* ##### 'devChange'
    msg (_Object_): the changes of a Resource or an Object Instance on the Client Device. This object has fileds of `oid`, `iid`, `rid`, and `data`.  
    If `rid` is _`null`_ or _`undefined`_, the `data` is an object that contains only the properties changed in an Object Instance. This can be thought of multi-Resource changes. 
    If `rid` is valid, the `data` is the new value of a Resource. If a Resource itself is an object, then `data` will be an object that contains only the properties changed in that Resource.

    The diffrence between `'devChange'` and `'devNotify'` is that the message of `'devNotify'` is the data whatever a Client Device like to notify even if there are no changes of it. A periodical notification is a good example, the Client Device has to report something under observation even there are no changes of that thing. If there is really something changed, the Server will then fire `'devChange'` to report it.

        ```js
        // changes of an Object Instance
        {
            oid: 'temperature',
            iid: 0,
            data: {
                sensorValue: 12,
                minMeaValue: 12
            }
        }

        // change of a Resource 
        {
            oid: 'temperature',
            iid: 1,
            rid: 'sensorValue',
            data: 18
        }
        ```

*************************************************
### Event: 'message'
`function(topic, message, packet) {}`
Emitted when the Server receives a published packet from all channels

1. `topic` (_String_): topic of the received packet
2. `message` (_Buffer_): payload of the received packet
3. `packet` (_Object_): the received packet, as defined in [mqtt-packet](#https://github.com/mqttjs/mqtt-packet#publish)


***********************************************
<br />

## MqttNode Class
A registered Client Device is an instance of this class. Such an instance is denoted as `qnode` in this document. This class provides you with methods to perform remote operations upon a Client Device.

<a name="API_readReq"></a>
### qnode.readReq(path, callback)
Remotely read the target. The response will pass through the callback.

**Arguments:**  

1. `path` (_String_): the path of the allocated Object, Object Instance or Resource on the remote Client Device.
2. `callback` (_Function_): `function (err, rsp) { }`
    `err` (_Object_): error object
    `rsp` (_Object_): The response is an object that has the status code along with the returned data from the remote Client Device.  

| Property | Type    | Description                                                             |
|----------|---------|-------------------------------------------------------------------------|
| `status` | Number  | Status code of the response. See [Status Code](#).                      |
| `data`   | Depends | `data` can be the value of an Object, an Object Instance or a Resource. Note that when an unreadable Resource is read, the returned value will be a string '\_unreadble\_'.|
  

**Returns:**  
  
* _none_

**Examples:**  
    
```js
qnode.readReq('temperature/1/sensedValue', function (err, rsp) {
    console.log(rsp);   // { status: 205, data: 87 }
});

// Target not found
qnode.readReq('/noSuchObject/0/foo', function (err, rsp) {
    console.log(rsp);   // { status: 404, data: undefined }
});

qnode.readReq('/temperature/0/noSuchResource/', function (err, rsp) {
    console.log(rsp);   // { status: 404, data: undefined }
});
```

***********************************************
<a name="API_writeReq"></a>
### qnode.writeReq(path, data[, callback])
Remotely write a value to the allocated Resource on the Client Device. The response will pass through the callback.

**Arguments:**  

1. `path` (_String_): Path of the allocated Resource on the remote Client Device.
2. `data` (_Depends_): The value to write to the Resource.
3. `callback` (_Function_): `function (err, rsp) { }`
    `err` (_Object_): error object
    `rsp` (_Object_): The response is an object that has the status code along with the written data from the remote Client Device.    
    | Property | Type    | Description                                                             |
    |----------|---------|-------------------------------------------------------------------------|
    | `status` | Number  | Status code of the response. See [Status Code](#).                      |
    | `data`   | Depends | `data` is the written value. It will be a string '\_unwritable\_' if the Resource is not allowed for writing.|

**Returns:**  
  
* _none_

**Examples:**  
    
```js
// write successfully
qnode.writeReq('digitalOutput/0/appType', 'lightning', function (err, rsp) {
    console.log(rsp);   // { status: 204, data: 'lightning' }
});

qnode.writeReq('digitalOutput/0/dOutState', 0, function (err, rsp) {
    console.log(rsp);   // { status: 204, data: 0 }
});

// target not found
qnode.writeReq('temperature/0/noSuchResource', 1, function (err, rsp) {
    console.log(rsp);   // { status: 404, data: undefined }
});

// target is unwritable
qnode.writeReq('digitalInput/1/dInState', 1, function (err, rsp) {
    console.log(rsp);   // { status: 405, data: '_unwritable_' }
});
```

***********************************************
<a name="API_writeAttrsReq"></a>
### qnode.writeAttrsReq(path, attrs[, callback])
Configure the parameters of the report settings upon a Resource, an Object Instance or an Object. This method can also used to cancel the observation by assgin the `cancel` property with `true` to `attrs`. This API won't start the report of notifications. Use observe() if you want to turn on reporting.  

**Arguments:**  

1. `path` (_String_): Path of the allocated Resource, Object Instance or Object on the remote Client Device.  
2. `attrs` (_Object_): Parameters of report settings.  

    | Property | Type    | Mandatory | Description |
    |----------|---------|-----------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
    | pmin     | Number  | optional  | Minimum Period. Minimum time in seconds the Client Device should wait from the time when sending the last notification to the time when sending a new notification.                                     |
    | pmax     | Number  | optional  | Maximum Period. Maximum time in seconds the Client Device should wait from the time when sending the last notification to the time sending the next notification (regardless if the value has changed). |
    | gt       | Number  | optional  | Greater Than. The Client Device should notify its value when the value is greater than this setting. Only valid for the Resource typed as a number.                                                     |
    | lt       | Number  | optional  | Less Than. The Client Device should notify its value when the value is smaller than this setting. Only valid for the Resource typed as a number.                                                        |
    | step     | Number  | optional  | Step. The Client Device should notify its value when the change of the Resource value, since the last report happened, is greater than this setting.                                                    |
    | cancel   | Boolean | optional  | It is set to `true` for the Client Device to cancel observation on the indicated Resource or Object Instance.                                                                                           |

3. `callback` (_Function_):  `function (err, rsp) { }`
    `err` (_Object_): error object
    `rsp` (_Object_): The response is an object that has the status code to indicate whether the operation is successful.  

    | Property | Type    | Description                                                             |
    |----------|---------|-------------------------------------------------------------------------|
    | `status` | Number  | Status code of the response. See [Status Code](#).                      |

  
**Returns:**  
  
* (_none_)

**Examples:**  
    
```js
// set successfully
qnode.writeAttributes('temperature/0/sensedValue', {
    pmin: 10,
    pmax: 600,
    gt: 45
}, function (err, rsp) {
    console.log(rsp);   // { status: 200 }
});

// taget not found
qnode.writeAttributes('temperature/0/noSuchResource', {
    gt: 20
}, function (err, rsp) {
    console.log(rsp);   // { status: 404 }
});

// parameter cannot be recognized
qnode.writeAttributes('temperature/0/noSuchResource', {
    foo: 60
}, function (err, rsp) {
    console.log(rsp);   // { status: 400 }
});
```

***********************************************
<a name="API_discoverReq"></a>
### qnode.discoverReq(path, callback)
Discover report settings of a Resource or, an Object Instance or an Object on the Client Device.

**Arguments:**  

1. `path` (_String_):  Path of the allocated Resource, Object Instance or Object on the remote Client Device.
2. `callback` (_Function_):   `function (err, rsp) { }`
    `err` (_Object_): error object
    `rsp` (_Object_): The response is an object that has the status code along with the parameters of report settings.  

    | Property | Type    | Description                                                                                                                          |
    |----------|---------|--------------------------------------------------------------------------------------------------------------------------------------|
    | `status` | Number  | Status code of the response. See [Status Code](#).                                                                                   |
    | `data`   | Object  | The field `attrs` is the object contains the parameter. If the discoved target is an Object, there will be another field `resrcList` |
  

^^^^^^^^^^^^^

**Returns:**  
  
* (_none_)

**Examples:**  
    
```js
// discover a Resource successfully
qnode.discoverReq('temperature/0/sensedValue', function (err, rsp) {
    console.log(rsp);   // { status: 205, data: {
                        //                    attrs: { pmin: 10, pmax: 600, gt: 45 }
                        //                }
                        // }
});

// discover an Object successfully
qnode.discoverReq('temperature/', function (err, rsp) {
    console.log(rsp);   // { status: 205, data: {
                        //                    attrs: { pmin: 10, pmax: 600, gt: 45 },
                        //                    resrcList: {
                        //                        0: [ 1, 3, 88 ]
                        //                    }
                        //                }
                        // }
});
```

***********************************************
<a name="API_executeReq"></a>
### qnode.executeReq(path[, args][, callback])
Invoke an excutable Resource on the Client Device.

**Arguments:**  

1. `path` (_String_): Path of the allocated Resource on the remote Client Device.
2. `args` (_Array_): The arguments to the procedure.
3. `callback` (_Function_): `function (err, rsp) { }`
    `err` (_Object_): error object
    `rsp` (_Object_): The response is an object that has the status code to indicate whether the operation is successful. There will be a `data` field if the procedure does return something back. Regarding the `data`, it depends on the implementation at Client-side.  

    | Property | Type    | Description                                                             |
    |----------|---------|-------------------------------------------------------------------------|
    | `status` | Number  | Status code of the response. See [Status Code](#).                      |
    | `data`   | Object  | What will be returned depends on the Client-side implementation.        |

  
**Returns:**  
  
* (_none_)

**Examples:**  
    
```js
// assume there in an executable Resource with the singnatue
// function(t) { ... } to blink an LED t times.
qnode.execReq('led/0/blink', [ 10 ] ,function (err, rsp) {
    console.log(rsp);   // { status: 204 }
});

// assume there in an executable Resource with the singnatue
// function(edge, interval) { ... } to counts how many times the button 
// was triggered in `interval` seconds.
qnode.execReq('button/0/blink', [ 'falling', 20 ] ,function (err, rsp) {
    console.log(rsp);   // { status: 204, data: 71 }
});

// Something went wrong at Client-side
qnode.execReq('button/0/blink', [ 'falling', 20 ] ,function (err, rsp) {
    console.log(rsp);   // { status: 500 }
});

// arguments cannot be recognized, in this example, 'up' is an invalid parameter
qnode.execReq('button/0/blink', [ 'up', 20 ] ,function (err, rsp) {
    console.log(rsp);   // { status: 400 }
});

// Resource not found
qnode.execReq('temperature/0/noSuchResource', function (err, rsp) {
    console.log(rsp);   // { status: 404 }
});

// invoke an unexecutable Resource
qnode.execReq('temperature/0/sensedValue', function (err, rsp) {
    console.log(rsp);   // { status: 405 }
});
```

***********************************************
<a name="API_observeReq"></a>
### qnode.observeReq(path[, callback])
Start observing a Resource on the Client Device. 

**Arguments:**  

1. `path` (_String_): Path of the allocated Resource on the remote Client Device.
2. `callback` (_Function_): `function (err, rsp) { }`
    `err` (_Object_): error object
    `rsp` (_Object_): The response is an object that has the status code to indicate whether the operation is successful. 
    | Property | Type    | Description                                                             |
    |----------|---------|-------------------------------------------------------------------------|
    | `status` | Number  | Status code of the response. See [Status Code](#).                      |

  
**Returns:**  
  
* (_none_)

**Examples:**  
    
```js
// observation starts successfully
qnode.observeReq('temperature/0/sensedValue', function (err, rsp) {
    console.log(rsp);   // { status: 205 }
});

// An Object is not allowed for observation
qnode.observeReq('temperature/', function (err, rsp) {
    console.log(rsp);   // { status: 400 }
});

// target is not allowed for observation
qnode.observeReq('temperature/0', function (err, rsp) {
    console.log(rsp);   // { status: 405 }
});

// target not found
qnode.observeReq('temperature/0/noSuchResource', function (err, rsp) {
    console.log(rsp);   // { status: 404 }
});
```

***********************************************
<a name="API_dump"></a>
### qnode.dump([callback])
Dump the record of the Client Device.

**Arguments:**  

1. none  

  
**Returns:**  
  
* (_Object_): A data object of qnode record.

| Property     | Type    | Description                          |
|--------------|---------|--------------------------------------|
| `clientId`   | String  | Client id of the device              |
| `ip`         | String  | Ip address of the server             |
| `mac`        | String  | Mac address                          |
| `lifetime`   | Number  | Lifetime of the device               |
| `version`    | String  | LWMQN version                        |
| `joinTime`   | Number  | Unix Time (secs)                     |
| oid   | String \| Number  | Object Instances                  |


**Examples:**  
    
```js
console.log(qnode.dump());

{
    clientId: 'foo_id',
    ip: 'xxx',
    mac: 'xxx',
    lifetime: 12345,
    version: '',
    joinTime: xxxx,
    temperature: {
        0: {
            sensedValue: 18,
            appType: 'home'
        },
        1: {
            sensedValue: 37,
            appType: 'fireplace'
        }
    },
    humidity: {
        0: {
            sensedValue: 26,
            appType: 'home'
        }
    }
}
```

***********************************************
<br />

<a name="Encryption"></a>
## 6. Message Encryption
By default, the Sever won't encrypt the message. You can override the encrypt() and decrypt() methods to create your own encryption and decryption. You should implement the methods of encrypt() and decrypt() at the Client Device as well.


* [server.encrypt()](#method_encrypt)
* [sever.decrypt()](#method_decrypt)