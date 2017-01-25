var pg = require('pg');
var express = require('express');
var router = express.Router();
var credentials = require('../dbcredentials/credentials.js');
var apiClient = new pg.Client(credentials);
var passport = require("passport");
var session = require('express-session');
var Sequelize = require('sequelize');
var LocalStrategy = require('passport-local').Strategy;
var sequelize = new Sequelize(credentials);

apiClient.on('notice', function(msg) {
    console.log("notice: %j", msg);
});

apiClient.on('error', function(error) {
    console.log(error);
});

apiClient.connect(function(err) {
    if (err) {
        return console.error('could not connect to postgres', err);
    }
});

passport.serializeUser(function(user, done) {
    console.log("serializeUser" + user.id);
    done(null, {
        id: user.id,
        username: user.username,
        email: user.email
    });
});

passport.deserializeUser(function(passport_user, done) {
    console.log("deserializeUser start " + passport_user.username);
    User.findOne({ where: { username: passport_user.username } }).then(function(user) {

        if (!user) {
            global_user = null;
            return done(null, false, { message: "The user does not exist! Couldn't deserialize!" });
        }
        global_user = user;
        return done(null, user);
    });
});

router.use(session({
    secret: 'so secret',
    resave: true,
    saveUninitialized: true,
    cookie: {
        secure: false
    }
}));

router.use(passport.initialize());
router.use(passport.session());
// Configuring Passport
//var flash = require("connect-flash");
//app.use(flash());

var User = sequelize.define('user', {
    username: Sequelize.STRING,
    email: Sequelize.STRING,
    password: Sequelize.STRING,
    id: {
        type: Sequelize.INTEGER,
        field: 'user_id',
        primaryKey: true,
        autoIncrement: true
    },
    createdAt: {
        type: Sequelize.DATE,
        field: 'createdat'
    },
    updatedAt: {
        type: Sequelize.DATE,
        field: 'updatedat'
    }
});

/*User.sync({force: true}).then(function() {
 return User.create({
 username: 's',
 password: 's'
 })
 });*/

User.sync();

///////////////

/* GET home page. */
router.get('/map', isLoggedIn,

    function(req, res, next) {
        console.log("map data: " + req.user.id + " " + req.user.username + " " + req.user.createdAt);
        // When the user signs out, prevent that the user gets to the map page again by hitting the back button. Forces it load a fresh copy instead of cached one.
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');
        res.render('mushroomStartPage.html', { title: 'Express' });
    });

router.get('/', function(req, res, next) {
    res.render('startPage', { title: 'Express' });
});

router.get('/login', function(req, res, next) {
    res.render('login', { title: 'Express' });
});

router.get('/registerAccount', function(req, res, next) {
    res.render('registerAccount', { title: 'Express' });
});

router.get('/handleMushrooms', isLoggedIn,
    function(req, res, next) {
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');
        res.render('handleMushrooms.html', { title: 'Express' });
    });

router.get('/spaceTimeAnalysis', isLoggedIn,
    function(req, res, next) {
        // When the user signs out, prevent that the user gets to the page again by hitting the back button. Forces it load a fresh copy instead of cached one.
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');
        res.render('spaceTimeAnalysis.html', { title: 'Express' });
    });

// Check if the user is logged in
function isLoggedIn(req, res, next) {
    console.log("isLoggedIn?" + req.headers.cookie);
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect("/login");
}

// LOGIN - authenticate
passport.use('login', new LocalStrategy({
        passReqToCallback: true
    },
    function(req, username, password, done) {

        if (username == "" || password == "") { // If the user haven't filled in both username and password, return missingCredentials: true
            return (null, false, true);
        }

        User.findOne({ where: { username: username } }).then(function(user) {
            if (!user || user.password !== password) {
                return done(null, false, false, { message: "Invalid username or password!" }); //return error, user, message
            }
            req.logIn(user, function(err) { console.log("index row 134"); });

            return done(null, user, false);
        });
    }
));

// LOGIN
router.post('/api/loginUser',

    function(req, res, next) {
        req.logout();

        passport.authenticate('login', function(err, user, missingCredentials) {

            if (err) {
                return res.json("error");
            }
            if (missingCredentials) {
                return res.json('missingCredentials');
            }
            if (!user) {
                return res.json('invalidCredentials');
            }
            return res.json("validCredentials");

        })(req, res, next);
    }
);

// REGISTER USER - authenticate
passport.use('signUp', new LocalStrategy({
        passReqToCallback: true
    },
    function(req, username, password, done) {

        if (username === "" || password === "") {
            return done(null, false, true); //If the user haven't filled in both username and password, return missingCredentials: true
        }

        User.findOne({ where: { username: username } }).then(function(user) {
            if (user) { // If the username is already taken
                return done(null, false, false, { message: "The username is already taken!" }); //return error, user, message
            } else { // If username is available - create a user with the given username, email and password
                var newUser = User.create({
                    username: username,
                    password: password,
                    email: req.param('email')
                });
                return done(null, newUser, false);
            }
        });
    }));

// REGISTER USER
router.post('/api/registerUser',
    function(req, res, next) {
        passport.authenticate('signUp', function(err, newUser, missingCredentials) {

            if (err) {
                return res.json("error");
            }
            if (missingCredentials) {
                return res.json('missingCredentials');
            }
            if (!newUser) {
                return res.json('invalidCredentials');
            }
            return res.json('validCredentials');

        })(req, res, next);
    }
);

// LOGOUT
router.post('/api/logoutUser',

    function(req, res, next) {
        req.logOut();
        req.session.destroy();
        return res.json("logoutUser");
    }
);

///////////////////////////

// Testing the 1. application query to find the closest mushroom picking place with a desired mushroom species
router.post('/api/getClosestDesiredMushroom', function(req, res) {
    var results = [];
    var data = { latitude: req.body.latitude, longitude: req.body.longitude, mushroom_type: req.body.mushroom_type };

    var query = apiClient.query("SELECT * FROM sd_get_closest_mush_find_of_spec_type_ONLY_from_coords_vertex($1, $2, $3)", [data.longitude, data.latitude, data.mushroom_type]);

    query.on('row', function(row) {
        results.push(row);
    });

    query.on('end', function() {
        if (results.length == 0) {
            res.json("noMushrooms");
        } else {
            res.json(results);
        }
    });
});

// Get all distinct mushroom species from mushroom_findings
router.post('/api/getAllDistinctSpecies', function(req, res) {
    var results = [];
    var data = {};

    var query = apiClient.query("SELECT DISTINCT name FROM mushroom_findings order by name asc");

    query.on('row', function(row) {
        results.push(row);
    });

    query.on('end', function() {
        if (results.length == 0) {
            res.json("noMushrooms");
        } else {
            res.json(results);
        }
    });
});


// Get all findings of the user
router.get('/api/getAllFindings', isLoggedIn, function(req, res) {
    var results = [];

    var user_id = global_user.id;

    var query = apiClient.query("SELECT id, user_id, lat, lon, name, quantity, unit, finding_place, precision, county, municipality, province, date, comment, biotope, biotope_description, substrate FROM mushroom_findings WHERE user_id = ($1)", [user_id]);

    query.on('row', function(row) {
        results.push(row);
    });

    query.on('end', function() {
        if (results.length == 0) {
            res.json("noUserFindings");
        } else {
            res.json(results);
        }
    });
});

// Inserting points to database
router.post('/api/insertFinding', isLoggedIn, function(req, res) {
    var results = [];

    var latitude = req.body.latitude;
    var longitude = req.body.longitude;
    var mushroom_name = req.body.mushroom_name;
    var quantity = req.body.quantity;
    var unit = req.body.unit;
    var finding_place = req.body.finding_place;
    var precision = req.body.precision;
    var county = req.body.county;
    var municipality = req.body.municipality;
    var province = req.body.province;
    var date = req.body.date;
    var comment = req.body.comment;
    var biotope = req.body.biotope;
    var biotope_desc = req.body.biotope_desc;
    var substrate = req.body.substrate;
    var user_id = global_user.id;

    var query = apiClient.query("INSERT INTO mushroom_findings (user_id, lat, lon, name, quantity, unit, finding_place, precision, county, municipality, province, date, comment, biotope, biotope_description, substrate) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)", [user_id, latitude, longitude, mushroom_name, quantity, unit, finding_place, precision, county, municipality, province, date, comment, biotope, biotope_desc, substrate]);

    query.on('row', function(row) {
        results.push(row);
    });

    query.on('end', function() {
        if (results.length == 0) {
            res.json("Insert finding succeeded!");
        } else {
            res.json("Insert failed!");
        }
    });

});

// Update user finding in database
router.post('/api/updateFinding', isLoggedIn, function(req, res) {
    var results = [];

    var updateMushroomName = req.body.updateMushroomName;
    var updateQuantity = req.body.updateQuantity;
    var updateUnit = req.body.updateUnit;
    var updateFindingPlace = req.body.updateFindingPlace;
    var updatePrecision = req.body.updatePrecision;
    var updateCounty = req.body.updateCounty
    var updateMunicipality = req.body.updateMunicipality;
    var updateProvince = req.body.updateProvince;
    var updateDate = req.body.updateDate;
    var updateComment = req.body.updateComment;
    var updateBiotope = req.body.updateBiotope;
    var updateBiotope_desc = req.body.updateBiotope_desc;
    var updateSubstrate = req.body.updateSubstrate
    var id = req.body.id;
    var user_id = global_user.id;

    var query = apiClient.query("UPDATE mushroom_findings SET name = ($1), quantity = ($2), unit = ($3), finding_place = ($4), precision = ($5), county = ($6), municipality = ($7), province = ($8), date = ($9), comment = ($10), biotope = ($11), biotope_description = ($12), substrate = ($13) WHERE id = ($14) AND user_id = ($15)", [updateMushroomName, updateQuantity, updateUnit, updateFindingPlace, updatePrecision, updateCounty, updateMunicipality, updateProvince, updateDate, updateComment, updateBiotope, updateBiotope_desc, updateSubstrate, id, user_id]);

    query.on('row', function(row) {
        results.push(row);
    });

    query.on('end', function() {
        if (results.length == 0) {
            res.json("Update finding successful!");
        } else {
            res.json("Update failed!");
        }
    });

});

// Delete user finding from database
router.post('/api/deleteFinding', isLoggedIn, function(req, res) {
    var results = [];

    var id = req.body.id;
    var user_id = global_user.id;

    var query = apiClient.query("DELETE FROM mushroom_findings WHERE id = ($1) AND  user_id = ($2)", [id, user_id]);

    query.on('row', function(row) {
        results.push(row);
    });

    query.on('end', function() {
        if (results.length == 0) {
            res.json("Delete succeeded!");
        } else {
            res.json("Delete failed!");
        }
    });

});

// Get all unique mushroom findings species
router.get('/api/getUniqueName', function(req, res) {
    var results = [];
    var query = apiClient.query("SELECT DISTINCT name FROM mushroom_data");

    query.on('row', function(row) {
        results.push(row);
    });

    query.on('end', function() {
        if (results.length == 0) {
            res.json("Get unique names query failed");
        } else {
            res.json(results);
        }
    });

});


// GET ALL the spaceTime polygons from DB
router.post('/api/getAllPoly', isLoggedIn, function(req, res) {

    var results = [];
    var data = {};
    var user_id = global_user.id;


    var query = apiClient.query("SELECT * FROM space_time_polygons WHERE user_id = $1", [user_id]);

    query.on('row', function(row) {
        results.push(row);
    });

    query.on('end', function() {
        if (results.length == 0) {
            res.json("noPolygons")
        } else {
            res.json(results);
        }
    });
});

// INSERT the spaceTime polygons into DB
router.post('/api/insertPoly', isLoggedIn, function(req, res) {

    var results = [];
    var data = { id: req.body.id, wkt: req.body.wkt };
    var user_id = global_user.id;

    var query = apiClient.query("INSERT INTO space_time_polygons (id, wkt, user_id) VALUES ($1, $2, $3)", [data.id, data.wkt, user_id]);

    query.on('row', function(row) {
        results.push(row);
    });

    query.on('end', function() {
        if (results.length == 0) {
            res.json("polySuccess")
        } else {
            res.json("polyFail");
        }
    });
});

// UPDATE the spaceTime polygons in DB
router.post('/api/updatePoly', isLoggedIn, function(req, res) {
    var results = [];
    var data = { id: req.body.id, wkt: req.body.wkt };
    var user_id = global_user.id;

    var query = apiClient.query("UPDATE space_time_polygons SET wkt = $1 WHERE id = $2 and user_id = $3 ", [data.wkt, data.id, user_id]);

    query.on('row', function(row) {
        results.push(row);
    });

    query.on('end', function() {
        if (results.length == 0) {
            res.json("polySuccess")
        } else {
            res.json("polyFail");
        }
    });
});

// DELETE the spaceTime polygons in DB
router.post('/api/deletePoly', isLoggedIn, function(req, res) {
    var results = [];
    var data = { id: req.body.id };
    var user_id = global_user.id;

    var query = apiClient.query("DELETE FROM space_time_polygons WHERE id = $1 and user_id = $2", [data.id, user_id]);

    query.on('row', function(row) {
        results.push(row);
    });

    query.on('end', function() {
        if (results.length == 0) {
            res.json("polySuccess")
        } else {
            res.json("polyFail");
        }
    });
});


// ANALYSE the mushroom findings that are within the spaceTime polygon
router.post('/api/stpAnalyse', function(req, res) {

    var results = [];
    var data = { id: req.body.id }; // spaceTime polygon id

    var query = apiClient.query("SELECT * FROM sd_stp_analyse_area($1)", [data.id]);

    query.on('row', function(row) {
        results.push(row);
    });

    query.on('end', function() {
        if (results.length == 0) {
            res.json("noMushroomFindings")
        } else {
            res.json(results);
        }
    });
});

// Find the most popular mushroom finding place (nr. of logged mushroom findings, disregarding quantity)
router.post('/api/mostPopularFindingPlace', function(req, res) {
    var results = [];
    var data = { id: req.body.id };

    var query = apiClient.query("SELECT * FROM sd_most_popular_finding($1)", [data.id]);

    query.on('row', function(row) {
        results.push(row);
    });

    query.on('end', function() {
        if (results.length == 0) {
            res.json("noMushroomFindings");
        } else {
            res.json(results);
        }
    });
});



// The position of this might affect?! It has been changed
module.exports = router;
