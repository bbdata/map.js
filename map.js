(function() {
'use strict';

  // Map Constructor.
  function Map(config, cb) {
    this.config = Map.merge(Map.defaults, config);
    
    this.element_ = this.config.element;
    this.map_ = null;
    this.data_ = [];
    this.pins_ = [];
    this.clusters_ = [];
    
    this.init();
  }
  
  // Default Map config.
  Map.defaults = {
    paths: {
      styles: 'map_styles.json',
      pins: 'map_pins.json',
    },
    mapOptions: {
      center: {lat: 49.282263, lng: -123.042992},
      zoom: 14,
      styles: null, // https://mapstyle.withgoogle.com
      fullscreenControl: false,
      gestureHandling: 'auto',
      mapTypeControl: false,
      streetViewControl: false,
      zoomControl: true,
      backgroundColor: '#c9f1f5',
    }
  };
  
  // Utility to merge config arrays together.
  Map.merge = function() {
    var args = Array.prototype.slice.call(arguments);

    function merge(target, obj) {
      if (typeof target === 'object' && typeof obj === 'object') {
        for (var key in obj) {
          if (obj.hasOwnProperty(key)) {
            target[key] = obj[key];
          }
        }
      }

      return target;
    }

    for (var i = 1, end = args.length; i < end; i++) {
      merge(args[0], args[i]);
    }
    return args[0];
  };
  
  // Utlity function to extend an object's prototype
  Map.extend = function(obj1, obj2) {
    return (function(object) {
      for (var property in object.prototype) {
        this.prototype[property] = object.prototype[property];
      }
      return this;
    }).apply(obj1, [obj2]);
  };
  
  Map.prototype.init = function() {
    // Storing this in a variable so I can later refer to it
    // in the callback functions.
    var that = this;
    
    // Get the styles
    Map.getJson(this.config.paths.styles, function(styles) {
      that.config.mapOptions.styles = styles;
      
      // Get map data
      Map.getJson(that.config.paths.pins, function(json) {
        that.data_ = json;
        
        that.createMap_();
        //that.createPins_(true);
        that.createClusters_();
      });
    });
  }
  
  Map.prototype.createMap_ = function() {
    var element = this.element_,
        mapOptions = this.config.mapOptions;
    
    this.map_ = new google.maps.Map(element, mapOptions);
  }
  
  Map.prototype.createPins_ = function(pinToMap) {
    var data = this.data_;
    
    if (data.length) {
      for (var i = 0, datum; datum = data[i]; i++) {
        var pin = new Pin(datum);
        
        if (pinToMap) {
          pin.pinToMap(this.map_);
        }
        
        this.pins_.push(pin);
      }
    }
  }
  
  Map.prototype.createClusters_ = function() {
    // Check if there are no pins and create them.
    if (this.pins_.length === 0) {
      this.createPins_();
    }
    
    var pins = this.pins_;
    var clusters = new Clusters(pins, this.map_);
  }
  
  Map.getJson = function(url, callback) {
    // Check that callback has a typeof function
    if (typeof callback !== 'function') {
      console.error('No callback specified.');
      return false;
    }
    try {
      var request = new XMLHttpRequest();
      request.open('GET', url, true);
      
      request.onload = function() {
        if (request.status >= 200 && request.status < 400) {
          var json = JSON.parse(request.responseText);
          callback(json);
          return;
        }
        
        throw 'Request failed: ' + url;
      };
  
      request.send();
    }
    catch (e) {
      // Handle errors.
    }
  }
  
  window.maps.Map = Map;

  function Pin(data) {
    Map.extend(Pin, google.maps.OverlayView);

    this.data_ = data;
    
    this.lnglat_ = {"lng": data.lng, "lat": data.lat};
    
    this.div_ = null;
    this.tpl_ = null;
  }
  
  Pin.prototype.pinToMap = function(map) {
    this.setMap(map);
  }
  
  // Implement google.maps.OverlayView().onAdd()
  Pin.prototype.onAdd = function() {
    var pin = document.createElement('div');
    pin.className = 'pin';
    pin.style.position = 'absolute';
    
    if (this.tpl_) {
      pin.innerHTML = this.tpl_;
    }
    
    var panes = this.getPanes();
    panes.overlayMouseTarget.appendChild(pin);
    
    this.div_ = pin;
    var that = this;
    
    google.maps.event.addDomListener(pin, 'click', function() {
console.log('Pin got clicked.');
    });
  }
  
  // Implement google.maps.OverlayView().draw()
  Pin.prototype.draw = function() {
    var lnglat = new google.maps.LatLng(this.lnglat_);
    var pos = this.getProjection().fromLatLngToDivPixel(lnglat);
    var div = this.div_;
    
    div.style.left = pos.x + 'px';
    div.style.top = pos.y + 'px';
  }
  
  // Implement google.maps.OverlayView().onRemove()
  Pin.prototype.onRemove = function() {
    this.div_.parentNode.removeChild(this.div_);
    this.div_ = null;
  }
  
  window.maps.Pin = Pin;
  
  function Clusters(pins, map) {
    Map.extend(Clusters, google.maps.OverlayView);
    
    this.map_ = map;
    this.pins_ = pins;
    
    this.clusters_ = [];
    this.gridSize_ = 30;
    
    this.setMap(map);
  }
  
  // Implement google.maps.OverlayView().onAdd()
  Clusters.prototype.onAdd = function() {}
  
  // Implement google.maps.OverlayView().draw()
  Clusters.prototype.draw = function() {
    // Reset Clusters
    if (this.clusters_.length) {
      for (var i = 0, cluster; cluster = this.clusters_[i]; i++) {
        cluster.remove();
      }
      this.clusters_ = [];
    }
    
    for (var i = 0, pin; pin = this.pins_[i]; i++) {
      this.addToClosestCluster_(pin);
    }
  }
  
  // Implement google.maps.OverlayView().onRemove()
  Clusters.prototype.onRemove = function() {}
  
  Clusters.prototype.addToClosestCluster_ = function(pin) {
    var clusterToAddTo = null;
    
    // Find out if this pin belongs in an existing cluster.
    if (this.clusters_.length) {
      for (var i = 0, cluster; cluster = this.clusters_[i]; i++) {
        if (cluster.bounds_.contains(new google.maps.LatLng(pin.lnglat_))) {
          clusterToAddTo = cluster;
        }
      }
    }
    
    if (clusterToAddTo) {
      clusterToAddTo.addPin(pin);
    }
    else {
      var cluster = new Cluster(this);
      cluster.addPin(pin);
      this.clusters_.push(cluster);
    }
  }
  
  Clusters.prototype.calculateBounds_ = function(cluster) {
    var bounds = new google.maps.LatLngBounds(cluster.center_, cluster.center_);
    cluster.bounds_ = this.getExtendedBounds_(bounds);
  };
  
  Clusters.prototype.getExtendedBounds_ = function(bounds) {
    var projection = this.getProjection();
  
    // Turn the bounds into latlng.
    var tr = new google.maps.LatLng(
      bounds.getNorthEast().lat(),
      bounds.getNorthEast().lng()
    );
    var bl = new google.maps.LatLng(
      bounds.getSouthWest().lat(),
      bounds.getSouthWest().lng()
    );
  
    // Convert the points to pixels and the extend out by the grid size.
    var trPix = projection.fromLatLngToDivPixel(tr);
    trPix.x += this.gridSize_;
    trPix.y -= this.gridSize_;
  
    var blPix = projection.fromLatLngToDivPixel(bl);
    blPix.x -= this.gridSize_;
    blPix.y += this.gridSize_;
  
    // Convert the pixel points back to LatLng
    var ne = projection.fromDivPixelToLatLng(trPix);
    var sw = projection.fromDivPixelToLatLng(blPix);
  
    // Extend the bounds to contain the new bounds.
    bounds.extend(ne);
    bounds.extend(sw);
  
    return bounds;
  };
  
  window.maps.Clusters = Clusters;
  
  function Cluster(parent) {
    Map.extend(Cluster, google.maps.OverlayView);
    
    this.parent_ = parent;
    this.map_ = parent.map_;
    
    this.pins_ = [];
    this.bounds_ = [];
    this.center_ = null;
    
    this.div_ = null;
    this.tpl_ = null;
    
    this.setMap(this.map_);
  }
  
  // Implement google.maps.OverlayView().onAdd()
  Cluster.prototype.onAdd = function() {
    var cluster = document.createElement('div');
    cluster.className = 'cluster';
    cluster.style.position = 'absolute';
    
    if (this.tpl_) {
      cluster.innerHTML = this.tpl_;
    }
    
    var panes = this.getPanes();
    panes.overlayMouseTarget.appendChild(cluster);
    
    this.div_ = cluster;
    var that = this;
    
    google.maps.event.addDomListener(cluster, 'click', function() {
console.log('Cluster got clicked.');
    });
  }
  
  // Implement google.maps.OverlayView().draw()
  Cluster.prototype.draw = function() {
    var lnglat = new google.maps.LatLng(this.center_);
    var pos = this.getProjection().fromLatLngToDivPixel(lnglat);
    var div = this.div_;
    
    div.style.left = pos.x + 'px';
    div.style.top = pos.y + 'px';
  }
  
  // Implement google.maps.OverlayView().onRemove()
  Cluster.prototype.onRemove = function() {
    this.div_.parentNode.removeChild(this.div_);
    this.div_ = null;
  }
  
  Cluster.prototype.addPin = function(pin) {
    if (this.center_ === null) {
      this.center_ = pin.lnglat_;
    }
    else {
      // Average out the center between the cluster and the new pin.
      var l = this.pins_.length;
      var lat = (this.center_.lat * (l-1) + pin.lnglat_.lat) / l;
      var lng = (this.center_.lng * (l-1) + pin.lnglat_.lng) / l;
      
      this.center_ = {'lng': lng, 'lat': lat};
    }
    
    this.pins_.push(pin);
    this.parent_.calculateBounds_(this);
  }
  
  Cluster.prototype.remove = function() {
    this.setMap(null);
  }
  
  window.maps.Cluster = Cluster;
  
  // Backup the existing queue of functions.
  var queue = window.maps.cmd;
  
  // Replace the push function with one that executes the function passed to it.
  window.maps.cmd.push = function () {
    for (var i = 0; i < arguments.length; i++) {
      try {
        if (typeof arguments[i] === "function") {
          arguments[i]();
        }
        else {
          // What to do when given something not a function.
        }
      }
      catch (e) {
        // Error handling.
      }
    }
  }
  
  // Checking if Google Maps API library is available.
  if (typeof window.google === 'object' && window.google.maps) {
    // Google Maps API is already available.
  }
  else {
    var gmk = 'AIzaSyAHxfWXnkykDgMHyenB6h0KPOvH2XqJfrg', // Goole Maps API Key
        cb  = 'mapsInit',
        gms = document.createElement('script'),
        gme = document.getElementsByTagName('script')[0];
  
    window[cb] = function () {
      delete window[cb];

      // Execute all the queued functions
      // apply() turns the array into individual arguments
      window.maps.cmd.push.apply(window.maps.cmd, queue);
    }
  
    // Get Google Maps API library.
    gms.type = 'text/javascript';
    gms.async = true;
    gms.src = 'http://maps.googleapis.com/maps/api/js?key=' + gmk + '&callback=' + cb;
    gme.parentNode.insertBefore(gms, gme);
  }

})();