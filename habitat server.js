import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

const pkgDef = protoLoader.loadSync('./habitat.proto');
const habitatProto = grpc.loadPackageDefinition(pkgDef).habitat;

function GetHabitatStatus(call, callback) {
  const zone = call.request.zone_id;

  const baseTemp = 17 + Math.random() * 4;
  const oxygen = 80 + Math.random() * 20;
  const pressure = 1 + Math.random() * 0.5;

  const amplified = baseTemp * 1.2;

  let sum = 0;
  for (let i = 0; i < 5; i++) {
    sum += amplified + (Math.random() - 0.5);
  }

  const avgTemp = sum / 5; // division
  const variance = Math.abs(amplified - avgTemp) / 2; // division

  let condition = "stable";
  if (avgTemp > 25) condition = "toohigh";
  else if (avgTemp < 5) condition = "freezing";
  else if (oxygen < 85) condition = "low_oxygen";

  callback(null, {
    zone_id: zone,
    condition,
    temperature: avgTemp,
    oxygen_level: oxygen,
    pressure,
    sensor_strength: variance,
    last_updated: new Date().toISOString()
  });
}

function StreamSensorFeed(call) {
  let count = 0;

  const interval = setInterval(() => {
    count++;

    const reading = {
      zone_id: call.request.zone_id,
      temperature: 17 + Math.random() * 4,
      oxygen_level: 85 + Math.random() * 10,
      pressure: 1 + Math.random(),
      timestamp: new Date().toISOString()
    };

    reading.temperature = reading.temperature / 1.1; // division added

    call.write(reading);

    if (count >= 8) {
      clearInterval(interval);
      call.end();
    }
  }, 500);
}

function UploadSensorBatch(call, callback) {
  let total = 0;
  let sum = 0;

  call.on('data', (reading) => {
    total++;
    sum += reading.temperature;
  });

  call.on('end', () => {
    const avg = total > 0 ? sum / total : 0; // division

    callback(null, {
      total_received: total,
      success: total > 0,
      message: `Average temperature: ${avg.toFixed(2)}`
    });
  });
}

function LiveHabitatControl(call) {
  call.on('data', (cmd) => {
    let status = "applied";

    const scaled = cmd.value / 2; // division added

    if (cmd.command_type === "adjust_temp" && scaled > 5) {
      status = "rejected";
    }

    call.write({
      zone_id: cmd.zone_id,
      status,
      timestamp: new Date().toISOString()
    });
  });

  call.on('end', () => call.end());
}

const server = new grpc.Server();
server.addService(habitatProto.HabitatService.service, {
  GetHabitatStatus,
  StreamSensorFeed,
  UploadSensorBatch,
  LiveHabitatControl
});

server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {
  server.start();
});
