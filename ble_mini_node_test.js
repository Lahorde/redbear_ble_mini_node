var BLEMini = require('./index.js');
var debug = require('debug')('ble_mini_node_test');
var async = require('async');

/************************************************
 * ble_mini_node_test.js
 * test ble mini node
 *************************************************/


/**************************************
 * Exit handlers
 ***************************************/

process.stdin.resume(); //so the program will not close instantly

function exitHandler(options, err) {
	if (options.cleanup) cleanBleMini();
	if (err) debug(err.stack);
	if (options.exit) process.exit();
}

//do something when app is closing
process.on('exit', exitHandler.bind(null, {
	cleanup: true
}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {
	exit: true
}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {
	exit: true
}));

function cleanBleMini() {
	debug('clean test');
	if (bleMini !== null) {
		bleMini.disconnect();
		bleMini = null;
	}
	debug('ble_mini_node_test');
}

var bleMini = null;

/**************************************
 * Start ble_mini_node_test launch scenario
 ***************************************/

debug('starting ble_mini_node_test');

async.series([
	function (callback) {
	    BLEMini.discover(function (discoveredBleMini) {
		    debug('ble_mini_node with uuid ' + discoveredBleMini.uuid + ' discovered');
		    bleMini = discoveredBleMini;
		    callback();
	});
},

	function (callback) {
	    debug('connect to ble_mini_node');
	    bleMini.connect(function () {
		    debug('connected to ble_mini_node');
		    callback();
	});
},

	function (callback) {
	    debug('discover ble_mini_node services');
	    bleMini.discoverServicesAndCharacteristics(function () {
		    debug('ble_mini_node services discovered');
		    callback();
	});
},

	function (callback) {
	    bleMini.readDeviceName(function (deviceName) {
		    debug('ble_mini_node name is ' + deviceName);
		    callback();
	});
},

	function (callback) {
	    bleMini.readVendorName(function (vendorName) {
		    debug('ble_mini_node vendor name is ' + vendorName);
		    callback();
	});
},

	function (callback) {
	    bleMini.readShieldLibraryVersion(function (shieldLibVer) {
		    debug('ble_mini_node shield library version is ' + shieldLibVer);
		    callback();
	});
},

	function (callback) {
	    debug('writing data to ble shield');
	
	    /** PREREQUISITIES : Some data must read on discovered blemini using serial interface */ 
	    bleMini.writeData(new Buffer([0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0]), function () {
		    debug('data written to  ble_mini_node');
		    callback();
	});
},

	function (callback) {
	    debug('reading data from ble shield');
	
	    /** PREREQUISITIES : Some data must written on discovered blemini using serial interface */ 
	    bleMini.readData(function (data) {
	        debug('data received : ');
	    	for (var index = 0; index < data.length; index++) {
	    		debug('0x' + data[index].toString(16) + ' ');
		    }
		    callback();
	});
},

	function (callback) {
	    debug('notify for new data');
	
	    /** PREREQUISITIES : Some data must written on discovered blemini using serial interface */ 
	    bleMini.on('dataReceived', function (data) {
	    	debug('data received : ');
	    	for (var index = 0; index < data.length; index++) {
	    		debug('0x' + data[index].toString(16) + ' ');
		    }
	    });
	    bleMini.notifyDataReceive(function () {
		    debug('you will be notified on new data');
		    callback();
	});
},

    function (callback) {
	    debug('unnotity for new data');
	    bleMini.unnotifyDataReceive(function () {
	    	debug('you will not be notified on new data');
		    callback();
	});
},

	function (callback) {
	    debug('re-notity for new data');
	    bleMini.notifyDataReceive(function () {
		    debug('you will be notified on new data');
		    callback();
	});
},

	function (callback) {
	    debug('test end');
	    // Insert ot other things to do...
}], 

    function (error, results) {
	    if (error) {
	    	debug('ble_mini_node_test : FAILED - error : ' + error + ' - exiting test...');
	    	cleanBleMini();
	    } else {
		    debug('ble_mini_node_test - SUCCESS');
		    callback();
	}
});
