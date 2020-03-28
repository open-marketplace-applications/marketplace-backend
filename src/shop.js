const { composeAPI } = require('@iota/core')
const { asciiToTrytes, trytesToAscii } = require('@iota/converter')
const { mamFetch } = require('@iota/mam.js');

// Setup the details for the channel.
const mode = 'restricted';
const sideKey = 'OMA';
const api = composeAPI({ provider: "https://nodes.devnet.thetangle.org:443" });


function getShopInfo(shop_root) {
    return new Promise(async function(resolve, reject) {
        try {
            
            const fetched = await mamFetch(api, shop_root, mode, sideKey)
            console.log("fetched", fetched)
            const shop = JSON.parse(trytesToAscii(fetched.message))
            return resolve(shop);

        } catch (error) {
            console.log('createMAMChannel error', error);
            return reject(error);
        }
    });
}


module.exports = {
    getShopInfo
  }