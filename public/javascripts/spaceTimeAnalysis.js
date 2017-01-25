/**
 * Created by ministini on 2016-10-06.
 */
var spaceTimeLayer;
var selectInteractionspaceTimeLayer;
var draw;
var selectedFeature;
var myPieChart = null;
var myLineChart = null;
var vector;

function spaceTimeAnalysis() {

    isSpaceTimePage = true;

    features = new ol.Collection();
    source = new ol.source.Vector({ features: features });
    spaceTimeLayer = new ol.layer.Vector({
        source: source,
        style: new ol.style.Style({
            fill: new ol.style.Fill({
                color: 'rgba(255, 255, 255, 0.5)'
            }),
            stroke: new ol.style.Stroke({
                color: '#3f6616',
                width: 4
            })
        })
    });

    var modify = new ol.interaction.Modify({
        features: features,
        type: 'Polygon'
    });
    map.addInteraction(modify);

    modify.on('modifyend', function(e) {

        e.features.forEach(function(element) {
            // If the polygon is modified - update polygon geometry in DB
            var modifyFeature = element;
            var format = new ol.format.WKT();
            var this_wkt = format.writeFeature(modifyFeature, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
            var this_featureID = modifyFeature.getId();

            updatePolyIntoDb(this_featureID, this_wkt);
        });
    });

    // spaceTimeLayer Style
    var selectInteractionspaceTimeLayerStyle = new ol.style.Style({
        fill: new ol.style.Fill({
            color: 'rgba(255, 255, 255, 0.5)'
        }),
        stroke: new ol.style.Stroke({
            color: '#d9534f',
            width: 5
        })
    });

    selectInteractionspaceTimeLayer = new ol.interaction.Select({
        layers: [spaceTimeLayer],
        style: selectInteractionspaceTimeLayerStyle
    });
    map.getInteractions().extend([selectInteractionspaceTimeLayer]);
    spaceTimeLayer.set('selectable', true);

    map.addLayer(spaceTimeLayer);

    getAllPolyFromDb(spaceTimeLayer);

    // Handles the spaceTime polygons that are drawn by user
    // Creates a popup with Delete, Analyse, Most Popular options when user click on a spaceTime polygon.
    var onMapClickHandleSpaceTimeFeatures = function(event) {

        feature = map.forEachFeatureAtPixel(event.pixel, function(feature, layer) {
            if (layer === spaceTimeLayer) {
                return feature;
            }
        });

        if (feature) {
            selectedFeature = feature;
            map.addOverlay(popup);
            var thisFeatureID = feature.getId();
            popupContent.innerHTML = "";
            popupContent.innerHTML = "<p style=\"text-align:center\"> What do you want to do?</p>";
            popupContent.innerHTML += " <button type=\"button\" class=\"btn btn-info center-block\" id='mostPopularFindingPlace'>Most popular</button><br>";
            popupContent.innerHTML += " <button type=\"button\" class=\"btn btn-info center-block\" id='analyseArea'>Analyse area</button><br>";
            popupContent.innerHTML += " <button type=\"button\" class=\"btn btn-danger center-block\" id='deletePolygon'>Delete area</button>";
            $('#mostPopularFindingPlace').button();
            $('#mostPopularFindingPlace').on('click', function() {
                sidebar.close();
                findMostPopularFindingPlace(thisFeatureID);
                map.removeOverlay(popup);
            });
            $('#analyseArea').button();
            $('#analyseArea').on('click', function() {
                sidebar.close();
                analyseArea(thisFeatureID);
                $('#cumulativeFindings').trigger('click');
            });
            $('#deletePolygon').button();
            $('#deletePolygon').on('click', function() {
                deletePolyInDb(feature, thisFeatureID);

            });

            // Set the popup to the map with the feature coordinates
            var selectedFeatureCoords = feature.getGeometry().getCoordinates();
            popup.setOffset([0, 0]);
            popup.setPosition(selectedFeatureCoords[0][0]);

            return true;
        }
        return false;
    };

    // Adds a click event to polygon layer
    mapClickEvents.push(onMapClickHandleSpaceTimeFeatures);

    // WATCH OUT! TECH DEBT! ROAD TO DESTRUCTION - HARD CODED CLICK EVENTS - DANGER ZONE IF ANY CLICK EVENTS ARE ADDED, CHANGED OR REMOVED - FIX ME!
    mapClickEvents = [mapClickEvents[0], mapClickEvents[2], mapClickEvents[1]];

    draw = null;
    selectedFeature = null;
    $(document).on('keyup', function(e) {
        if (e.keyCode === 27) {
            draw.removeLastPoint();
        }
        if (e.keyCode === 46) {
            map.removeInteraction(draw);
            delete draw;
            if (selectedFeature) {
                deletePolyInDb(selectedFeature, selectedFeature.getId());
            }
        }
    });
}

// Creates a unique ID that will not be repeated
// Thanks to good fellow on stackoverflow (missing link..)
function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4();
}

function drawPolygon() {

    draw = new ol.interaction.Draw({
        features: features,
        type: 'Polygon'
    });

    map.addInteraction(draw);

    draw.on('drawstart', function(evt) {
        selectedFeature = null;
    });

    draw.on('drawend', function(e) {

        var id = guid();
        e.feature.featureID = id;
        var featureID = e.feature.featureID;
        e.feature.setId(featureID);

        var format = new ol.format.WKT();
        var wkt = format.writeFeature(e.feature, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });

        map.removeInteraction(draw);
        insertPolyIntoDb(featureID, wkt);
    });
}

function analyseArea(featureID) {

    if (myPieChart != null) {
        myPieChart.destroy();
    }
    if (myLineChart != null) {
        myLineChart.destroy();
    }

    map.removeOverlay(popup);

    var request = $.ajax({
        url: "/api/stpAnalyse",
        type: "POST",
        data: { id: featureID },
        cache: false
    });

    request.done(function(mushroomObject) {

        if (mushroomObject == "noMushroomFindings") {
            alert("No mushroom findings were found in this area.");
            map.removeOverlay(popup);
            return;
        }

        function newDateString() {
            return moment().format('YYYY-MM-DD');
        }

        // For the line chart
        var dateQuantity = {};
        var dateLabels = [];
        var dateQuantityData = [];

        // For the pie chart
        var speciesQuantity = {};
        var speciesLabels = [];
        var speciesQuantityData = [];

        for (var i = 0; i < mushroomObject.length; i++) {

            // Accessing properties of the return object
            var mushroom_finding_id = mushroomObject[i].mushroom_findings_id;
            var species = mushroomObject[i].name.capitalize();
            quantity = mushroomObject[i].quantity;
            var date = mushroomObject[i].date;

            // Assumption: if a user has not provided quantity - (at least) one mushroom was found.
            // Solution: treat N/A findings as quantity = 1.
            if (quantity === -1) { quantity = 1 }
            var localDate = new Date(date);
            var localDateString = dateFormat(localDate, 'yyyy-mm-dd');

            // For line chart
            if (!(localDateString in dateQuantity)) {
                dateQuantity[localDateString] = 0;
            }
            var subtotalDate = dateQuantity[localDateString];
            dateQuantity[localDateString] = subtotalDate + quantity; //= cumulative_quantity;

            // For pie chart
            if (!(species in speciesQuantity)) {
                speciesQuantity[species] = 0;
            }
            var subTotalSpecies = speciesQuantity[species];
            speciesQuantity[species] = subTotalSpecies + quantity;

        }
        // For line chart
        // To create dates with associated cumulative quantity
        // The last date is today's date - with the cumulative quantity of the last date with logged findings
        for (key in dateQuantity) {
            dateLabels.push(key);
            dateQuantityData.push(dateQuantity[key]);
        }

        // Sort
        var sortedData = [];
        for (var idx in dateLabels)
            sortedData.push({ 'date': dateLabels[idx], 'quantity': dateQuantityData[idx] });

        //2) sort:
        sortedData.sort(function(a, b) {
            return ((a.date < b.date) ? -1 : ((a.date == b.date) ? 0 : 1));
            //Sort could be modified to, for example, sort on the age
            // if the name is the same.
        });

        //3) separate them back out:
        var cumulative_quantity = 0;
        for (var idx = 0; idx < sortedData.length; idx++) {
            dateLabels[idx] = sortedData[idx].date;
            cumulative_quantity += sortedData[idx].quantity
            dateQuantityData[idx] = cumulative_quantity;
        }

        var now = newDateString();
        dateLabels.push(now);
        dateQuantityData.push(cumulative_quantity);

        // For pie chart
        // To get all distinct species and the associated quantity of each species
        for (key in speciesQuantity) {
            speciesLabels.push(key);
            speciesQuantityData.push(speciesQuantity[key]);
        }

        var dateData = {
            labels: dateLabels,
            datasets: [{
                data: dateQuantityData,
                label: "Cumulative findings",
                fill: true,
                lineTension: 0.1,
                backgroundColor: "rgba(75,192,192,0.4)",
                borderColor: "rgba(75,192,192,1)",
                borderCapStyle: 'butt',
                borderDash: [],
                borderDashOffset: 0.0,
                borderJoinStyle: 'miter',
                pointBorderColor: "rgba(75,192,192,1)",
                pointBackgroundColor: "#fff",
                pointBorderWidth: 1,
                pointHoverRadius: 5,
                pointHoverBackgroundColor: "rgba(75,192,192,1)",
                pointHoverBorderColor: "rgba(220,220,220,1)",
                pointHoverBorderWidth: 2,
                pointRadius: 1,
                pointHitRadius: 10,
                data: dateQuantityData,
                spanGaps: false
            }]
        };

        // Assign color to each entry in the pie chart
        var rainbow = new Rainbow();
        rainbow.setNumberRange(0, speciesLabels.length);
        rainbow.setSpectrum('turquoise', 'seagreen', 'seashell', 'lemonchiffon', 'snow', 'thistle', 'wheat', 'violet', 'orchid', 'whitesmoke', 'darkturquoise', 'honeydew', 'skyblue', 'plum', 'papayawhip');

        var colors = [];
        var hexColor;
        for (var i = 0; i < speciesLabels.length; i++) {
            hexColor = '#' + rainbow.colourAt(i);
            colors.push(hexColor);
        }

        var speciesData = {
            labels: speciesLabels,
            datasets: [{
                data: speciesQuantityData,
                backgroundColor: colors,
                hoverBackgroundColor: colors
            }]
        };

        var options = {
            legend: {
                display: false
            },
            title: {
                display: true,
                text: 'Cumulative Findings',
                fontFamily: 'sans-serif',
                fontStyle: 'normal',
                fontSize: 16
            },
            responsive: true, //Resizes the chart canvas when its container does
            maintainAspectRatio: true,
            scales: {
                xAxes: [{
                    gridLines: {
                        display: true
                    }
                }]
            }
        };

        var displayLegend = true;
        // If there are more than 20 different species in the area - the pie chart gets to crowded
        if (speciesLabels.length > 20) {
            displayLegend = false;
        }

        var speciesOptions = {
            legend: {
                display: displayLegend
            },
            title: {
                display: true,
                text: 'Mushroom Species',
                fontFamily: 'sans-serif',
                fontStyle: 'normal',
                fontSize: 16
            },
            responsive: true, //Resizes the chart canvas when its container does.
            maintainAspectRatio: true,
            scaleShowVerticalLines: false,
            // To display percentage in pie chart, tooltip from: http://www.cryst.co.uk/2016/06/03/adding-percentages-chart-js-pie-chart-tooltips/
            tooltips: {
                callbacks: {
                    label: function(tooltipItem, data) {
                        var allData = data.datasets[tooltipItem.datasetIndex].data;
                        var tooltipLabel = data.labels[tooltipItem.index];
                        var tooltipData = allData[tooltipItem.index];
                        var total = 0;
                        for (var i in allData) {
                            total += allData[i];
                        }
                        // Thanks to Billy Moon, http://stackoverflow.com/questions/7342957/how-do-you-round-to-1-decimal-place-in-javascript
                        function round(value, precision) {
                            var multiplier = Math.pow(10, precision || 0);
                            return Math.round(value * multiplier) / multiplier;
                        }
                        var tooltipPercentage = (tooltipData / total) * 100;
                        var roundedTooltipPercentage = round(tooltipPercentage, 1);
                        return tooltipLabel + ': ' + tooltipData + ' (' + roundedTooltipPercentage + '%)';
                    }
                }
            }
        };

        // CHARTING
        var ctx = document.getElementById("myLineChart");
        var pieCtx = document.getElementById("myPieChart");

        myLineChart = new Chart(ctx, {
            type: 'line',
            data: dateData,
            options: options,
            animation: {
                animateScale: true
            }
        });

        myPieChart = new Chart(pieCtx, {
            type: 'pie',
            data: speciesData,
            options: speciesOptions,
            animation: {
                animateScale: true
            }
        });

        $("#myModal").modal();
    });

    request.fail(function(jqXHR, textStatus) {
        console.log(textStatus);
    });
}

// Read all the user's polygons from the DB, show them on map
function getAllPolyFromDb(vectorLayer) {

    var request = $.ajax({
        url: "/api/getAllPoly",
        type: "POST",
        data: {},
        cache: false
    });

    request.done(function(polygons) {

        if (polygons == "noPolygons") {
            // If the user has no stored polygons - set the view to the center of Sweden
            map.getView().setCenter(ol.proj.transform([15, 62], 'EPSG:4326', 'EPSG:3857'));
            map.getView().setZoom(5);
        } else {
            for (var i = 0; i < polygons.length; i++) {
                // Accessing properties of the return object
                var polygon_featureID = polygons[i].id;
                var polygon_WKT = polygons[i].wkt;

                var format = new ol.format.WKT();
                var polyFeature = format.readFeature(polygon_WKT, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
                var coords = polyFeature.getGeometry().getCoordinates();
                var polygon = new ol.geom.Polygon(coords);

                var polygonFeature = new ol.Feature({
                    geometry: polygon
                });

                polygonFeature.setId(polygon_featureID);
                vectorLayer.getSource().addFeature(polygonFeature);

                // Set the view to the extent of the user's polygons
                viewPadding = [40, 40, 40, 40];
                extent = vectorLayer.getSource().getExtent();
                map.getView().fit(extent, map.getSize(), {
                    padding: viewPadding,
                    minResolution: 13
                });
            }
            map.render();
        }
    });

    request.fail(function(jqXHR, textStatus) {
        console.log(textStatus);
    });
}

// Insert polygon into DB
function insertPolyIntoDb(featureID, wkt) {

    var request = $.ajax({
        url: "/api/insertPoly",
        type: "POST",
        data: { id: featureID, wkt: wkt },
        cache: false
    });

    request.done(function(msg) {

        if (msg == "polyFail") {
            alert('insertion of poly unsuccessful.');
        } else if (msg == "error") {
            alert('Something went wrong with the poly insertion!');
        } else if (msg == "polySuccess") {
            console.log("insertion of poly successful");
        } else {
            alert('Could not insert the polygon to the DB. Maybe you are signed out?');
        }
    });

    request.fail(function(jqXHR, textStatus) {
        console.log(textStatus);
    });
}

// Update polygon geomerty in DB
function updatePolyIntoDb(featureID, wkt) {
    console.log('updating ' + wkt);
    console.log('featureID ' + featureID);

    var request = $.ajax({
        url: "/api/updatePoly",
        type: "POST",
        data: { id: featureID, wkt: wkt },
        cache: false
    });

    request.done(function(msg) {

        if (msg == "polyFail") {
            alert('update of poly unsuccessful.');
        } else if (msg == "error") {
            alert('Something went wrong with the poly update!');
        } else if (msg == "polySuccess") {
            console.log("update of poly successful");
        } else {
            alert("Could not update the polygon in DB. Maybe you are signed out?");
        }
    });

    request.fail(function(jqXHR, textStatus) {
        console.log(textStatus);
    });
}

function deletePolyInDb(feature, featureID) {

    var request = $.ajax({
        url: "/api/deletePoly",
        type: "POST",
        data: { id: featureID },
        cache: false
    });

    request.done(function(msg) {

        if (msg == "polyFail") {
            alert('deletion of poly unsuccessful.');
        } else if (msg == "error") {
            alert('Something went wrong with the poly deletion!');
        } else if (msg == "polySuccess") {
            console.log("deletion of poly successful");
            spaceTimeLayer.getSource().removeFeature(feature);
            map.removeOverlay(popup);
            // Deselect features (eq. to a click outside a feature, i.e. forces the feature to deselect)
            selectInteractionspaceTimeLayer.getFeatures().clear();
        } else {
            alert('Could not delete the polygon. Maybe you are not signed in?');
        }
    });

    request.fail(function(jqXHR, textStatus) {
        console.log(textStatus);
    });
}

// Abort drawing - To have an stop-draw option for mobile
function abortDrawing() {
    map.removeInteraction(draw);
}

// Get the mushroom finding place(s) with the most logged findings (to be interpreted as "the most popular")
function findMostPopularFindingPlace(featureID) {
    var request = $.ajax({
        url: "/api/mostPopularFindingPlace",
        type: "POST",
        data: { id: featureID },
        cache: false
    });

    request.done(function(mushroomObject) {

        if (mushroomObject == "noMushroomFindings") {
            alert("No mushroom findings were found in this area.");
            map.removeOverlay(popup);
            return;
        }

        mostPopularFindingPlace = true;

        for (var i = 0; i < mushroomObject.length; i++) {

            mostPopularFindingCount = mushroomObject[i].count;
            var mushroom_the_geom = mushroomObject[i].the_geom;
            var lon = mushroom_the_geom.coordinates[0];
            var lat = mushroom_the_geom.coordinates[1];

            var coordinates = ol.proj.transform([lon, lat], 'EPSG:4326', 'EPSG:3857');
            var geometry = new ol.geom.Point(coordinates);

            var feature = new ol.Feature({
                name: 'closestSpecificMushroom',
                geometry: geometry
            });

            // Add the feature to the highlighted_mushrooms vector source
            highlighted_mushrooms.addFeature(feature);
        }
    });

    request.fail(function(jqXHR, textStatus) {
        console.log(textStatus);
    });
}

function heatMap() {

    vector = new ol.layer.Heatmap({
        source: vectorSource,
        blur: 35,
        radius: 7,
        useLocalExtrema: true
    });

    // Set view to the whole of Sweden
    map.getView().setCenter(ol.proj.transform([15.037274, 62.991174], 'EPSG:4326', 'EPSG:3857'));
    view.setZoom(5);

    mushroom_clusterLayer.setVisible(false);
    map.addLayer(vector);
}

function clearHeatMap() {
    map.removeLayer(vector);
    mushroom_clusterLayer.setVisible(true);
}

var heatMapInterval = null;
var heatMapTimeLayer = null;
var heatMapTimeSourceVector = null;

function stopHeatMapTime() {
    if (heatMapInterval) {
        clearInterval(heatMapInterval);
        heatMapInterval = null;
    }
    map.removeLayer(heatMapTimeLayer);
    heatMapTimeLayer = null;
    mushroom_clusterLayer.setVisible(true);
    $("#mySpan").hide();

}

function initHeatMapTime() {

    $("#mySpan").show();

    if (!heatMapTimeSourceVector) {
        heatMapTimeSourceVector = new ol.source.Vector();
    }

    if (!heatMapTimeLayer) {
        heatMapTimeLayer = new ol.layer.Heatmap({
            source: heatMapTimeSourceVector,
            blur: 40,
            radius: 4,
            useLocalExtrema: true
        });
        map.addLayer(heatMapTimeLayer);
    }
}

function startHeatMapTime() {

    // Set zoom level to show Sweden
    map.getView().setCenter(ol.proj.transform([15.037274, 62.991174], 'EPSG:4326', 'EPSG:3857'));
    view.setZoom(5);

    // Wait a few seconds to let the source vector load all mushrooms from database
    // then start heat map animation
    // FIXME use a callback that checks if all mushrooms are loaded instead of a timeout
    setTimeout(heatMapTime, 3000);
}

function heatMapTime() {
    // Draw all the features of the last 20 days that has features
    var dateSpan = 20;

    // If one starts heatmap while its running - reset the heatmap
    stopHeatMapTime();
    initHeatMapTime();

    // Make mushroom layer invisible - show only heatmap layer
    mushroom_clusterLayer.setVisible(false);

    var source = mushroom_clusterLayer.getSource();
    var sourceFeatures = source.getFeatures();

    var featuresGroupedByDate = {}; // = {[..], [..], ..}
    sourceFeatures.forEach(function(feature, index) {
        var features = feature.get('features');
        for (var i = 0; i < features.length; i++) {
            var date = features[i].get('date').replace("Z", ""); // FIXME - The date is not correctly formatted (VERY bad "fix")
            if (!featuresGroupedByDate[date]) {
                featuresGroupedByDate[date] = [];
            }
            featuresGroupedByDate[date].push(features[i]);
        }
    });
    // Get all unique dates and sort them
    var sortedDates = Object.keys(featuresGroupedByDate).sort();

    var dateIndex = 0;
    heatMapInterval = setInterval(function() {

        // Radio button input from sidebar
        var method = $('input[name=heatMapTimeMethod]:checked').val();

        // Hotspot: Draw all the features of the last 20 days with findings
        if (method == "hotspot") {
            heatMapTimeLayer.getSource().clear();
            for (var idx = dateIndex; idx >= 0 && idx >= dateIndex - dateSpan; idx--) {
                heatMapTimeLayer.getSource().addFeatures(featuresGroupedByDate[sortedDates[idx]]);
            }
        } else if (method == "cumulative") {
            if (dateIndex == 0) {
                heatMapTimeLayer.getSource().clear();
            }
            heatMapTimeLayer.getSource().addFeatures(featuresGroupedByDate[sortedDates[dateIndex]]);
        }

        dateIndex += 1;
        if (dateIndex == sortedDates.length) {
            dateIndex = 0;
        }

        $("#mySpan").html(sortedDates[dateIndex]);

    }, 200);

    var month = 1;
    var day = 1;

    function pad(n, size) {
        var s = n + "";
        while (s.length < size) s = "0" + s;
        return s;
    }
    var counter = 0;

}
