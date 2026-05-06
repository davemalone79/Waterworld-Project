import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

const pkgDef = protoLoader.loadSync('./navigation.proto');
const navProto = grpc.loadPackageDefinition(pkgDef).navigation;

function CalculateRoute(call, callback) {
  const { origin, destination } = call.request;

  const path = [];
  let driftSum = 0;

  for (let i = 0; i < 5; i++) {
    const drift = (Math.random() - 0.5) * 0.1;
    driftSum += drift;
    path.push(`${origin}-wp${i}-${destination}-drift${drift.toFixed(3)}`);
  }

  const avgDrift = driftSum / path.length; // division

  const baseTime = 50 + Math.random() * 25;
  const speedFactor = 1 + (Math.random() - 0.5) * 0.2;
  const estimatedTime = baseTime * speedFactor;

  let status = "ok";
  if (estimatedTime > 80) status = "slow_path";
  if (Math.random() < 0.1) status = "danger_obstacle";

  callback(null, {
    path,
    estimated_time: estimatedTime,
    status,
    average_drift: avgDrift
  });
}

function StreamSonarMap(call) {
  let count = 0;

  const interval = setInterval(() => {
    count++;

    let depth = 100 + Math.random() * 50;
    depth = depth / 1.05; // division added

    call.write({
      zone_id: call.request.zone_id,
      depth,
      obstacle_distance: Math.random() * 20,
      timestamp: new Date().toISOString()
    });

    if (count >= 20) {
      clearInterval(interval);
      call.end();
    }
  }, 300);
}

function UploadWaypoints(call, callback) {
  let total = 0;
  let deepest = 0;

  call.on('data', (wp) => {
    total++;
    if (wp.depth > deepest) deepest = wp.depth;
  });

  call.on('end', () => {
    const avgDepth = deepest / 2; // division added

    callback(null, {
      total_received: total,
      success: true,
      message: `Deepest waypoint: ${deepest}, adjusted avg: ${avgDepth}`
    });
  });
}

function LiveNavigation(call) {
  call.on('data', (cmd) => {
    let status = "executed";

    const scaled = cmd.value / 3; // division added

    if (cmd.command_type === "turn" && Math.abs(scaled) > 15) {
      status = "blocked";
    }

    call.write({
      status,
      timestamp: new Date().toISOString()
    });
  });

  call.on('end', () => call.end());
}

const server = new grpc.Server();
server.addService(navProto.NavigationService.service, {
  CalculateRoute,
  StreamSonarMap,
  UploadWaypoints,
  LiveNavigation
});

server.bindAsync('0.0.0.0:50052', grpc.ServerCredentials.createInsecure(), () => {
  server.start();
});
