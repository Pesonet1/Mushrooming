var accessToken = 'pk.eyJ1Ijoic3RpaW4iLCJhIjoiY2l0NnpsN2h5MDAwZjJ1bWZjOGg1d2ltOSJ9.SolRo3rDm25r9tXBTKrnoQ';

function navigateToMush(startLat, startLon, endLat, endLon, travelMode, drawRoute){
    var mode = [travelMode];// walking,driving,cycling + driving can integrate to pg routing

    var points = startLat + "," + startLon + ";" + endLat + "," + endLon;

    var directionsUrl = 'https://api.tiles.mapbox.com/v4/directions/mapbox.' + travelMode + '/' + points + '.json?access_token=' + accessToken;
    console.log("Directionsurl: " + directionsUrl);
    
    $.get(directionsUrl, function(data) {
        var route = data.routes[0].geometry.coordinates;
	route = route.map(function(point) {
            return [point[1], point[0]];
        });

        var multiP  = new ol.geom.MultiPoint();
        var transed = [];
        
	for (var i = 0; i < route.length; i++) {

            var pos = [route[i][1],route[i][0]];

            pos = ol.proj.fromLonLat(pos);
            transed.push(pos);

            var geomPoint = new ol.geom.Point(pos);
            multiP.appendPoint(geomPoint);
        }

        console.log("result was " + route);
        centerPos = ((startLat + endLat)/2)

        //navigation detail
        var distance = data.routes[0].distance;
        var distance_km = Math.floor(distance/1000);
        var distance_m = distance - distance_km*1000;
        var duration = data.routes[0].duration;
        var duration_3600 = duration/3600;
        var duration_h = Math.floor(duration_3600);
        var duration_min = Math.round((duration_3600 - duration_h) * 60);
	var step_length = data.routes[0].steps.length;       
 
	var startpoint = data.routes[0].steps[0].way_name;
	if (startpoint == "") { startpoint = "N/A"; }
        var destination = data.routes[0].steps[step_length-1].way_name;
	if (destination == "") { destination = "N/A"; }        
	
	travelMode = travelMode.charAt(0).toUpperCase() + travelMode.substring(1, travelMode.length);

	if (drawRoute){
            drawMultiplePointsRoute(multiP);
            insertIntoNavigationPage(travelMode, distance_km, distance_m, duration_h, duration_min, startpoint, destination);
        }

    });
}

var vectorLayer = null;

function drawMultiplePointsRoute(multiP){

    clearRoute(false);

    var vectorSource = new ol.source.Vector();
    vectorLayer = new ol.layer.Vector({
        source: vectorSource
    });

    var routePath = new ol.format.Polyline({
    }).readGeometry(multiP);
    routePath.flatCoordinates = multiP.flatCoordinates;
    
    var feature = new ol.Feature({
        type: 'route',
        geometry: routePath
    });

    var routeStyle = new ol.style.Style({
        stroke: new ol.style.Stroke({
            width: 4, color: [255, 0, 0, 0.9]
        })
    });

    feature.setStyle(routeStyle);
    vectorSource.addFeature(feature);

    map.addLayer(vectorLayer);
    view.fit(vectorLayer.getSource().getExtent(),map.getSize());
    sidebar.open('navigation_detail_page');
}


function clearRoute(removeStartPoint = true) {
    if (vectorLayer != null) {
        map.removeLayer(vectorLayer);
        if (removeStartPoint){
            startPoint.setGeometry(null);
        }
    }

    sidebar.close('navigation_detail_page');
}

var startPoint = new ol.Feature();
startPoint.setStyle(new ol.style.Style({
    image: new ol.style.Icon({
        anchor: [0.5, 30],
        anchorXUnits: 'fraction',
        anchorYUnits: 'pixels',
        opacity: 1.0,
        src: '/images/1476820488_Map-Marker-Bubble-Pink.png'
        })
    }));

/*
var startPoint = new ol.Feature();
startPoint.setStyle(new ol.style.Style({
    image: new ol.style.Circle({
        radius: 6,
        fill: new ol.style.Fill({
            color: '#FF0000'
        }),
        stroke: new ol.style.Stroke({
            color: '#000000',
            width: 2
        })
    })
}));
*/
var startPointLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
        features: [startPoint]
    })
});

var initedStartPointLayer = false;
var manuallyChosenStartPoint = null;

function setStartPointClosest(){
	
	sidebar.close(closest_mushroom_page);

    if (!initedStartPointLayer) {
        map.addLayer(startPointLayer);
        initedStartPointLayer = true;
    }

    startPoint.setGeometry(null);

    map.once('click', function(event) {
		sidebar.open("closest_mushroom_page");
        startPoint.setGeometry(new ol.geom.Point(event.coordinate));
        transform = ol.proj.getTransform('EPSG:3857', 'EPSG:4326');
        manuallyChosenStartPoint = transform(event.coordinate);
    });

}

function setStartPointClosestRoute(){
	
	sidebar.close(shortest_path_to_closest_mushroom_page);

    if (!initedStartPointLayer) {
        map.addLayer(startPointLayer);
        initedStartPointLayer = true;
    }

    startPoint.setGeometry(null);

    map.once('click', function(event) {
		sidebar.open("shortest_path_to_closest_mushroom_page");
        startPoint.setGeometry(new ol.geom.Point(event.coordinate));
        transform = ol.proj.getTransform('EPSG:3857', 'EPSG:4326');
        manuallyChosenStartPoint = transform(event.coordinate);
    });

}

function insertIntoNavigationPage(travelMode,distance_km,distance_m,duration_h,duration_min,startpoint,destination){
    document.getElementById("travelmode_navi").innerHTML = travelMode;
    document.getElementById("distance_navi").innerHTML = distance_km + " km " + distance_m + " m";
    //document.getElementById("distance_m_navi").innerHTML = distance_m+"m";
    document.getElementById("duration_navi").innerHTML = duration_h + " h " + duration_min + " min";
    //document.getElementById("duration_min_navi").innerHTML = duration_min+"min";
    document.getElementById("startpoint_navi").innerHTML = startpoint;
    document.getElementById("destination_navi").innerHTML = destination;
    //document.getElementById("duration").innerHTML = duration;

}

