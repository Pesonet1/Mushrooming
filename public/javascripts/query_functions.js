var closestMushroomCoord;
var uniqueNames;

function sendLoginToServer() {

    var username = document.getElementById('username').value;
    var password = document.getElementById('password').value;

    console.log('logging in with username: ' + username + ' and password ' + password);

    var request = $.ajax({
        url: "/api/loginUser",
        type: "POST",
        data: { username: username, password: password },
        cache: false
    });

    request.done(function(msg) {
        console.log(msg);
        if (msg == "validCredentials") {
            window.location.href = "/map";
            var userId = msg[0].user_id;
        }
        if (msg == "invalidCredentials") {
            alert('Invalid username or password!');
            window.location.href = "/login";
        }
        if (msg == "missingCredentials") {
            alert('You have to fill in both a username and a password.');
            window.location.href = "/login";
        }
        if (msg == "error") {
            alert('Something went wrong with the login!');
            window.location.href = "/login";
        }
    });

    request.fail(function(jqXHR, textStatus) {
        console.log(textStatus);
    });
}

function registerNewUser() {

    var username = document.getElementById('username').value;
    var email = document.getElementById('email').value;
    var password = document.getElementById('password').value;

    var request = $.ajax({
        url: "/api/registerUser",
        type: "POST",
        data: { username: username, email: email, password: password },
        cache: false
    });

    request.done(function(msg) {

        if (msg == "validCredentials") {
            console.log("registration successful");
            window.location.href = "/login"; // If the registration is successful - redirect to the login page
        }
        if (msg == "invalidCredentials") {
            alert('The username is already taken. Try another one.');
            window.location.href = "/registerAccount";
        }
        if (msg == "error") {
            alert('Something went wrong with the registration!');
            window.location.href = "/registerAccount";
        }
        if (msg == "missingCredentials") {
            alert('You have to fill in both a username and a password.');
            window.location.href = "/registerAccount";
        }
    });

    request.fail(function(jqXHR, textStatus) {
        console.log(textStatus);
    });
}

function logoutUser() {

    var request = $.ajax({
        url: "/api/logoutUser",
        type: "POST",
        data: {},
        cache: false
    });

    request.done(function(msg) {
        console.log(msg);
        if (msg == "logoutUser") {
            window.location.href = "/";
        } else {
            alert('Something went wrong with the logout!');
        }
    });

    request.fail(function(jqXHR, textStatus) {
        console.log(textStatus);
    });
}

// Autocomplete function for getClosestDesiredMushroomOfSpecificType
function initSearch(availableTags) {

    $("#tags").autocomplete({
        source: availableTags
    });

    $("#tags2").autocomplete({
        source: availableTags
    });
        
}

// For the autocomplete textbox in Find closest desired mushroom of specific type
function getAllDistinctMushroomFindingsSpecies() {

    var request = $.ajax({
        url: "api/getAllDistinctSpecies",
        type: "POST",
        data: {},
        cache: false
    });

    request.done(function(mushroomObject) {

        if (mushroomObject == "noMushrooms") {
            console.log("No mushroom findings were found.");
            return;
        }

        var availableMushrooms = [];
        for (var i = 0; i < mushroomObject.length; i++) {
            var specie = mushroomObject[i].name;
            availableMushrooms.push(specie);
        }
        initSearch(availableMushrooms);
    });

    request.fail(function(jqXHR, textStatus) {
        console.log(textStatus);
    });

}

manuallySetPosition = false;

function manuallySelected_closest(){
    document.getElementById('manual_location_button').disabled = false;
    manuallySetPosition = true;
}

function manuallySelected(){
    document.getElementById('manual_location_navigation_button').disabled = false;
    manuallySetPosition = true;
}

// Get the closest mushroom of a specific type from a given coordinate
function getClosestDesiredMushroom(automatic, shouldNavigate, mushroom_type) {

    if(userCoords == null && !manuallySetPosition){
        window.alert("Couldn't receive any position. Go to the Setting and turn on the geolocation if you didn't provide :)!")
    }

    var latitude = null;
    var longitude = null;

    if(automatic) {
        latitude = userCoords[1];
        longitude = userCoords[0];
    } else {
        latitude = manuallyChosenStartPoint[1];
        longitude = manuallyChosenStartPoint[0];
    }


    // Unselect all features when using the function, remove the popup of it and clear highlighted mushrooms from this function
    selectInteractionHighlight.getFeatures().clear();
    map.removeOverlay(popup);
    highlighted_mushrooms.clear();

    // To be able to call the test function getClosestDesiredMushroom
    if (!mushroom_type) {
        // The mushroom species are in lower case in the DB
        mushroom_type = document.getElementById("tags").value.toLowerCase();
    }

    if (mushroom_type == 'noMushroomTypeSelected') {
        alert("Remember to pick the mushroom type!");
    } else {
        var request = $.ajax({
            url: "/api/getClosestDesiredMushroom",
            type: "POST",
            data: { latitude: latitude, longitude: longitude, mushroom_type: mushroom_type },
            cache: false
        });

        request.done(function(mushroomObject) {

            if (mushroomObject == 'noMushrooms') {
                alert("Couldn't find any mushrooms!");
                return;
            }

            // Accessing properties of the return object
            var mushroom_the_geom = mushroomObject[0].the_geom;
            var specie = mushroomObject[0].name;
            var quantity = mushroomObject[0].quantity;
            var finding_place = mushroomObject[0].finding_place;
            var precision = mushroomObject[0].precision;
            var date = mushroomObject[0].date;
            var comment = mushroomObject[0].comment;
            var biotope = mushroomObject[0].biotope;

            var lon = mushroom_the_geom.coordinates[0];
            var lat = mushroom_the_geom.coordinates[1];
            var coordinates = ol.proj.transform([lon, lat], 'EPSG:4326', 'EPSG:3857');
			
	    // If the getClosestDesiredMushroom is used for routing, add different name for the highlight feature
	    // This can be then used for handling the feature click content differently
	    if (shouldNavigate == true) {
		feature = new ol.Feature({
                    name: 'closestRouteMushroom',
                    geometry: new ol.geom.Point(coordinates),
                    specie: specie,
                    quantity: quantity,
                    finding_place: finding_place,
                    precision: precision,
                    date: date,
                    comment: comment,
                    biotope: biotope
                });

		highlighted_mushrooms.addFeature(feature);

	        var travelMode = $('input[name=travel_mode]:checked').val();
                navigateToMush(longitude, latitude, mushroom_the_geom.coordinates[0], mushroom_the_geom.coordinates[1], travelMode, true);
		
	    } else {
		feature = new ol.Feature({
                    name: 'closestSpecificMushroom',
                    geometry: new ol.geom.Point(coordinates),
                    specie: specie,
                    quantity: quantity,
                    finding_place: finding_place,
                    precision: precision,
                    date: date,
                    comment: comment,
                    biotope: biotope
                });

		highlighted_mushrooms.addFeature(feature);

                // Set the view to the highlighted mushroom layer
                var extent = highlighted_mushroom_layer.getSource().getExtent();
                map.getView().fit(extent, map.getSize());
                map.getView().setZoom(14);

                sidebar.close();
            }

        });

        request.fail(function(jqXHR, textStatus, state) {
            console.log(textStatus);
        });
    }
}

function getAllUserFindings() {

    var request = $.ajax({
        url: "/api/getAllFindings",
        type: "GET",
        data: {},
        cache: false
    });

    request.done(function(mushroomObject) {
 
	if (mushroomObject != "noUserFindings") {	
            for (i = 0; i < mushroomObject.length; i++) {
                lat = mushroomObject[i].lon;
                lon = mushroomObject[i].lat;
                coords = ol.proj.transform([lat, lon], 'EPSG:4326', 'EPSG:3857');

                // Every user point is added to the layer
                insertPoint = new ol.Feature({
                    name: 'getPoint',
                    geometry: new ol.geom.Point(coords),
                    id: mushroomObject[i].id,
                    specie: mushroomObject[i].name,
                    quantity: mushroomObject[i].quantity,
                    unit: mushroomObject[i].unit,
                    finding_place: mushroomObject[i].finding_place,
                    precision: mushroomObject[i].precision,
                    county: mushroomObject[i].county,
                    municipality: mushroomObject[i].municipality,
                    province: mushroomObject[i].province,
                    date: mushroomObject[i].date,
                    comment: mushroomObject[i].comment,
                    biotope: mushroomObject[i].biotope,
                    biotope_desc: mushroomObject[i].biotope_description,
                    substrate: mushroomObject[i].substrate
                });

                highlighted_mushroom_layer.getSource().addFeature(insertPoint);
            }

            // Set the view to the extent of the user inserted points
	    viewPadding = [40, 40, 40, 40];
            extent = highlighted_mushroom_layer.getSource().getExtent();
            map.getView().fit(extent, map.getSize(), {
	        padding: viewPadding,
	        minResolution: 13
	    });
	} else {
	    // If there is no mushroom findings for the user set the view to the center of Sweden
	    map.getView().setCenter(ol.proj.transform([15, 62], 'EPSG:4326', 'EPSG:3857'));
	    map.getView().setZoom(5);
	}

        console.log("Get all findings was successful!");
    });

    request.fail(function(jqXHR, textStatus, state) {
        console.log(textStatus);
    });
}


function insertQuery() {

    // Process the insert query to the database
    mushroom_name = document.getElementById('specie').value;
    quantity = document.getElementById('quantity').value;
    unit = document.getElementById('unit').value;
    finding_place = document.getElementById('finding_place').value;
    precision = document.getElementById('precision').value;
    county = document.getElementById('county').value;
    municipality = document.getElementById('municipality').value;
    province = document.getElementById('province').value;
    date = document.getElementById('date').value;
    comment = document.getElementById('comment').value;
    biotope = document.getElementById('biotope').value;
    biotope_desc = document.getElementById('biotope_desc').value;
    substrate = document.getElementById('substrate').value;

    // This adds default value if the user inserted finding is missing a value
    // Mushroom name is mandatory
    if (quantity == "") { quantity = -1; }
    if (unit == "") { unit = "'' "; }
    if (finding_place == "") { finding_place = "'' "; }
    if (precision == "") { precision = 0; }
    if (county == "") { county = "'' "; }
    if (municipality == "") { municipality = "'' "; }
    if (province == "") { province = "'' "; }
    if (date == "") { date = "'' "; }
    if (comment == "") { comment = "'' "; }
    if (biotope == "") { biotope = "'' "; }
    if (biotope_desc == "") { biotope_desc = "'' "; }
    if (substrate == "") { substrate = "'' "; }

    // Get feature coordinates
    transform = ol.proj.getTransform('EPSG:3857', 'EPSG:4326');
    insertedFeatureCoords = transform(insertCoords);
    latitude = insertedFeatureCoords[1];
    longitude = insertedFeatureCoords[0];

    var request = $.ajax({
        url: "/api/insertFinding",
        type: "POST",
        data: {
            latitude: latitude,
            longitude: longitude,
            mushroom_name: mushroom_name,
            quantity: quantity,
            unit: unit,
            finding_place: finding_place,
            precision: precision,
            county: county,
            municipality: municipality,
            province: province,
            date: date,
            comment: comment,
            biotope: biotope,
            biotope_desc: biotope_desc,
            substrate: substrate
        },
        cache: false
    });

    request.done(function(msg) {
        console.log(msg);

        // Inserting the form data into a feature 
        insertPoint = new ol.Feature({
            name: 'getPoint',
            geometry: new ol.geom.Point(insertCoords),
            specie: mushroom_name,
            quantity: quantity,
            unit: unit,
            finding_place: finding_place,
            precision: precision,
            county: county,
            municipality: municipality,
            province: province,
            date: date,
            comment: comment,
            biotope: biotope,
            biotope_desc: biotope_desc,
            substrate: substrate
        });

        // Insert point and close the sidebar
        highlighted_mushroom_layer.getSource().addFeature(insertPoint);
        sidebar.close('insertinfotab');
    });

    request.fail(function(jqXHR, textStatus, state) {
        console.log(textStatus);
    });

}

function updateQuery() {

    // New values
    mushroom_name = document.getElementById('updateSpecie').value;
    quantity = document.getElementById('updateQuantity').value;
    unit = document.getElementById('updateUnit').value;
    finding_place = document.getElementById('updateFindingPlace').value;
    precision = document.getElementById('updatePrecision').value;
    county = document.getElementById('updateCounty').value;
    municipality = document.getElementById('updateMunicipality').value;
    province = document.getElementById('updateProvince').value;
    date = document.getElementById('updateDate').value;
    comment = document.getElementById('updateComment').value;
    biotope = document.getElementById('updateBiotope').value;
    biotope_desc = document.getElementById('updateBiotope_desc').value;
    substrate = document.getElementById('updateSubstrate').value;

    // Existing values
    existingFeature = highlightFeature.values_;
    id = existingFeature.id;

    // Following compares old values to the new, if the value has been changed then that is the updated value 
    if (mushroom_name == existingFeature.specie || mushroom_name == "") {
        updateMushroomName = existingFeature.specie;
    } else {
        updateMushroomName = mushroom_name;
    }
    if (quantity == existingFeature.quantity || quantity == "") {
        updateQuantity = parseInt(existingFeature.quantity);
    } else {
        updateQuantity = parseInt(quantity);
    }
    if (unit == existingFeature.unit || unit == "") {
        updateUnit = existingFeature.unit;
    } else {
        updateUnit = unit;
    }
    if (finding_place == existingFeature.finding_place || finding_place == "") {
        updateFindingPlace = existingFeature.finding_place;
    } else {
        updateFindingPlace = finding_place;
    }
    if (precision == existingFeature.precision || precision == "") {
        updatePrecision = parseInt(existingFeature.precision);
    } else {
        updatePrecision = parseInt(precision);
    }
    if (county == existingFeature.county || county == "") {
        updateCounty = existingFeature.county;
    } else {
        updateCounty = county;
    }
    if (municipality == existingFeature.municipality || municipality == "") {
        updateMunicipality = existingFeature.municipality;
    } else {
        updateMunicipality = municipality;
    }
    if (province == existingFeature.province || province == "") {
        updateProvince = existingFeature.province;
    } else {
        updateProvince = province;
    }
    if (date == existingFeature.date || date == "") {
        updateDate = existingFeature.date;
    } else {
        updateDate = date;
    }
    if (comment == existingFeature.comment || comment == "") {
        updateComment = existingFeature.comment;
    } else {
        updateComment = comment;
    }
    if (biotope == existingFeature.biotope || biotope == "") {
        updateBiotope = existingFeature.biotope;
    } else {
        updateBiotope = biotope;
    }
    if (biotope_desc == existingFeature.biotope_desc || biotope_desc == "") {
        updateBiotope_desc = existingFeature.biotope_desc;
    } else {
        updateBiotope_desc = biotope_desc;
    }
    if (substrate == existingFeature.substrate || substrate == "") {
        updateSubstrate = existingFeature.substrate;
    } else {
        updateSubstrate = substrate;
    }

    if (typeof id === 'undefined') {
        alert("You cannot update a finding added in this session! \n\n Ps. try refreshing the page...");
    } else {
        var request = $.ajax({
            url: "/api/updateFinding",
            type: "POST",
            data: {
                id: id,
                updateMushroomName: updateMushroomName,
                updateQuantity: updateQuantity,
                updateUnit: updateUnit,
                updateFindingPlace: updateFindingPlace,
                updatePrecision: updatePrecision,
                updateCounty: updateCounty,
                updateMunicipality: updateMunicipality,
                updateProvince: updateProvince,
                updateDate: updateDate,
                updateComment: updateComment,
                updateBiotope: updateBiotope,
                updateBiotope_desc: updateBiotope_desc,
                updateSubstrate: updateSubstrate
            },
            cache: false
        });

        request.done(function(msg) {
            console.log(msg);

            updatePoint = new ol.Feature({
                name: 'getPoint',
                geometry: new ol.geom.Point(existingFeature.geometry.flatCoordinates),
                specie: updateMushroomName,
                quantity: updateQuantity,
                unit: updateUnit,
                finding_place: updateFindingPlace,
                precision: updatePrecision,
                county: updateCounty,
                municipality: updateMunicipality,
                province: updateProvince,
                date: updateDate,
                comment: updateComment,
                biotope: updateBiotope,
                biotope_desc: updateBiotope_desc,
                substrate: updateSubstrate
            });

            // Remove the old feature and insert the updated one
            highlightFeature.setGeometry(null);
            highlighted_mushroom_layer.getSource().addFeature(updatePoint);

            sidebar.close('updateinfotab');
        });

        request.fail(function(jqXHR, textStatus, state) {
            console.log(textStatus);
        });
    }

}

function deleteQuery() {
 
    existingFeature = highlightFeature.values_;
    id = existingFeature.id;

    if (typeof id === 'undefined') {
        alert("You cannot delete a finding added in this session! \n\n Ps. try refreshing the page...");
    } else {
        var request = $.ajax({
            url: "/api/deleteFinding",
            type: "POST",
            data: { id: id },
            cache: false
        });

        request.done(function(msg) {
            console.log(msg);
	    highlightFeature.setStyle(new ol.style.Style({
	        text: new ol.style.Text({
		    textAlign: "center",
		    textBaseline: "middle",
		    text: "Removed",
		    font: "bold 16px Arial",
		    fill: new ol.style.Fill({
			color: 'green',
			width: 20
		    }),
		    stroke: new ol.style.Stroke({
		        color: 'black',
			width: 5
		    }),
		    offsetY: 5
		})
	    }));

            //highlightFeature.setGeometry(null);
        });

        request.fail(function(jqXHR, textStatus, state) {
            console.log(textStatus);
        });
    }

}

function getUniqueNames() {

    var request = $.ajax({
        url: "/api/getUniqueName",
        type: "GET",
        data: {},
        cache: false
    });

    request.done(function(names) {
        console.log(names);
        uniqueNames = [];
        for (var i = 0; i < names.length; i++) {
            uniqueNames.push(names[i]);
        }
    });

    request.fail(function(jqXHR, textStatus, state) {
        console.log(textStatus);
    });
}
