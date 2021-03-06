var exec = require('child_process').exec;
var http = require('http');
var ioFabricClient = require('@iotracks/container-sdk-nodejs');

const capturemodeList = ['photo','videostream'];
var frequency = 1000;
var currentConfig;
var IP_ADDRESS;
var wsMessageConnected = false;
var periodicJob;
var send_timestamp;
var intervalMsec = 2000;
var sequenceNo=0;

ioFabricClient.init('iofabric', 54321, null,
    function() {
        fetchConfig();
        ioFabricClient.wsControlConnection(
            {
                'onNewConfigSignal':
                    function onNewConfigSignal() {
                        fetchConfig();
                    },
                'onError':
                    function onControlSocketError(error) {
                        console.error('There was an error with Control WebSocket connection to ioFabric: ', error);
                    }
            }
        );
        ioFabricClient.wsMessageConnection(
            function(ioFabricClient) {
                wsMessageConnected = true;
                if (periodicJob==undefined) {
                  periodicJob = setInterval(main,intervalMsec)
                }
            },
            {
                'onMessages':
                    function(messages) {
                        var d=new Date()
                        var rcv_timestamp = d.getTime()
                        console.log("Received reply. Sequence number:%d. RTT:%d ms", messages[0].sequencenumber, rcv_timestamp - send_timestamp);
                        //console.log(messages);
                        send_timestamp = 0; //This allows us to detect a timeout.
                    },
                'onMessageReceipt':
                    function(messageId, timestamp) {/* message was sent successfully */},
                'onError':
                    function(error) {
                        console.error('There was an error with Message WebSocket connection to ioFabric: \n', error);
                    }
            }
        );
    }
);


function fetchConfig() {
    ioFabricClient.getConfig(
        {
            'onBadRequest':
                function onGetConfigBadRequest(errorMsg) {
                    console.error('There was an error in request for getting config from the local API: ', errorMsg );
                },
            'onNewConfig':
                function onGetNewConfig(config) {
                    try {
                        if(config) {
                            //console.log(config);
                            if (JSON.stringify(config) !== JSON.stringify(currentConfig)) {
                                currentConfig = config;
                                if(currentConfig.interval_sec) {
                                    console.log("Setting ping interval to:%d seconds", currentConfig.interval_sec);
                                    intervalMsec = currentConfig.interval_sec * 1000;
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Couldn\'t stringify Config JSON : \n', error);
                    }
                },
            'onError':
                function onGetConfigError(error) {
                    console.error('There was an error getting config from the local API: \n', error);
                }
        }
    );
}

function checkForTimeOut() {
  if (send_timestamp != 0) {
    console.log("Request timeout for sequence number: %d", sequenceNo);
    send_timestamp = 0;
  }
}
var main = function() {
    clearInterval(periodicJob);
    checkForTimeOut();
    sendMessage(Buffer("", 'binary'));
    periodicJob = setInterval(main, intervalMsec);
}


function sendMessage(contentData) {
    sequenceNo = sequenceNo + 1;
    var ioMsg = ioFabricClient.ioMessage(
        {
            'tag': '',
            'groupid': '',
            'sequencenumber': sequenceNo,
            'sequencetotal': 1,
            'priority': 0,
            'authid': '',
            'authgroup': '',
            'chainposition': 0,
            'hash': '',
            'previoushash': '',
            'nonce': '',
            'difficultytarget': 0,
            'infotype': 'ping/payload',
            'infoformat': 'binary',
            'contextdata': Buffer(0),
            'contentdata' : contentData
        }
    );
    //console.log(ioMsg);
    if(wsMessageConnected) { 
        console.log("Sending ping. Sequence number:%d.", sequenceNo);
        var d = new Date()
        send_timestamp = d.getTime()
        ioFabricClient.wsSendMessage(ioMsg);
    }
}

