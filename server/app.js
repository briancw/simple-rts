var FastSimplexNoise = require('fast-simplex-noise');
var fast_simplex = new FastSimplexNoise({random: random});
var express = require('express');
var server = express();
var bodyParser = require('body-parser');

server.use(bodyParser.json());
server.use(bodyParser.urlencoded({ extended: true }));

function random(){
	// return Math.random();
	return 0.4710536374424983;
}

var fast_simplex = new FastSimplexNoise({random: random});

fast_simplex.octaves = 12;
fast_simplex.frequency = 0.315;
fast_simplex.persistence = 0.5;

// End initialization

server.all('*', function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "X-Requested-With");
	next();
});

server.get('/', function(req, res){
	res.send( 'Server seems fine 😃' );
});

server.all('/heightmap', function(req, res){

	console.time('generation');

	var heightmap = Array();

	if( typeof(req.body.cube_size) != 'undefined' && req.body.cube_size.length ){
		var cube_size = parseInt(req.body.cube_size);
	} else {
		var cube_size = 10;
	}

	if( typeof(req.body.map_size) != 'undefined' && req.body.map_size.length ){
		var map_size = parseInt(req.body.map_size);
	} else {
		var map_size = 100;
	}

	if( typeof(req.body.origin) != 'undefined' && req.body.origin.length ){
		var origin = req.body.origin;
	} else {
		var origin = [0,0];
	}

	if(cube_size > 800){
		return false;
	}

	var start_x = parseInt(origin[0],10);
	var start_y = parseInt(origin[1],10);

	// var map_size = 1000;
	// var map_size = 25000;
	// Map size must be set statically if all players are to see the same scale regardless of screen resolution
	// Using this system, adding to x or y will pan the map 1 tile, no matter how many tiles the player sees.

	var scale = cube_size / map_size;

	for(x = start_x; x < cube_size + start_x; x++){
		for(y = start_y; y < cube_size + start_y; y++){

			nx = Math.cos( ((x/cube_size) * scale) * 2 * Math.PI );
			ny = Math.cos( ((y/cube_size) * scale) * 2 * Math.PI );
			nz = Math.sin( ((x/cube_size) * scale) * 2 * Math.PI );
			nw = Math.sin( ((y/cube_size) * scale) * 2 * Math.PI );

			// heightmap.push( {height: (fast_simplex.get4DNoise(nx,ny,nz,nw) + 1)/2});
			// var tmp_temp = Math.abs( Math.abs( 1 - ((y-start_y)/cube_size*2) ) - 1 );

			var tmp_elevation = fast_simplex.get4DNoise(nx,ny,nz,nw) + 0.55;
			var tmp_temp = 10;
			if(tmp_elevation <= 0.55){
				tmp_temp -= 5;
			} else {
				// temp drops 3f per 1k ft, based on max elevation of 20k feet
				// tmp_temp -= ((tmp_elevation - .55) * 146);
				// Less intense version assuming max mountain height of 10k, should fix continent rather than this
				tmp_temp -= ((tmp_elevation - .55) * 82);
			}
			var equator_distance = Math.abs( Math.abs( 1 - ((y-start_y)/cube_size*2) ) - 1 );
			tmp_temp += equator_distance * 60;

			heightmap.push( {height: tmp_elevation, temp: tmp_temp  } );
		}
	}

	res.send( {heightmap: heightmap} );

	console.timeEnd('generation');

});

server.listen(9005);
