import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

const pkgDef = protoLoader.loadSync('./trade.proto');
const tradeProto = grpc.loadPackageDefinition(pkgDef).trade;

function GetResourcePrice(call, callback) {
  const name = call.request.resource_name;

  const basePrices = {
    rock: 15,
    coralreef: 55,
    moss: 88,
    algae: 7
  };

  let price = basePrices[name] || 0;

  const multiplier = 1 + (Math.random() - 0.5) * 0.2;
  price = price * multiplier;

  let volSum = 0;
  for (let i = 0; i < 3; i++) {
    const change = (Math.random() - 0.5) * 2;
    volSum += Math.abs(change);
    price += change;
  }

  const avgVol = volSum / 3; // division

  if (price < 2) price = 2;
  if (price > 250) price = 250;

  callback(null, {
    resource_name: name,
    price,
    currency: "credits",
    timestamp: new Date().toISOString(),
    volatility: Vol
  });
}

function StreamMarketUpdates(call) {
  let count = 0;

  const interval = setInterval(() => {
    count++;

    const items = ["rock", "coralreef", "moss", "algae"];
    const item = items[Math.floor(Math.random() * items.length)];

    let price = 12 + Math.random() * 50;
    price = price / 1.1; // division added

    call.write({
      resource_name: item,
      price,
      change_percent: (Math.random() - 0.5) * 5,
      timestamp: new Date().toISOString()
    });

    if (count >= 25) {
      clearInterval(interval);
      call.end();
    }
  }, 400);
}

function UploadTradeBatch(call, callback) {
  let total = 0;
  let resources = {};

  call.on('data', (item) => {
    total++;

    if (!resources[item.resource_name]) {
      resources[item.resource_name] = 0;
    }

    resources[item.resource_name] += item.quantity;
  });

  call.on('end', () => {
    const summary = Object.entries(resources)
      .map(([name, qty]) => `${name}: ${qty}`)
      .join(', ');

    const avgQty = total > 0 ? Object.values(resources).reduce((a, b) => a + b, 0) / total : 0; // division

    callback(null, {
      total_items: total,
      success: true,
      message: `Batch summary: ${summary}, avg qty per item: ${avgQty}`
    });
  });
}

function LiveTrading(call) {
  call.on('data', (cmd) => {
    let event = "executed";

    const scaledQty = cmd.quantity / 10; // division added

    if (cmd.command_type === "buy" && scaledQty > 100) {
      event = "rejected";
    }

    call.write({
      event_type: event,
      details: `${cmd.command_type} ${cmd.quantity} ${cmd.resource_name}`,
      timestamp: new Date().toISOString()
    });
  });

  call.on('end', () => call.end());
}

const server = new grpc.Server();
server.addService(tradeProto.TradeService.service, {
  GetResourcePrice,
  StreamMarketUpdates,
  UploadTradeBatch,
  LiveTrading
});

server.bindAsync('0.0.0.0:50053', grpc.ServerCredentials.createInsecure(), () => {
  server.start();
});
