'use strict';

var modalRemoveAds = require('widgets/modals/remove-ads');
var emitter = require('lib/emitter');

var ad_units = {
  ios : {banner: '196605347445795_200305920409071'},
  android : {banner: '196605347445795_200306843742312'}
}
var resizeHandler = null;
var storeIsReady = false;

var adFreeId = 'adfree';
var adFreePrice = '';

var adFreeSubscriptionId = 'adfreesubscription';
var adFreeSubscriptionPrice = '';

function init() {
  if (!window.store) return false;
  var store = window.store;
  var isAdFree;
  var isWalletReady = false;

  store.validator = process.env.SITE_URL + 'iap';

  store.register({
    id: adFreeId,
    type: store.NON_CONSUMABLE
  });

  store.register({
    id: adFreeSubscriptionId,
    type: store.PAID_SUBSCRIPTION
  });

  store.when(adFreeId).loaded(function(product) {
    adFreePrice = product.price;
  });
  store.when(adFreeSubscriptionId).loaded(function(product) {
    adFreeSubscriptionPrice = product.price;
  });

  store.when(adFreeId).approved(function(product) {
    product.verify();
  });
  store.when(adFreeSubscriptionId).approved(function(product) {
    product.verify();
  });

  store.when(adFreeId).verified(function(product) {
    product.finish();
  });
  store.when(adFreeSubscriptionId).verified(function(product) {
    product.finish();
  });

  store.when(adFreeId).owned(function() {
    if (isAdFree) return;
    emitter.emit('ad-free-owned');
    off();
    isAdFree = true;
  });
  store.when(adFreeSubscriptionId).owned(function() {
    if (isAdFree) return;
    emitter.emit('ad-free-owned');
    off();
    isAdFree = true;
  });

  store.when(adFreeId).cancelled(function() {
    emitter.emit('ad-free-cancel-loading');
  });
  store.when(adFreeSubscriptionId).cancelled(function() {
    emitter.emit('ad-free-cancel-loading');
  });

  store.when(adFreeId).error(function(error) {
    emitter.emit('ad-free-cancel-loading');
    console.error(error);
  });
  store.when(adFreeSubscriptionId).error(function(error) {
    emitter.emit('ad-free-cancel-loading');
    console.error(error);
  });

  store.ready(function() {
    storeIsReady = true;
    if (!isAdFree) {
      isAdFree = false;
      showBanner();
    }
    if (isWalletReady) {
      emitter.emit('ad-fee-modal');
    }
  });
  emitter.once('wallet-ready', function() {
    isWalletReady = true;
    if (isAdFree === false) {
      emitter.emit('ad-fee-modal');
    }
  });

  emitter.once('ad-fee-modal', function() {
    showAdFreeModal();
    document.addEventListener('resume', showAdFreeModal, false);
  });

  store.refresh();
}

function buyAdFree() {
  if (!storeIsReady) return false;
  window.store.order(adFreeId);
}

function buyAdFreeSubscription() {
  if (!storeIsReady) return false;
  window.store.order(adFreeSubscriptionId);
}

function showBanner() {
  if (!window.FacebookAds) return false;
  var FacebookAds = window.FacebookAds;
  var position = FacebookAds.AD_POSITION.BOTTOM_CENTER;

  var adid = (/(android)/i.test(navigator.userAgent)) ? ad_units.android : ad_units.ios;
  FacebookAds.createBanner({
    adId: adid.banner,
    position: position,
    autoShow: true
  }, function() {
    var timeout = false;
    resizeHandler = function() {
      clearTimeout(timeout);
      timeout = setTimeout(function() {
        FacebookAds.showBanner(position);
      }, 300);
    }
    window.addEventListener('resize', resizeHandler);
    FacebookAds.showBanner(position);
  });
}

function showAdFreeModal(force) {
  if (!storeIsReady) return false;

  var dismissDate = (new Date(parseInt(window.localStorage.getItem('_cs_ad_free_dismiss_date'), 10))).getTime();
  var dismissInterval = 30 * 24 * 3600 * 1000; // 30 days in ms
  if (isNaN(dismissDate) || (Date.now() - dismissDate) > dismissInterval || force === true) {
    modalRemoveAds({
      onDismiss: function() {
        window.localStorage.setItem('_cs_ad_free_dismiss_date', Date.now());
      },
      price: adFreePrice,
      buyAdFree: buyAdFree,
      priceSubscription: adFreeSubscriptionPrice,
      buyAdFreeSubscription: buyAdFreeSubscription
    });
  }
}

function off() {
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    window.FacebookAds.removeBanner();
  }
  document.removeEventListener('resume', showAdFreeModal, false);
}

module.exports = {
  init: init,
  showAdFreeModal: showAdFreeModal
};
