(function(Map, Cluster, Pin) {
'use strict';

console.log('hello map.adapter.js');

Cluster.prototype.callbacks_['click'].push(function(cluster) {
  var map = cluster.map_;
  var div = cluster.div_;
  var lnglat = cluster.center_;
  
  map.panTo(lnglat);
});

})(window.maps.Map, window.maps.Cluster, window.maps.Pin);