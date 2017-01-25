var insertCoords, insertPoint;
             
function crud() {
 
    sidebar.open('home');

    // This will load every user finding to the map
    getAllUserFindings();

    // Nature areas WFS source for restricting the finding insertion
    vectorSourceNatureAreas = new ol.source.Vector({
        format: new ol.format.GeoJSON(),
        url: function(extent, resolution, projection) {
            return "/geoserver/cite/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=cite:nature_areas&outputFormat=application%2Fjson&srsname=EPSG:3857&" + 'CQL_FILTER=(bbox(the_geom,' + extent.join(',') +
                ",'EPSG:3857'" + "))";
        },
        strategy: ol.loadingstrategy.tile(ol.tilegrid.createXYZ({}))
    });    

    natureAreas = new ol.layer.Vector({
  	source: vectorSourceNatureAreas,
	style: new ol.style.Style({
	    stroke: new ol.style.Stroke({
	        color: 'green',
		width: 1
	    }),
	    fill: new ol.style.Fill({
		color: 'rgba(64, 139, 64, 0.5)'
	    })
	})
    });

    // Add the nature areas layer after the mapbox layer and set the visibility false
    layers = map.getLayers();
    layers.insertAt(1, natureAreas);
    natureAreas.setVisible(false);

    // Check the visibility of the nature area layer -> restrict the load of features
    map.getView().on('change:resolution', function (event) {
        if (map.getView().getZoom() > 11) {
            natureAreas.setVisible(true);
        }
        if (map.getView().getZoom() < 11) {
            natureAreas.setVisible(false);
        }
    });    


    // Insert finding button eventlistener
    insertInfoContent = document.getElementById('insertinfo');
    insertPointButton = document.getElementById('insert');
    insertPointButton.addEventListener('click', function(event) {
      	sidebar.close('your_findings');
        map.once('click', function(event) {
	    feature = map.forEachFeatureAtPixel(event.pixel, function(feature, layer) {
	       if (layer === natureAreas) {
		   return feature;
	       }
	    });

	    if (feature) {		
                image = "mushroom";

                // Format the day already
                date = new Date();
                month = date.getMonth() + 1;
                day = date.getDate();

                if (month < 10) {month = "0" + month;}
                if (day < 10) {day = "0" + day;}

                fulldate = date.getFullYear() + "-" + month + "-" + day;

                // Form is calling a insertQuery() function in query_functions.js
	        insertInfoContent.innerHTML = 
		    "<div><center><img src='/images/" + image + ".ico' style='width:60px;height:60px;'></center><hr>" +
            	    "<form role='form' autocomplete='off' action='javascript:insertQuery()'>" +
                        "<label>* Specie: </label> <input type='text' id='specie'><br />" +
                        "<label>Quantity: </label> <input type='text' id='quantity'><br />" +
                        "<label>Unit: </label> <input type='text' id='unit'><br />" +
                        "<label>* Finding place: </label> <input type='text' id='finding_place'><br />" +
                        "<label>Precision: </label> <input type='text' id='precision'><br />" +
                        "<label>* County: </label> <input type='text' id='county'><br />" +
                        "<label>Municipality: </label> <input type='text' id='municipality'><br />" +
                        "<label>* Province: </label> <input type='text' id='province'><br />" +
                        "<label>* Date: </label> <input type='text' id='date' value='" + fulldate + "'><br />" +
                        "<label>Comment: </label> <input type='text' id='comment'><br />" +
                        "<label>Biotope: </label> <input type='text' id='biotope'><br />" +
                        "<label>Biotope description: </label> <input type='text' id='biotope_desc'><br />" +
                        "<label>Substrate: </label> <input type='text' id='substrate'><br />" +
                        "<br><input type='submit' class='btn btn-info' value='INSERT' onclick='return checkInsert();'>" + " " + 
			"<button type='button' class='btn btn-warning' onclick='sidebar.close()'>ABORT</button>" +
                    "</form></div>";	

                insertCoords = event.coordinate;
                sidebar.open('insertinfotab');
	    }

        });
    });

    // Delete finding button eventlistener
    deletePointButton = document.getElementById('delete');
    deletePointButton.addEventListener('click', function(event) {
        var ask = confirm("Are you sure that you want to delete this mushroom finding?");
        if (ask == true) {
            sidebar.close('existingfindinginfotab');
            deleteQuery();
        } else {
            console.log("Your finding will a survive another day...");
        }
    });
 
    // Update finding button eventlistener
    updateInfoContent = document.getElementById('updateinfo');
    updatePointButton = document.getElementById('update');
    updatePointButton.addEventListener('click', function(event) {
        value = highlightFeature.values_;
	image = "mushroom";

	date = value.date.substring(0, 10);
	if (value.quantity == -1) { quantity =  ""; } else { quantity = value.quantity }
	if (value.precision == 0) { precision = ""; } else { precision = value.precision }
	
        // Form is calling a updateQuery() function in query_functions.js
	updateInfoContent.innerHTML = 
            "<form role='form' autocomplete='off' action='javascript:updateQuery()'>" +
            	"<label>Specie: </label> <input type='text' id='updateSpecie' placeholder=" + value.specie + "><br />" +
            	"<label>Quantity: </label> <input type='text' id='updateQuantity' placeholder=" + quantity + "><br />" +
            	"<label>Unit: </label> <input type='text' id='updateUnit' placeholder=" + value.unit + "><br />" +
            	"<label>Finding place: </label> <input type='text' id='updateFindingPlace' placeholder=" + value.finding_place + "><br />" +
            	"<label>Precision: </label> <input type='text' id='updatePrecision' placeholder=" + precision + "><br />" +
            	"<label>County: </label> <input type='text' id='updateCounty' placeholder=" + value.county + "><br />" +
           	"<label>Municipality: </label> <input type='text' id='updateMunicipality' placeholder=" + value.municipality + "><br />" +
            	"<label>Province: </label> <input type='text' id='updateProvince' placeholder=" + value.province + "><br />" +
           	"<label>Date: </label> <input type='text' id='updateDate' placeholder=" + date + "><br />" +
            	"<label>Comment: </label> <input type='text' id='updateComment' placeholder=" + value.comment + "><br />" +
            	"<label>Biotope: </label> <input type='text' id='updateBiotope' placeholder=" + value.biotope + "><br />" +
            	"<label>Biotope description: </label> <input type='text' id='updateBiotope_desc' placeholder=" + value.biotope_desc + "><br />" +
            	"<label>Substrate: </label> <input type='text' id='updateSubstrate' placeholder=" + value.substrate + "><br />" +
            	"<br><input type='submit' class='btn btn-info' value='UPDATE' onclick='return checkUpdate();'>" + " " + 
		"<button type='button' class='btn btn-warning' onclick='sidebar.close()'>ABORT</button>" + 
            "</form></div>";


        sidebar.open('updateinfotab');
    });

    // Finally load all unique names for the form checks
    getUniqueNames();
}

// Checks the user inserted mushroom finding info
function checkInsert() {

    var insertValues = ['specie', 'quantity', 'unit', 'finding_place', 'precision', 'county', 'municipality', 'province', 'date', 'comment', 'biotope', 'biotope_desc', 'substrate'];	

    // Check that specie, finding_place, couny, province, date  fields are not empty
    if (document.getElementById(insertValues[0]).value  == "" || document.getElementById(insertValues[3]).value == "" || document.getElementById(insertValues[5]).value  == "" || document.getElementById(insertValues[7]).value  == "" || document.getElementById(insertValues[8]).value  == "") {
	alert("Remember to fill the following fields:\n\n" + 
	    "    • Specie\n" + 
	    "    • Finding Place\n" + 
	    "    • County\n" + 
	    "    • Province\n" + 
	    "    • Date\n");
	return false;
    } 

    // Check that specie field cannot start with captialized letter
    if (document.getElementById(insertValues[0]).value[0] == document.getElementById(insertValues[0]).value[0].toUpperCase()) {
	alert("Remember to write specie with lower cased letters!!");
        return false;
    }
	  
    // Check that if specie field exist in the mushroom_data table
    if (document.getElementById(insertValues[0]).value != "") {
        list = [];
        for (var i = 0; i < uniqueNames.length; i++) {
	    if (document.getElementById(insertValues[0]).value == uniqueNames[i].name) {
	        list.push(uniqueNames[i].name);
	    }
	}

	if (list.length < 1) {
	    alert("Specie couldn't be found from the real mushroom species!");
	    return false;
	}
    }
 
    // If the quantity and precision are not integers
    if (isNaN(document.getElementById(insertValues[1]).value) == true || isNaN(document.getElementById(insertValues[4]).value) == true) {
	alert("Quantity and Precision has to be integer!");
        return false;
    }  

    // Check that inserted date is in the correct form -> its not perfect
    date = document.getElementById(insertValues[8]).value;
    if (date != "") {
        alertText = "Date is in wrong format!\n\nCorrect one is year-month-day -> xxxx-xx-xx";
	dateValues = date.split('-');
	var year = parseInt(dateValues[0]), month = parseInt(dateValues[1]), day = parseInt(dateValues[2]);

	// Check if the date is in correct length
	if (date.length > 10 || date.length < 10) {
	    alert(alertText);
	    return false;
	}

	// Check if the year, month and day are exceeding the max
	if (year > new Date().getFullYear() || month > 12 || day > 31) {
	    alert("Check the year, month and day!");
	    return false;
	}	

	// Loop through the date and see if it has correct characters
	checkLine = [];
	for (var i = 0; i < date.length; i++) {
	    if (isNaN(date[i]) == false) {
		checkLine = [];
		continue;
	    } else {
	        if (date[i] == "-" && checkLine.length < 1) {
		    checkLine += 1;
		    continue;
	 	} else {
		    alert(alertText);
		    return false;
		}
	    }
        }	
    }
   
}
 
// Checks the user updated mushroom findings info
function checkUpdate() {   

    var updateValues = ['updateSpecie', 'updateQuantity', 'updateUnit', 'updateFindingPlace', 'updatePrecision', 'updateCounty', 'updateMunicipality', 'updateProvince', 'updateDate', 'updateComment', 'updateBiotope', 'updateBiotope_desc', 'updateSubstrate'];

    // Check that specie field cannot start with captialized letter
    specie = document.getElementById(updateValues[0]).value;
    if (specie != "") {
        if (specie[0] == specie[0].toUpperCase()) {
	    alert("No uppercase letters in specie!");
            return false;
        }
    }

    // Check that if specie field exist in the mushroom_data table
    if (document.getElementById(updateValues[0]).value != "") {
        list = [];
        for (var i = 0; i < uniqueNames.length; i++) {
	    if (document.getElementById(updateValues[0]).value == uniqueNames[i].name) {
	        list.push(uniqueNames[i].name);
	    }
	}

	if (list.length < 1) {
	    alert("Specie couldn't be found from the real mushroom species!");
	    return false;
	}
    }

    // If the quantity and precision are not integers
    if (isNaN(document.getElementById(updateValues[1]).value) == true || isNaN(document.getElementById(updateValues[4]).value) == true) {
	alert("Quantity and Precision has to be integer!");
        return false;
    }

    // Check that inserted date is in the correct form -> its not perfect
    date = document.getElementById(updateValues[8]).value;
    if (date != "") {
        alertText = "Date is in wrong format!\n\nCorrect one is year-month-day -> xxxx-xx-xx";
	dateValues = date.split('-');
	var year = parseInt(dateValues[0]), month = parseInt(dateValues[1]), day = parseInt(dateValues[2]);

	// Check if the date is in correct length
	if (date.length > 10 || date.length < 10) {
	    alert(alertText);
	    return false;
	}

	// Check if the year, month and day are exceeding the max
	if (year > new Date().getFullYear() || month > 12 || day > 31) {
	    alert("Check the year, month and day!");
	    return false;
	}	

	// Loop through the date and see if it has correct characters
	checkLine = [];
	for (var i = 0; i < date.length; i++) {
	    if (isNaN(date[i]) == false) {
		checkLine = [];
		continue;
	    } else {
	        if (date[i] == "-" && checkLine.length < 1) {
		    checkLine += 1;
		    continue;
	 	} else {
		    alert(alertText);
		    return false;
		}
	    }
        }
    }
	 
}
