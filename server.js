var util = require('util'),
    moment = require('moment'),
    Shepherd = require('./index');

var shepherd = new Shepherd('my_shepherd');
var preUnix = null,
    nowUnix = null;

function runtest(cb, delay, rp) {
    setTimeout(function () {
        if (rp === undefined)
            cb();
        else
            setInterval(cb, rp);
    }, delay);
}

shepherd.start(function (err, res) {
    if (err) console.log(err);
});

shepherd.on('ready', function () {
    console.log('shepherd ready');
    //console.log(shepherd);
});

shepherd.on('updated', function (diff) {
    console.log(diff);
});

shepherd.on('error', function (err) {
    console.log(err);
});

var t = 0;
shepherd.on('notify_update', function (msg) {
    // preUnix = nowUnix;
    // nowUnix = moment().unix();

    // t++;
    // if (t > 5) {
    //     shepherd._responseSender('notify', msg.clientId, { transId: msg.transId, status: 204, cancel: true });
    //     t = 0;
    // }

    // var tdf = nowUnix - preUnix;
    // tdf  = tdf > 10000 ? 0 : tdf;
    console.log('>>>>>>>>>> NOTIFIED');
    // console.log(tdf);
    console.log(msg);

});

// shepherd.on('notify', function (msg) {
//     console.log('>>>>>>>>>> NOTIFY');
//     console.log(msg);

// });

shepherd.on('registered', function (node) {
    console.log('REGISTERED');
    console.log(node.clientId);
    console.log(node.status);

    // read test - resource
    // runtest(function () {
    //     node.readReq('/tempSensor/0/sensorValue', function (err, rsp) {
    //         console.log('>>>>> read test');
    //         console.log(rsp);
    //     });
    // }, 5000, 2000);

    // // read test - bad resource
    // runtest(function () {
    //     node.readReq('/3303/0/sensorValue', function (err, rsp) {
    //         console.log('>>>>> read test');
    //         console.log(rsp);
    //     });
    // }, 5000, 2000);

    // // read test - not allowed resource
    // runtest(function () {
    //     node.readReq('/3303/0/some1', function (err, rsp) {
    //         console.log('>>>>> read not allowed test: some1');
    //         console.log(rsp);
    //     });
    //     node.readReq('/3303/0/some2', function (err, rsp) {
    //         console.log('>>>>> read not allowed test: some2');
    //         console.log(rsp);
    //     });
    // }, 5000, 2000);

    // // read test - instance
    // runtest(function () {
    //     node.readReq('/3303/0/', function (err, rsp) {
    //         console.log('>>>>> read instance test');
    //         console.log(rsp);
    //     });
    // }, 5000, 2000);

    // // read test - object
    // runtest(function () {
    //     node.readReq('/3303', function (err, rsp) {
    //         console.log('>>>>> read object test');
    //         console.log(rsp);
    //     });
    // }, 5000, 2000);

    // // read test - root
    // runtest(function () {
    //     node.readReq('/', function (err, rsp) {
    //         console.log('>>>>> read root test');
    //         console.log(rsp);
    //     });
    // }, 5000, 2000);

    // // exec test - resource
    // runtest(function () {
    //     node.executeReq('/3303/0/some1', 'simen', function (err, rsp) {
    //         console.log('>>>>> exec resource test');
    //         console.log(rsp);
    //     });
    // }, 5000, 2000);

    // // exec test - resource not found
    // runtest(function () {
    //     node.executeReq('/3303/0/somex', 'simen', function (err, rsp) {
    //         console.log('>>>>> exec resource test');
    //         console.log(rsp);
    //     });
    // }, 5000, 2000);

    // // exec test - resource not allowed
    // runtest(function () {
    //     node.executeReq('/3303/0/some2', 'simen', function (err, rsp) {
    //         console.log('>>>>> exec resource test');
    //         console.log(rsp);
    //     });
    // }, 5000, 2000);

    // // exec test - instance not allowed
    // runtest(function () {
    //     node.executeReq('/3303/0/', 'simen', function (err, rsp) {
    //         console.log('>>>>> exec instance test');
    //         console.log(rsp);
    //     });
    // }, 5000, 2000);

    // // exec test - object not allowed
    // runtest(function () {
    //     node.executeReq('/3303/', 'simen', function (err, rsp) {
    //         console.log('>>>>> exec object test');
    //         console.log(rsp);
    //     });
    // }, 5000, 2000);

    // // write test - resource
    // runtest(function () {
    //     node.writeReq('/3303/0/sensorValue', 60, function (err, rsp) {
    //         console.log('>>>>> write resource test');
    //         console.log(rsp);
    //     });
    //     node.readReq('/3303/0/sensorValue', function (err, rsp) {
    //         console.log('>>>>> read resource test');
    //         console.log(rsp);
    //     });
    // }, 5000, 1000);

    // // write test
    // runtest(function () {
    //     node.writeReq('/3303/0/some2', 60, function (err, rsp) {
    //         console.log('>>>>> write resource test');
    //         console.log(rsp);
    //     });
    //     node.readReq('/3303/0/some2', function (err, rsp) {
    //         console.log('>>>>> read resource test');
    //         console.log(rsp);
    //     });
    // }, 5000, 1000);

    // // write test - write invlaid resource
    // runtest(function () {
    //     node.writeReq('/3303/0/x', 60, function (err, rsp) {
    //         console.log('>>>>> write resource test');
    //         console.log(rsp);
    //     });
    // }, 5000, 1000);

    // write test - write instance, object (not allowed)
    // runtest(function () {
    //     node.writeReq('/3303/', { x: 3 }, function (err, rsp) {
    //         console.log('>>>>> write resource test');
    //         console.log(err);
    //         console.log(rsp);
    //     });
    // }, 5000, 1000);

    // // write test - write resource with bad type
    // runtest(function () {
    //     node.writeReq('/3303/0/sensorValue', 30, function (err, rsp) {
    //         console.log('>>>>> write resource test');
    //         console.log(rsp);
    //     });
    // }, 5000, 1000);

    // // disover test
    // runtest(function () {
    //     node.discoverReq('/3', function (err, rsp) {
    //         console.log('>>>>> discover test');
    //         console.log(rsp.data.resrcList);
    //     });
    // }, 2000, 2000);


    // // write test - resource - access control
    // runtest(function () {
    //     node.writeReq('/3303/0/minMeaValue', 100, function (err, rsp) {
    //         console.log('>>>>> write resource test');
    //         console.log(rsp);
    //     });
    //     node.readReq('/3303/0/minMeaValue', function (err, rsp) {
    //         console.log('>>>>> read resource test');
    //         console.log(rsp);
    //     });
    // }, 5000, 1000);

    // writeAttrs test
    // runtest(function () {
    //     var attrs = {
    //         pmin: 50,
    //         pmax: 600,
    //         step: 10,
    //     };
    //     node.writeAttrsReq('/3303/0/sensorValue', attrs , function (err, rsp) {
    //         console.log('>>>>> writeAttrs test');
    //         console.log(rsp);
    //     });

    //     node.discoverReq('/3303/0/sensorValue', function (err, rsp) {
    //         console.log('>>>>> writeAttrs test:discover back');
    //         console.log(rsp);
    //     });

    // }, 2000, 2000);

    // // observe test
    // runtest(function () {
    //     var attrs = {
    //         pmin: 3,
    //         pmax: 6,
    //         // step: 10,
    //     };

    //     // node.discoverReq('/3303/0/sensorValue', function (err, rsp) {
    //     //     console.log('>>>>> discover');
    //     //     console.log(rsp);
    //     // });
    //     node.writeAttrsReq('/3303/0/', attrs , function (err, rsp) {
    //         console.log('>>>>> writeAttrs test');
    //         console.log(rsp);

    //         node.observeReq('/', function (err, rsp) {
    //             console.log('>>>>> observe test');
    //             console.log(err);
    //             console.log(rsp);
    //                     node.discoverReq('/3303/0/', function (err, rsp) {
    //                         console.log('>>>>> discover');
    //                         console.log(rsp);
    //                     });
    //         });
    //     });


    // }, 2000);

    // observe test - lt, gt, step rules
    runtest(function () {
        var attrs = {
            pmin: 1,
            pmax: 30,
            gt: 20,
            lt: 80,
            step: 20
        };

        node.writeAttrsReq('/3303/0/sensorValue', attrs , function (err, rsp) {
            console.log('>>>>> writeAttrs test');
            console.log(rsp);

            node.observeReq('/3303/0/sensorValue', function (err, rsp) {
                console.log('>>>>> observe test');
                console.log(err);
                console.log(rsp);
            });
        });


    }, 2000);

});