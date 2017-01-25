var pg = require('pg');

var host = '188.166.65.138';
var port ='5432';
var dbName = 'mushroom';

var connectionString = 'postgres://mush:mush@'+host+':'+port+'/'+dbName;


// Export the connection string for usage by the API
module.exports = connectionString;

var client = new pg.Client(connectionString);
client.connect();