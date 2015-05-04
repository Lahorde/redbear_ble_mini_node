# ble mini node

node.js lib for Readbear ble mini
http://redbearlab.com/blemini/

## Install

    npm install ble_mini_node

## Usage

    var BLEMini = require('ble_mini_node');

### Discover

    BLEMini.discover(callback(bleMini)[, uuid]);

Optional BleMini ```uuid``` to scan for, obtained from previous discover ```bleMini.uuid```.
The ```uuid``` per BleMini may not be the same across machines. 

### Connect

    bleMini.connect(callback);

### Disconnect

    bleMini.disconnect(callback);

### Discover Services and Characteristics

    bleMini.discoverServicesAndCharacteristics(callback);

### Device Info

    bleMini.readDeviceName(callback(deviceName));
    
	bleMini.readVendorName(callback(deviceName));
	
    bleMini.readShieldLibraryVersion(callback(shieldLibVer));

### Data read

Notify/Unnotify:

    bleMini.notifyDataReceive(callback);

    bleMini.unnotifyDataReceive(callback);

Read:

    bleMini.readData(callback(data));

### Data write
    
    bleMini.writeData(data, callback);

## Events

	bleMini.on('dataReceived', callback);
