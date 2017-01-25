var map;
var sidebar;
var selectedFeatureCoords;
var vectorSource;
var feature, highlightFeature;
var selectInteraction;
var popup;
var highlighted_mushroom_layer;
var highlighted_mushrooms;
var highlightedMushroomFeatureStyle;
var popupContent;
var isSpaceTimePage;
var mushroom_clusterLayer;
var mostPopularFindingPlace;
var view;
var mapClickEvents;

// Now includes initializing of map, layers and their interaction (WFS), popup
function initMap() {
    isSpaceTimePage = false;
    var maxZoom = 18;

    // Initialize mapseed sidebar and open the home tab
    sidebar = $('#sidebar').sidebar();
    sidebar.open('home');

    // Create the Slick carousel
    $('.mushroomcarousel').slick({
        dots: true,
        mobileFirst: true
    });

    var popupContainer = document.getElementById('popup');
    popupContent = document.getElementById('popup-content');
    var popupCloser = document.getElementById('popup-closer');
    var mushroomInfo = document.getElementById('mushroominfo');
    var existingInfoContent = document.getElementById('existinginfo');

    popup = new ol.Overlay(({
        element: popupContainer,
        autoPan: true,
        autoPanAnimation: {
            duration: 250
        }
    }));

    popupCloser.onclick = function() {
        popup.setPosition(undefined);
        popupCloser.blur();
        return false
    };

    // WFS source for mushroom findings
    vectorSource = new ol.source.Vector({
        format: new ol.format.GeoJSON(),
        url: function(extent, resolution, projection) {
            return "/geoserver/cite/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=cite:mushroom_findings&outputFormat=application%2Fjson&srsname=EPSG:3857&" + 'CQL_FILTER=(bbox(the_geom,' + extent.join(',') +
                ",'EPSG:3857'" + "))";
        },
        strategy: ol.loadingstrategy.tile(ol.tilegrid.createXYZ({}))
    });

    // Default mushroom style
    var mushroomFeatureStyle = new ol.style.Style({
        image: new ol.style.Icon(({
            anchor: [0.5, 40],
            anchorXUnits: 'fraction',
            anchorYUnits: 'pixels',
            src: '/images/mushroom.png'
        }))
    });

    // Highlighted mushroom style
    highlightedMushroomFeatureStyle = new ol.style.Style({
        image: new ol.style.Icon(({
            anchor: [0.5, 40],
            anchorXUnits: 'fraction',
            anchorYUnits: 'pixels',
            src: '/images/highlightedMushroom.png'
        }))
    });

    // Making clusters out of the mushroom finding geojson points
    var mushroom_cluster = new ol.source.Cluster({
        distance: 40, //Too large distances involve too many features into clusters, default 20, 10 was too small
        source: vectorSource
    });

    // Making a layer of these clusters and assigning a styling
    mushroom_clusterLayer = new ol.layer.Vector({
        source: mushroom_cluster,
        style: mushroomFeatureStyle
    });

    // The highlighted mushrooms (the result of functions e.g. "Find the closest mushroom of a specific type"
    highlighted_mushrooms = new ol.source.Vector({});
    
    // Making a layer of the highlighted mushrooms (the result of functions e.g. "Find the closest mushroom of a specific type"
    highlighted_mushroom_layer = new ol.layer.Vector({
        source: highlighted_mushrooms,
        style: highlightedMushroomFeatureStyle
    });

    // WMS
    var mapbox_layer = new ol.layer.Tile({
        source: new ol.source.XYZ({
            url: 'https://api.mapbox.com/styles/v1/pesonet1/ciu5a801400sc2irqwof9ke8c/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoicGVzb25ldDEiLCJhIjoiY2lqNXJua2k5MDAwaDI3bTNmaGZqc2ZuaSJ9.nmLkOlsQKzwMir9DfmCNPg'

            //'https://api.mapbox.com/styles/v1/stiin/cit7lsx18000y2vqn067wj5zy/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1Ijoic3RpaW4iLCJhIjoiY2l0NnpsN2h5MDAwZjJ1bWZjOGg1d2ltOSJ9.SolRo3rDm25r9tXBTKrnoQ'
        })
    });

    // Setting view parameters
    view = new ol.View({
        center: ol.proj.transform([15, 62], 'EPSG:4326', 'EPSG:3857'),
        zoom: 5,
        minZoom: 5,
        maxZoom: maxZoom // Mapbox does not allow to zoom in to far.
    });

    // Declaring a map
    map = new ol.Map({
        layers: [mapbox_layer, mushroom_clusterLayer, highlighted_mushroom_layer],
        overlays: [],
	interactions: ol.interaction.defaults({doubleClickZoom: false}),
        target: 'map',
        view: view
    });

    // To be able to capitalize string - move later
    String.prototype.capitalize = function() {
        return this.charAt(0).toUpperCase() + this.slice(1);
    };

    // Makes the layer mushroom_clusterLayer  selectable
    selectInteractionCluster = new ol.interaction.Select({
        layers: [mushroom_clusterLayer],
        style: mushroomFeatureStyle
    });

    // Makes the layer  highlighted_mushroom_layer selectable
    selectInteractionHighlight = new ol.interaction.Select({
        layers: [highlighted_mushroom_layer],
        style: highlightedMushroomFeatureStyle
    });

    map.getInteractions().extend([selectInteractionCluster]);
    map.getInteractions().extend([selectInteractionHighlight]);
    mushroom_clusterLayer.set('selectable', true);
    highlighted_mushroom_layer.set('selectable', true);

    // Handles the all the WFS mushrooms on click event
    var onMapClickHandleClusterFeatures = function(event) {

        feature = map.forEachFeatureAtPixel(event.pixel, function(feature, layer) {
            if (layer === mushroom_clusterLayer) {
                return feature;
            }
        });

        // Reset the popup content and remove all of the carousel slides
        popupContent.innerHTML = "";
        $('.mushroomcontent').empty();
        $('.mushroomcarousel').slick('removeSlide', null, null, true);

        // if the map click is on feature
        if (feature) {
	
            // Add popup overlay and get the clicked feature coordinates as a variable
            map.addOverlay(popup);
            selectedFeatureCoords = feature.getGeometry().getCoordinates();

            // Forming the content of a popup
            popupContent.innerHTML = "<b>Mushroom species:</b> " + "<br><ul>";

            // Loops through every feature in the cluster
            uniqueCheckArray = [];
            features = feature.get('features');

            // Problem is that the dataset has mushroom findings that has ridiculous amounts of findings of different mushroom type in one location
            if (features.length > 10) {

		sidebar.close();

                if (view.getZoom() == maxZoom) {
                    popupContent.innerHTML = "There are more than 10 mushroom findings registered at this particular spot. Right now the program can't handle this many findings made at the same place. Sorry for the inconvenience!";
                } else {
                    popupContent.innerHTML = "Zoom in closer...";
                }

            } else {
                for (var i = 0; i < features.length; i++) {
                    // Attribute information for every mushroom finding
                    mushroom_name = features[i].get('name');

                    // Checking if the same name is occuring twice in the same feature
                    if (uniqueCheckArray.indexOf(mushroom_name) > -1) {
                        continue
                    } else {
                        uniqueCheckArray.push(mushroom_name);

                        // Attribute information for the rest mushroom findings
                        finding_place = features[i].get('finding_place');
                        precision = features[i].get('precision');
                        quantity = features[i].get('quantity');
                        comment = features[i].get('comment');
                        biotope = features[i].get('biotope');
			county = features[i].get('county');
			province = features[i].get('province');
                        date = features[i].get('date');

                        // Dirty solution for handling the data
                        if (finding_place == "" || finding_place == "'' ") { finding_placce = "N/A"; }
                        if (precision == "") {
                            precision = "N/A";
                        } else {
                            precision = precision + " m";
                        }
                        if (quantity == "-1") { quantity = "N/A"; }
                        if (comment == "" || comment == "'' ") { comment = "N/A"; }
                        if (biotope == "" || biotope == "'' ") { biotope = "N/A"; }
			if (county == "" || county == "'' ") { county = "N/A"; }
			if (province == "" || province == "'' ") { province = "N/A"; }
                        // Format the date to yyyy-mm-dd
                        if (date == "") {
                            date = "N/A";
                        } else {
                            date = date.substring(0, 10);
                        }

                        // If on spaceTimeAnalysis page - disable the mushroom link in popup
                        if (isSpaceTimePage) {
                            popupContent.innerHTML += "<li>" + mushroom_name.capitalize() + "</li>";
                        } else {
                            // Create the HTML content, links with mushroom names
                            popupContent.innerHTML += "<li>" + '<a id=' + mushroom_name + ' href="javascript:void(0);" class="mushroom" onclick="handleMushroomLinks(this);">' +
                            mushroom_name.capitalize() + "</a>" + "</li>";

                            // In future image for every mushroom, naming with the correct mushroom name
                            image = "mushroom";
                            species = mushroom_name.toUpperCase();

                            var myMushroomInfo = "";
                            myMushroomInfo += "<div><h3 align='center'>" + species + "</h3><br>";
                            myMushroomInfo += '<center><img src="/images/' + image + '.ico" style="width:100px;height:100px;"></center>' + "<br><hr>";
                            myMushroomInfo += "<p><b>Date: </b>" + date + "</p>";
                            myMushroomInfo += "<p><b>Quantity: </b>" + quantity + "</p>";
                            myMushroomInfo += "<p><b>Finding place: </b>" + finding_place + "</p>";
                            myMushroomInfo += "<p><b>Precision: </b>" + precision + "</p>";
			    myMushroomInfo += "<p><b>County: </b>" + county + "</p>";
			    myMushroomInfo += "<p><b>Province: </b>" + province + "</p>";
                            myMushroomInfo += "<p><b>Biotope: </b>" + biotope + "</p>";
                            myMushroomInfo += "<p><b>Comment: </b>" + comment + "</p><div>";

                            if (features.length > 1) {
                                // Add every mushroom finding to the carousel
                                $('.mushroomcarousel').slick('slickAdd', myMushroomInfo);
                            } else {
                                $('.mushroomcontent').append(myMushroomInfo);
                            }
                        }

                        // Closing the popup content list
                        popupContent.innerHTML += "</ul>";
                    }
                }
            }

            // Set the popup to the map with the feature coordinates
            popup.setOffset([0, -35]);
            popup.setPosition(selectedFeatureCoords);
            return true;
        } else {
            return false;
	}
    };


    // Handles the mushrooms that are the result of functions (e.g. The result of "Find the closest mushroom of specific type" on click event
    var onMapClickHandleHighlightedFeatures = function(event) {

        highlightFeature = map.forEachFeatureAtPixel(event.pixel, function(highlightFeature, layer) {
            if (layer === highlighted_mushroom_layer) {
                return highlightFeature;
            }
        });

        // Reset the popup content
        popupContent.innerHTML = "";
        map.removeOverlay(popup);

        // if the map click is on feature
        if (highlightFeature) {

	    if (highlightFeature.values_.name == 'closestRouteMushroom') {	
		// Add popup overlay and get the clicked feature coordinates as a variable
                map.addOverlay(popup);
                selectedFeatureCoords = highlightFeature.getGeometry().getCoordinates();
		
		// Forming the content of a popup
                var myHtml = "";

		specie = highlightFeature.get('specie');
                quantity = highlightFeature.get('quantity');
                finding_place = highlightFeature.get('finding_place');
                precision = highlightFeature.get('precision');
                date = highlightFeature.get('date');
                comment = highlightFeature.get('comment');
                biotope = highlightFeature.get('biotope');

                // To be able to capitalize string - move later
                String.prototype.capitalize = function() {
                    return this.charAt(0).toUpperCase() + this.slice(1);
                };

                // Dirty solution for handling the data
                if (finding_place == "" || finding_place == "'' ") { finding_place = "N/A"; }
                if (precision == "") {
                    precision = "N/A";
                } else {
                    precision = precision + " m";
                }
                if (quantity == "-1") { quantity = "N/A"; }
                if (comment == "" || comment == "'' ") { comment = "N/A"; }
                if (biotope == "" || biotope == "'' ") { biotope = "N/A"; }
                // Format the date to yyyy-mm-dd
                if (date == "") {
                    date = "N/A";
                } else {
                    var localDate = new Date(date);
                    var localDateString = dateFormat(localDate, 'yyyy-mm-dd');
                }

                myHtml += "<b>This is the closest <i>" + specie + "</i></b>";
                myHtml += "<br><br><ul>";
                myHtml += "<li>Finding place: " + finding_place.capitalize() + "</li>";
                myHtml += "<li>Precision: " + precision + "</li>";
                myHtml += "<li>Quantity: " + quantity + "</li>";
                myHtml += "<li>Date: " + localDateString + "</li>";
                myHtml += "<li>Comment: " + comment + "</li>";
                myHtml += "<li>Biotope: " + biotope + "</li>";
                myHtml += "</ul>";
		myHtml += "<button type=\"button\" class=\"btn btn-info\" onclick=\"sidebar.open('navigation_detail_page');\">Info</button>" + " ";
		myHtml += "<button type=\"button\" class=\"btn btn-danger\" onclick=\"clearSelection();clearRoute();\">Clear</button>";

                popupContent.innerHTML = myHtml;

                // Set the popup to the map with the feature coordinates
                popup.setPosition(selectedFeatureCoords);
                popup.setOffset([0, -35]);
                return true;

	    }
            // If the highlighted feature is user inserted
            if (highlightFeature.values_.name == "getPoint") {
                value = highlightFeature.values_;
                image = "mushroom";

                if (value.quantity == -1) { quantity = "N/A"; } else { quantity = value.quantity; }
                if (value.unit == "'' ") { unit = "N/A"; } else { unit = value.unit; }
                if (value.finding_place == "'' ") { finding_place = "N/A"; } else { finding_place = value.finding_place; }
                if (value.precision == 0) { precision = "N/A"; } else { precision = value.precision; }
                if (value.county == "'' ") { county = "N/A"; } else { county = value.county; }
                if (value.municipality == "'' ") { municipality = "N/A"; } else { municipality = value.municipality; }
                if (value.province == "'' ") { province = "N/A"; } else { province = value.province; }
                if (value.date == "'' ") { date = "N/A"; } else { date = value.date.substring(0, 10); }
                if (value.comment == "'' ") { comment = "N/A"; } else { comment = value.comment; }
                if (value.biotope == "'' ") { biotope = "N/A"; } else { biotope = value.biotope; }
                if (value.biotope_desc == "'' ") { biotope_desc = "N/A"; } else { biotope_desc = value.biotope_desc; }
                if (value.substrate == "'' ") { substrate = "N/A"; } else { substrate = value.substrate; }

                existingInfoContent.innerHTML = "<div><center><img src='/images/" + image + ".ico' style='width:60px;height:60px;'></center><hr>" +
                    "<label>Specie: </label>" + value.specie + "<br />" +
                    "<label>Quantity: </label>" + quantity + "<br />" +
                    "<label>Unit: </label>" + unit + "<br />" +
                    "<label>Finding place: </label>" + finding_place + "<br />" +
                    "<label>Precision: </label>" + precision + "<br />" +
                    "<label>County: </label>" + county + "<br />" +
                    "<label>Municipality: </label>" + municipality + "<br />" +
                    "<label>Province: </label>" + province + "<br />" +
                    "<label>Date: </label>" + date + "<br />" +
                    "<label>Comment: </label>" + comment + "<br />" +
                    "<label>Biotope: </label>" + biotope + "<br />" +
                    "<label>Biotope Description: </label>" + biotope_desc + "<br />" +
                    "<label>Substrate: </label>" + substrate + "</div>";
	
                sidebar.open('existingfindinginfotab');

                return true;

            } else {

                // Add popup overlay and get the clicked feature coordinates as a variable
                map.addOverlay(popup);
                selectedFeatureCoords = highlightFeature.getGeometry().getCoordinates();

                // Forming the content of a popup
                var myHtml = "";
                // If the clicked feature is the return of the findMostPopularFindingPlace in stp
                if (mostPopularFindingPlace) {
                    myHtml += "This is the most popular mushroom finding place in the area with " + mostPopularFindingCount + " recorded mushroom findings.<br><br>" ;
                    myHtml += "<button type=\"button\" class=\"btn btn-danger\" onclick=\"clearSelection();\">Clear selection</button>";
                    popupContent.innerHTML = myHtml;
                    // Set the popup to the map with the feature coordinates
                    popup.setPosition(selectedFeatureCoords);
                    popup.setOffset([0, -35]);
                    return true;
                }

                specie = highlightFeature.get('specie');
                quantity = highlightFeature.get('quantity');
                finding_place = highlightFeature.get('finding_place');
                precision = highlightFeature.get('precision');
                date = highlightFeature.get('date');
                comment = highlightFeature.get('comment');
                biotope = highlightFeature.get('biotope');

                // To be able to capitalize string - move later
                String.prototype.capitalize = function() {
                    return this.charAt(0).toUpperCase() + this.slice(1);
                };

                // Dirty solution for handling the data
                if (finding_place == "" || finding_place == "'' ") { finding_place = "N/A"; }
                if (precision == "") {
                    precision = "N/A";
                } else {
                    precision = precision + " m";
                }
                if (quantity == "-1") { quantity = "N/A"; }
                if (comment == "" || comment == "'' ") { comment = "N/A"; }
                if (biotope == "" || biotope == "'' ") { biotope = "N/A"; }
                // Format the date to yyyy-mm-dd
                if (date == "") {
                    date = "N/A";
                } else {
                    var localDate = new Date(date);
                    var localDateString = dateFormat(localDate, 'yyyy-mm-dd');
                }

                myHtml += "<b>This is the closest <i>" + specie + "</i></b>";
                myHtml += "<br><br><ul>";
                myHtml += "<li>Finding place: " + finding_place.capitalize() + "</li>";
                myHtml += "<li>Precision: " + precision + "</li>";
                myHtml += "<li>Quantity: " + quantity + "</li>";
                myHtml += "<li>Date: " + localDateString + "</li>";
                myHtml += "<li>Comment: " + comment + "</li>";
                myHtml += "<li>Biotope: " + biotope + "</li>";
                myHtml += "</ul>";
		myHtml += "<button type=\"button\" class=\"btn btn-danger\" onclick=\"clearSelection();\">Clear selection</button>";

                popupContent.innerHTML = myHtml;

                // Set the popup to the map with the feature coordinates
                popup.setPosition(selectedFeatureCoords);
                popup.setOffset([0, -35]);
                return true;
            }
        } else {
            return false;
	}
    };

    mapClickEvents = [];
    mapClickEvents.push(onMapClickHandleHighlightedFeatures);
    mapClickEvents.push(onMapClickHandleClusterFeatures);
    // Creates a popup every time a user click on a feature. If the click is not a feature don't add a popup
    map.on('click', function(event) {

        for (var i = 0; i < mapClickEvents.length; i++) {
            var clickEvent = mapClickEvents[i];
	    if (clickEvent(event)) {
	        return;
	    }
        }
	
        // if the click isn't a feature remove the popup
        map.removeOverlay(popup);
        sidebar.close();
	
    });

    // Load the tags for autocomplete textbox for Find closest mushroom of specific type
    availableMushrooms = getAllDistinctMushroomFindingsSpecies();

}

function handleMushroomLinks(link) {

    // Idea is to go through every feature to find the matching one for the link id
    // This is because then the clicked link is matched to the correct mushroom info according to the mushroom species
    features = feature.get('features');
    for (var i = 0; i < features.length; i++) {
        // Attribute information for every mushroom finding
        mushroom_name = features[i].get('name');

        // If the link name is the same as the mushroom name
        if (mushroom_name.indexOf(link.id) !== -1) {
            // Change to the carousel view to the link clicked one
            $('.mushroomcarousel').slick('slickGoTo', i);
            sidebar.open("info");
            break;
        } else {
            continue;
        }
    }
}

function clearSelection() {
    // Unselect all features when using the function, remove the popup of it and clear highlighted mushrooms from this function
    selectInteractionHighlight.getFeatures().clear();
    map.removeOverlay(popup);
    highlighted_mushrooms.clear();
}
