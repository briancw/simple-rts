var FastSimplexNoise = require('fast-simplex-noise');
var fast_simplex = new FastSimplexNoise({random: random});
var express = require('express');
var server = express();
var bodyParser = require('body-parser');

server.use(bodyParser.json());
server.use(bodyParser.urlencoded({ extended: true }));

function random(){
	return Math.random();
	// return 0.4710536374424983;
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
	res.send( 'Server seems find 😃' );
});

server.all('/heightmap', function(req, res){

	var heightmap = Array();

	if( typeof(req.body.cube_size) != 'undefined' && req.body.cube_size.length ){
		var cube_size = parseInt(req.body.cube_size);
	} else {
		var cube_size = 10;
	}

	var start_x = 0;
	var start_y = 0;
	var scale = 1;

	for(x = start_x; x < (cube_size) + start_x; x++){
		for(y = start_y; y < (cube_size) + start_y; y++){
			nx = Math.cos( ((x/cube_size)*scale) * 2 * Math.PI);
			ny = Math.cos( ((y/cube_size)*scale) * 2 * Math.PI);
			nz = Math.sin( ((x/cube_size)*scale) * 2 * Math.PI);
			nw = Math.sin( ((y/cube_size)*scale) * 2 * Math.PI);

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

});

server.listen(9001);


