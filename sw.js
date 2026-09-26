/* 太阳系漫游指南 · Service Worker（离线缓存，仅 http(s) 下生效） */
'use strict';

const CACHE = 'solar-guide-v11';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './css/style.css',
  './js/data.js',
  './js/i18n.js',
  './js/textures.js',
  './js/solar-core.js',
  './js/solar-bodies.js',
  './js/solar-ui.js',
  './js/solar-main.js',
  './js/tours.js',
  './js/tools.js',
  './js/starlife.js',
  './js/transit.js',
  './js/meteors.js',
  './js/sky.js',
  './js/gamepad.js',
  './js/constellation.js',
  './js/moonphase.js',
  './js/calendar.js',
  './js/quizdaily.js',
  './js/boot.js',
  './js/lib/three.min.js',
  './js/lib/OrbitControls.js',
  './js/lib/postprocessing/CopyShader.js',
  './js/lib/postprocessing/LuminosityHighPassShader.js',
  './js/lib/postprocessing/EffectComposer.js',
  './js/lib/postprocessing/MaskPass.js',
  './js/lib/postprocessing/ShaderPass.js',
  './js/lib/postprocessing/RenderPass.js',
  './js/lib/postprocessing/UnrealBloomPass.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k !== CACHE;
      }).map(function (k) {
        return caches.delete(k);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  const url = e.request.url;
  if (e.request.method !== 'GET') return;
  // 本地资源与导航：网络优先（保证拿到最新版），离线时回退缓存
  if (e.request.mode === 'navigate' || url.indexOf(self.location.origin) === 0) {
    e.respondWith(
      fetch(e.request).then(function (res) {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
        }
        return res;
      }).catch(function () {
        return caches.match(e.request).then(function (hit) {
          return hit || caches.match('./index.html');
        });
      })
    );
    return;
  }
  // 第三方资源（NASA 真实贴图 CDN）：网络优先，失败回退缓存
  e.respondWith(fetch(e.request).catch(function () { return caches.match(e.request); }));
});
