/*jshint loopfunc: true */

var debug = require('debug')('ble_mini_node');
var events = require('events');
var util = require('util');

var noble = require('noble');

var GENERIC_ACCESS_UUID = '1800';
var GENERIC_ATTRIBUTE_UUID = '1801';
var DEVICE_INFORMATION_UUID = '180a';
var BLE_DEVICE_SERVICE_UUID = '713D0000503E4C75BA943148F18D941E';

var DEVICE_NAME_UUID = '2a00';
var APPEARANCE_UUID = '2a01';
var PERIPHERAL_PRIVACY_FLAG_UUID = '2a02';
var RECONNECTION_ADDRESS_UUID = '2a03';
var PERIPHERAL_PREFERRED_CONNECTION_PARAMETERS_UUID = '2a04';

var VENDOR_NAME_UUID = '713d0001503e4c75ba943148f18d941e';

var RX_UUID = '713d0002503e4c75ba943148f18d941e';

var TX_UUID = '713d0003503e4c75ba943148f18d941e';

var RX_NEXT_DATA_UUID = '713d0004503e4c75ba943148f18d941e';

var SHIELD_LIB_VERSION_UUID = '713d0005503e4c75ba943148f18d941e';

function BLEMini(peripheral) {
	this._peripheral = peripheral;
	this._services = {};
	this._characteristics = {};
	this._bindings = {};
	
	//Attributes for restoration after a connection drop
	this._enabledNotifications = [];
	this._writtenCharacteristics = {};

	this._uuid = peripheral.uuid;

	//Set all bindings - workaround to Nodejs events listener implementation : two same methods binded won't be
	//recognized as same listener
	this._bindings.onDataReceived = this.onDataReceived.bind(this);
}

util.inherits(BLEMini, events.EventEmitter);

BLEMini.discover = function (callback, uuid) {
	var startScanningOnPowerOn = function () {
			if (noble.state === 'poweredOn') {
				var onDiscover = function (peripheral) {
						if (peripheral.advertisement.localName === 'Biscuit' && (uuid === undefined || uuid === peripheral.uuid)) {							
							noble.removeListener('discover', onDiscover);
							noble.stopScanning();
							var bleMini = new BLEMini(peripheral);
							noble.startScanning();
							callback(null, bleMini);
						}
					};
				noble.on('discover', onDiscover);
				noble.startScanning();
			} else if (noble.state === 'unknown') {
                //Wait for adapter to be ready
				noble.once('stateChange', startScanningOnPowerOn);
			} else {
                callback(new Error('Please be sure Bluetooth 4.0 supported / enabled on your system before trying to connect to sensortag-node'), null);
            }
		};

	startScanningOnPowerOn();
};

BLEMini.stopDiscover = function(callback){
	//TODO ? remove all? 
	//noble.removeListener('discover', onDiscover);
	noble.stopScanning(callback);
};

BLEMini.prototype.onConnectionDrop = function () {
	this.emit('connectionDrop');
};

BLEMini.prototype.reconnect = function (callback) {
	this._peripheral.reconnect(callback);
};

BLEMini.prototype.onReconnectAfterCharsDiscovery = function () {
	this.restoreCharsAndNotifs(function () {});
	this.emit('reconnect');
};

BLEMini.prototype.onReconnectDuringCharsDiscovery = function (callback) {
	this.discoverServicesAndCharacteristics(callback);
	this.emit('reconnect');
};

BLEMini.prototype.restoreCharsAndNotifs = function () {
	debug('restore ble_mini written characteristics and notifications after connection drop');
	var char_uuid, char_index;

	//Try to restore written characteristics - listener have already been registered
	for (char_uuid in this._writtenCharacteristics) {
		this._characteristics[char_uuid].write(this._writtenCharacteristics[char_uuid], false, function () {});
	}

	//Try to restore enabled notifications
	for (char_index = 0; char_index < this._enabledNotifications.length; char_index++) {
		this._enabledNotifications[char_index].notify(true, function (state) {});
	}
	this.emit('reconnect');
};


BLEMini.prototype.onDisconnect = function () {
	this.emit('disconnect');
};

BLEMini.prototype.onConnect = function () {
	this.emit('connect');
};

BLEMini.prototype.toString = function () {
	return JSON.stringify({
		uuid: this._uuid
	});
};

BLEMini.prototype.connect = function (callback) {
	this._peripheral.on('connectionDrop', this.onConnectionDrop.bind(this));
	this._peripheral.on('disconnect', this.onDisconnect.bind(this));
	this._peripheral.on('connect', this.onConnect.bind(this));
    
	this._peripheral.connect(callback);
};

BLEMini.prototype.disconnect = function (callback) {
	//Empty data stored for reconnection
	this._enabledNotifications.length = 0;
	this._writtenCharacteristics = {};

	this._peripheral.disconnect(callback);
};

BLEMini.prototype.discoverServicesAndCharacteristics = function (callback) {
	this._peripheral.removeAllListeners('reconnect');
	this._peripheral.on('reconnect', this.onReconnectDuringCharsDiscovery.bind(this, callback));

	this._peripheral.discoverAllServicesAndCharacteristics(function (error, services, characteristics) {
		if (error === null) {
			for (var i in services) {
				var service = services[i];
				debug('service ' + service + 'discovered');
				this._services[service.uuid] = service;
			}

			for (var j in characteristics) {
				var characteristic = characteristics[j];
				debug('characteristic ' + characteristic + 'discovered');
				this._characteristics[characteristic.uuid] = characteristic;
			}
		}

		this._peripheral.removeAllListeners('reconnect');
		this._peripheral.on('reconnect', this.onReconnectAfterCharsDiscovery.bind(this));
		callback();
	}.bind(this));
};

BLEMini.prototype.writeCharacteristic = function (uuid, data, callback) {
	this._characteristics[uuid].write(data, false, function () {
		//Keep written characteristics for a possible restoration
		this._writtenCharacteristics[uuid] = data;
		callback();
	}.bind(this));
};

BLEMini.prototype.notifyCharacteristic = function (uuid, notify, listener, callback) {
	var characteristic = this._characteristics[uuid];
	if (characteristic === undefined) {
	    //TODO throw error
	    debug('characteristic with uuid ' + uuid + ' not supported by sensortag');
		callback();
	} else {
		characteristic.notify(notify, function (state) {
			if (notify) {
				characteristic.on('read', listener);
				//Keep notification state for a possible restoration
				this._enabledNotifications.push(characteristic);
			} else {
				characteristic.removeListener('read', listener);
				//Remove from notification array if notification have been disabled
				var charIndex = this._enabledNotifications.indexOf(characteristic);
				if (charIndex != -1) {
					this._enabledNotifications.splice(charIndex, 1);
				}
			}
			callback();
		}.bind(this));
	}
};

BLEMini.prototype.readDataCharacteristic = function (uuid, callback) {
	if (this._characteristics[uuid] === undefined) {
		debug('characteristic with uuid ' + uuid + ' not supported by ble_mini_node');
	}
    else{
    	this._characteristics[uuid].read(function (error, data) {
		    callback(data);
	    });
    }
};

BLEMini.prototype.readStringCharacteristic = function (uuid, callback) {
	this.readDataCharacteristic(uuid, function (data) {
		callback(data.toString());
	});
};

BLEMini.prototype.readDeviceName = function (callback) {
	this.readStringCharacteristic(DEVICE_NAME_UUID, callback);
};

BLEMini.prototype.readVendorName = function (callback) {
	this.readStringCharacteristic(VENDOR_NAME_UUID, callback);
};

BLEMini.prototype.readShieldLibraryVersion = function (callback) {
	this.readDataCharacteristic(SHIELD_LIB_VERSION_UUID, function (data) {
		var versionId = [
			data.readUInt8(1).toString(16),
			data.readUInt8(0).toString(16)
			].join(':');
	callback(versionId);
	});
};

BLEMini.prototype.writeData = function (data, callback) {
	debug('write data ' + data);
	
	//MTU limited to 23 => Max size 20 = MTU - Attribute operation field size (1) - handle field size (2)
	const DATA_MAX_LENGTH = 20;
	if (data.length > DATA_MAX_LENGTH ) {
		callback(new Error('cannot write data, max data length = ' + DATA_MAX_LENGTH));
	}
	else{
		this.writeCharacteristic(TX_UUID, data, function(param1, param2){
			callback (null);	
		});
	}
};

BLEMini.prototype.readData = function (callback) {
	this.readDataCharacteristic(RX_UUID, callback);
};

BLEMini.prototype.notifyDataReceive = function (callback) {
	this.notifyCharacteristic(RX_UUID, true, this._bindings.onDataReceived, callback);
};

BLEMini.prototype.unnotifyDataReceive = function (callback) {
	this.notifyCharacteristic(RX_UUID, false, this._bindings.onDataReceived, callback);
};

BLEMini.prototype.onDataReceived = function (data) {
	/* for control the BLE Shield to send next data, once you get notification 
	for 0002, you have to write a "1" to RX_NEXT_DATA_UUID, so that to allow BLE shield to 
	send more data to you.
	*/
	this.writeCharacteristic(RX_NEXT_DATA_UUID, new Buffer([0x01]), function(){});
	this.emit('dataReceived', data);
};

module.exports = BLEMini;
