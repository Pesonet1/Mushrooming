userCoords = null;

// onClick Function
var hasbeenchecked = false;
var hasbeencentered = false;
var firstTime = false;
//document.getElementById("myonoffswitch")= false;

// Initialize the location
function initLocation(){
    firstTime = true;
    console.log(firstTime);
    autoLocationClicked(document.getElementById('myonoffswitch'));
}

// marker image
var currentPositionMarker = new ol.Feature();
currentPositionMarker.setStyle(new ol.style.Style({
    image: new ol.style.Icon({
        anchor: [0.5, 30],
        anchorXUnits: 'fraction',
        anchorYUnits: 'pixels',
        opacity: 1.0,
        src: '/images/1476820588_Map-Marker-Bubble-Azure.png'
    })
}));

function updatePositionMap(){
    var coordinate = geolocation.getPosition();
    userCoords = geolocation.position_;
    console.log("Current Location is:" + coordinate);

    // Change button
    document.getElementById("myonoffswitch").checked = true;

    var acc = geolocation.getAccuracyGeometry();
    if(acc != null) {
        accuracyFeature.setGeometry(geolocation.getAccuracyGeometry());
    }
    
    currentPositionMarker.setGeometry(new ol.geom.Point(coordinate));

    if(!hasbeencentered) {
        view.setCenter(coordinate);
		view.setZoom(13);
        hasbeencentered = true;
    }
}

function positionUpdatingError(error){
    console.log(error);
}


function autoLocationClicked(checkbox){
    if (checkbox.checked  || firstTime) {
        hasbeenchecked = true;
        firstTime = false;

        document.getElementById("myonoffswitch").checked = false;
        geolocation = new ol.Geolocation({
            projection: map.getView().getProjection(),
            tracking: true,
            trackingOptions: {
             enableHighAccuracy: true
            }
        });

        accuracyFeature = new ol.Feature();
        accuracyBuffer = new ol.layer.Vector({
            map: map,
            source: new ol.source.Vector({
                features: [accuracyFeature, currentPositionMarker]
            })
        });

        geolocation.on('change:position', updatePositionMap);
        console.log("Auto Location has been turned on");

        geolocation.on('error', positionUpdatingError);

    }
    else {
        if (hasbeenchecked)
            checkbox.checked = false;
        if (typeof geolocation !== 'undefined') {
        geolocation.un('change:position', updatePositionMap);
        console.log("Auto Location has been turned off");

        accuracyBuffer.getSource().clear();
        map.removeLayer(accuracyBuffer);

        geolocation.un('error', positionUpdatingError);
            userCoords = null;
        }
    }
}

function currentPosition(){

    if(userCoords == null){
        window.alert("Couldn't receive any position. Go to the Setting and turn on the geolocation if you didn't provide :)!")
		initMap();
	}

    var coordinate = geolocation.getPosition();
    view.setCenter(coordinate);
	view.setZoom(13);
}
