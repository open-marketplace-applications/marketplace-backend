require('dotenv').config()

console.log("process.env.PORT", process.env.PORT)
module.exports = {
    "PROVIDER": "https://nodes.devnet.thetangle.org:443",
    "URL": "",
    "PORT": process.env.PORT || 5000,
    "IOTAADDRESS": ""
}
