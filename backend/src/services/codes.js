const QRCode = require('qrcode');
const bwipjs = require('bwip-js');
const config = require('../config');

// QR encodes a URL to the asset detail page so scanning opens the record.
async function assetQrPng(asset) {
  const url = `${config.appUrl}/assets/${asset.id}`;
  return QRCode.toBuffer(JSON.stringify({ tag: asset.assetTag, sn: asset.serialNumber, url }), { width: 300 });
}

async function assetBarcodePng(asset) {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text: asset.assetTag,
    scale: 3,
    height: 12,
    includetext: true,
    textxalign: 'center',
  });
}

module.exports = { assetQrPng, assetBarcodePng };
