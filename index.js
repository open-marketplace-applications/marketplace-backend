const request = require("request");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const paymentModule = require("iota-payment");
const fs = require("fs");

const swaggerUi = require('swagger-ui-express');
const openApiDocumentation = require('./api/v1/api-doc');

const low = require("lowdb");
const FileAsync = require("lowdb/adapters/FileAsync");
const fetch = require("node-fetch");

const { PROVIDER, URL, PORT, IOTAADDRESS } = require("./config.js");

const Mam = require("@iota/mam");

const { asciiToTrytes } = require("@iota/converter");
let { isValidChecksum } = require("@iota/checksum");
const generateSeed = require("iota-generate-seed");

const { getShopInfo } = require("./src/shop");

let mamState;

// Create server
const app = express();

app.use('/api', swaggerUi.serve, swaggerUi.setup(openApiDocumentation));


app.use(cors());
app.use(bodyParser.json());

let options = {
  api: true,
  websockets: true
};

let server = paymentModule.createServer(app, options);

//Create an event handler which is called, when a payment was successfull
let onPaymentSuccess = function(payment) {
  console.log(`Payment received:`, payment);
  handleDonation(payment);
  // .then((response) => {
  //     db.set('config.state', response.state)
  //         .write()

  //     db.get('snapshots')
  //         .push(response.snapshot)
  //         .last()
  //         .assign({ id: Date.now().toString() })
  //         .write()
  // })
};

// Listen to the "paymentSuccess" event and call function
paymentModule.onEvent("paymentSuccess", onPaymentSuccess);

// Create database instance and start server
const adapter = new FileAsync("db.json");
low(adapter)
  .then(db => {
    // Routes
    //news routes
    app.use("/", require("./src/routes"));
    // GET /shops/:id
    app.get("/shops/:id", (req, res) => {
      const post = db
        .get("shops")
        .find({ id: req.params.id })
        .value();

      res.send(post);
    });

    // GET /root
    if (fs.existsSync(__dirname + "/frontend")) {
      app.use('/', express.static('frontend/dist'));
    }
    else {
      app.get("/", (req, res) => {
        // Do something
        const root = db.get("config.root").value();
        res.send(root);
      });
    }


    // POST /shops
    app.post("/shops", (req, res) => {
      console.log("register new shop", req.body);

      const shop_root = req.body.shop_root;

      console.log("shop_root", shop_root);
      // get information from shop mam
      getShopInfo(shop_root)
        .then(shop => {
          console.log("shop", shop);

          if (shop.name) {
            let data = {
              ...shop,
              root: shop_root,
              public: false
            };

            // Store shop data
            db.get("shops")
              .push(data)
              .last()
              .assign({ id: Date.now().toString() })
              .write()
              .then(() => res.send(data));
          } else {
            res.send({ message: "Shop information invalid" });
          }
        })
        .catch(err => {
          res.send(err);
        });
    });

    // GET /shops
    app.get("/shops", (req, res) => {
      const shops = db.get("shops").value();
      res.send(shops);
    });

    // GET /orders
    app.get("/orders", (req, res) => {
      const orders = db
        .get("orders")
        .filter({ status: "requested" })
        .value();

      const public_orders = orders.map(order => (order = order.public_data));

      res.send(public_orders);
    });

    // POST /orders
    app.post("/orders", (req, res) => {
      console.log("create new order_request", req.body);

      const order_root = req.body.order_root;

      console.log("order_root", order_root);
      // get information from shop mam
      getShopInfo(order_root)
        .then(order => {
          console.log("order", order);

          if (order.delivery.first_name) {
            let data = {
              ...order,
              root: order_root,
              public: false,
              public_data: {
                description: "",
                eastimated_route_length: "",
                eastimated_time: "",
                eastimated_price: "",
                reward: ""
              },
              status: "requested",
              ordered: false
            };

            // Store shop data
            db.get("orders")
              .push(data)
              .last()
              .assign({ id: Date.now().toString() })
              .write()
              .then(() => res.send(data));
          } else {
            res.send({ message: "Order information invalid" });
          }
        })
        .catch(err => {
          res.send(err);
        });
    });

    // GET /payments
    app.get("/payments", (req, res) => {
      paymentModule
        .getPayments()
        .then(payments => {
          res.send(payments);
        })
        .catch(err => {
          console.log(err);
        });
    });

    // GET /payouts/:nodeId
    app.get("/payouts/:shopId", (req, res) => {
      let nodeId = req.params.nodeId;
      paymentModule
        .getPayouts()
        .then(payouts => {
          payouts = payouts.filter(p => typeof p.data != "undefined");
          payouts = payouts
            .filter(payout => payout.data.shopId == shopId)
            .reverse();
          res.send(payouts);
        })
        .catch(err => {
          console.log(err);
        });
    });

    // Initialise MAM State
    let seed = db.get("config.seed").value();
    console.log("seed", seed);
    if (seed) {
      mamState = Mam.init(PROVIDER, seed);

      let old_state = db.get("config.state").value();
      if (old_state) {
        updateMamState(old_state);
      }
    } else {
      seed = generateSeed();
      db.set("config.seed", seed).write();

      mamState = Mam.init(PROVIDER, seed);

      db.set("config.root", Mam.getRoot(mamState)).write();
    }
    // Set db default values
    return db.defaults({ shops: [], orders: [], config: {} }).write();
  })
  .then(() => {
    server.listen(PORT, () => console.log("Server listening on port " + PORT));
  });

const fetchData = async () => {
  let response = await fetch(URL);
  let json = await response.json();
  return json;
};

const updateMamState = newMamState => (mamState = newMamState);

// Publish to tangle
const publishToMAM = async data => {
  // Create MAM Payload - STRING OF TRYTES
  const trytes = asciiToTrytes(JSON.stringify(data));

  const message = Mam.create(mamState, trytes);

  // Save new mamState
  updateMamState(message.state);

  // Attach the payload
  let x = await Mam.attach(message.payload, message.address, 3, 14);

  return message;
};

const handleDonation = async payment => {
  try {
    let data;
    while (typeof data == "undefined") {
      try {
        console.log("fetch new shops Data");
        // TODO: GET NEW shops DONATION ADDRESSES
        data = await fetchData();
      } catch (e) {}
      await new Promise(resolve => setTimeout(resolve, 20000));
    }

    console.log("shops", data);
    console.log("shops count", data.length);

    // make payout

    //check if own address is valid
    if (validAddress(IOTAADDRESS)) {
      //set address for invalid entries
      data.map(e => {
        if (!validAddress(e.donation_address)) {
          e.address = IOTAADDRESS;
        }
      });
    }

    // 1. get node_with_addresses
    const all_receivers_with_addresses = data.filter(receiver =>
      validAddress(receiver.donation_address)
    );

    //trim spaces
    for (receiver of all_receivers_with_addresses) {
      receiver.donation_address = receiver.donation_address.trim();
    }

    console.log(
      "all_receivers_with_addresses count",
      all_receivers_with_addresses.length
    );

    //remove spent addresses
    let addresses = all_receivers_with_addresses.map(e =>
      e.donation_address.slice(0, 81)
    );
    let spentStatus = await wereAddressesSpentFrom(addresses);
    let receivers_with_valid_addresses = all_receivers_with_addresses.filter(
      (obj, index) => spentStatus[index] == false
    );

    console.log(
      "receivers_with_valid_addresses count",
      receivers_with_valid_addresses.length
    );

    // 2. calculate iota for each receiver
    let total_iotas = payment.txInfo.value;

    //calculate iota, assign rounded iota value and calculate remaining iotas
    let assigned_iotas = 0;
    let average_iota = Math.floor(
      total_iotas / receivers_with_valid_addresses.length
    );
    console.log("average_iota:", average_iota);

    receivers_with_valid_addresses.forEach(function(object) {
      object.iotas = average_iota;
      assigned_iotas = object.iotas + assigned_iotas;
    });
    let remaining = total_iotas - assigned_iotas;
    console.log("total_iotas:", total_iotas);
    console.log("assigned_iotas:", assigned_iotas);
    console.log("remaining", remaining);

    // send remaining tokens to standart address

    //send payouts
    let tag = "OMA9DONATION9PAYOUT";
    for (receiver of receivers_with_valid_addresses) {
      try {
        if (receiver.iotas > 0) {
          let payout = await paymentModule.sendPayout({
            address: receiver.address,
            value: receiver.iotas,
            message: `Shop donation payout!\nShop: "${receiver.name}".`,
            tag,
            data: { shopId: receiver.shopId }
          });
          console.log(
            `Payout with ${payout.value} created for shop (${receiver.name}). Address: ${payout.address}`
          );
          //wait 1 second
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (e) {
        console.log(e);
      }
    }
    tag = "OMA9DONATION9REST";
    try {
      if (remaining > 0) {
        let payout = await paymentModule.sendPayout({
          address: IOTAADDRESS,
          value: remaining,
          message: `Shop donation remaining payout!.`,
          tag,
          data: { remaining_payout: remaining }
        });
        console.log(
          `remaining Payout with  ${payout.value} created (${IOTAADDRESS}).`
        );
        //wait 1 second
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (e) {
      console.log(e);
    }

    // return {}
    // // Hash data
    // const hash = sha256(JSON.stringify(data))

    // let mam_message = {
    //     timestamp: Date.now(),
    //     data_hash: hash
    // }
    // let mam = await publishToMAM(mam_message)
    // let snapshot = {
    //     ...mam_message,
    //     root: mam.root
    // }

    // return { snapshot: snapshot, state: mam.state }
  } catch (err) {
    console.error("Error in handleDonation", err);
  }
};

function wereAddressesSpentFrom(addresses, provider) {
  return new Promise(async (resolve, reject) => {
    try {
      var command = {
        command: "wereAddressesSpentFrom",
        addresses: addresses
      };

      var options = {
        url: PROVIDER,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-IOTA-API-Version": "1",
          "Content-Length": Buffer.byteLength(JSON.stringify(command))
        },
        json: command
      };

      request(options, function(error, response, data) {
        if (!error && response.statusCode == 200) {
          resolve(data.states);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

function validAddress(address) {
  if (typeof address == "string") {
    address = address.trim();
  } else {
    return false;
  }

  try {
    if (!isValidChecksum(address)) {
      return false;
    }
  } catch (e) {
    console.error(e);
    return false;
  }

  //check last trit for Kerl address if value transfer
  if (!/[E-V]/.test(address.slice(80, 81))) {
    return true;
  } else {
    return false;
  }
}
